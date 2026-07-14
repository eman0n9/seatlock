const CLIENT_MESSAGE_TYPES = new Set(['reserve', 'unreserve'])
export const MAX_PENDING_SERVER_MESSAGES = 250

function normalizeSeatIds(value) {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((seat) => (typeof seat === 'string' ? seat : seat?.seatId))
    .filter((seatId) => typeof seatId === 'string' && seatId.length > 0)
}

export function createClientMessage(type, payload = {}) {
  if (!CLIENT_MESSAGE_TYPES.has(type)) {
    throw new Error(`Unsupported WebSocket message type: ${type}`)
  }

  if (typeof payload.seatId !== 'string' || !payload.seatId) {
    throw new Error(`A seatId is required for a ${type} message.`)
  }

  return { type, seatId: payload.seatId }
}

export function normalizeServerMessage(value) {
  if (!value || typeof value !== 'object' || typeof value.type !== 'string') {
    return null
  }

  const { type, ...payload } = value
  return { type, payload }
}

export function enqueueServerMessage(
  messages,
  message,
  id,
  maxPending = MAX_PENDING_SERVER_MESSAGES,
) {
  if (messages.length >= maxPending) {
    return { messages: [], requiresResync: true }
  }

  return {
    messages: [...messages, { ...message, id }],
    requiresResync: false,
  }
}

export function getPendingServerMessages(messages, lastHandledId = 0) {
  return messages.filter((message) => message.id > lastHandledId)
}

export function pruneServerMessages(messages, lastHandledId) {
  return messages.filter((message) => message.id > lastHandledId)
}

export function buildConnectionScopeKey(eventId, pathname) {
  return JSON.stringify([eventId ?? '', pathname ?? ''])
}

export function getScopedMessageQueue(queueState, connectionScopeKey) {
  return queueState.scopeKey === connectionScopeKey ? queueState.messages : []
}

export function normalizeSnapshotPayload(payload = {}) {
  const reservedSeats = Array.isArray(payload.myReserved) ? payload.myReserved : []
  const ttls = reservedSeats
    .map((seat) => Number(seat?.ttl))
    .filter((ttl) => Number.isFinite(ttl) && ttl > 0)
  const minimumTtl = ttls.length ? Math.min(...ttls) : null

  return {
    purchased: normalizeSeatIds(payload.purchased),
    myReserved: normalizeSeatIds(reservedSeats),
    otherReserved: normalizeSeatIds(payload.otherReserved),
    holdExpiresAt: minimumTtl === null ? null : Date.now() + minimumTtl * 1000,
  }
}
