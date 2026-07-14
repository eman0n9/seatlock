import { describe, expect, it } from 'vitest'
import {
  buildConnectionScopeKey,
  createClientMessage,
  enqueueServerMessage,
  getPendingServerMessages,
  getScopedMessageQueue,
  normalizeServerMessage,
  normalizeSnapshotPayload,
  pruneServerMessages,
} from './socketPayloads'

describe('socket payloads', () => {
  it('creates reservation messages accepted by the WebSocket service', () => {
    expect(createClientMessage('reserve', { seatId: 'seat-id' })).toEqual({
      type: 'reserve',
      seatId: 'seat-id',
    })
    expect(createClientMessage('unreserve', { seatId: 'seat-id' })).toEqual({
      type: 'unreserve',
      seatId: 'seat-id',
    })
  })

  it('rejects client-side purchase notifications', () => {
    expect(() => createClientMessage('purchased', { seatIds: ['seat-id'] }))
      .toThrow('Unsupported WebSocket message type')
  })

  it('normalizes snapshots and uses the shortest reservation TTL', () => {
    const now = Date.now()
    const snapshot = normalizeSnapshotPayload({
      purchased: ['sold-seat'],
      myReserved: [
        { seatId: 'mine-1', ttl: 120 },
        { seatId: 'mine-2', ttl: 60 },
      ],
      otherReserved: ['other-seat'],
    })

    expect(snapshot.purchased).toEqual(['sold-seat'])
    expect(snapshot.myReserved).toEqual(['mine-1', 'mine-2'])
    expect(snapshot.otherReserved).toEqual(['other-seat'])
    expect(snapshot.holdExpiresAt).toBeGreaterThanOrEqual(now + 59_000)
    expect(snapshot.holdExpiresAt).toBeLessThanOrEqual(now + 61_000)
  })

  it('rejects malformed server messages', () => {
    expect(normalizeServerMessage(null)).toBeNull()
    expect(normalizeServerMessage({ type: 'released', seatId: 'seat-id' })).toEqual({
      type: 'released',
      payload: { seatId: 'seat-id' },
    })
  })

  it('keeps a snapshot and subsequent frames in sequence', () => {
    let messages = []
    messages = enqueueServerMessage(
      messages,
      { type: 'snapshot', payload: {} },
      1,
    ).messages
    messages = enqueueServerMessage(messages, {
      type: 'reserved',
      payload: { seatId: 'seat-id' },
    }, 2).messages

    expect(getPendingServerMessages(messages, 0).map((message) => message.type))
      .toEqual(['snapshot', 'reserved'])
    expect(getPendingServerMessages(messages, 1)).toEqual([messages[1]])
  })

  it('prunes only acknowledged messages and preserves a concurrent append', () => {
    let messages = [
      { id: 1, type: 'snapshot', payload: {} },
      { id: 2, type: 'reserved', payload: { seatId: 'seat-1' } },
    ]

    messages = enqueueServerMessage(messages, {
      type: 'reserved',
      payload: { seatId: 'seat-2' },
    }, 3).messages
    messages = pruneServerMessages(messages, 2)

    expect(messages).toEqual([
      { id: 3, type: 'reserved', payload: { seatId: 'seat-2' } },
    ])
  })

  it('requires an authoritative resync instead of dropping on overflow', () => {
    const messages = [
      { id: 1, type: 'snapshot', payload: {} },
      { id: 2, type: 'reserved', payload: { seatId: 'seat-1' } },
    ]
    const result = enqueueServerMessage(messages, {
      type: 'reserved',
      payload: { seatId: 'seat-2' },
    }, 3, 2)

    expect(result).toEqual({ messages: [], requiresResync: true })
  })

  it('does not expose a previous route queue during a scope transition', () => {
    const previousScope = buildConnectionScopeKey('event-1', '/event/event-1/seatmap')
    const nextScope = buildConnectionScopeKey('event-1', '/event/event-1/cart')
    const messages = [{ id: 1, type: 'snapshot', payload: {} }]
    const queueState = { messages, scopeKey: previousScope }

    expect(getScopedMessageQueue(queueState, previousScope)).toBe(messages)
    expect(getScopedMessageQueue(queueState, nextScope)).toEqual([])
  })
})
