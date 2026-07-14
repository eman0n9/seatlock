'use client'

import { useEffect, useRef } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { getPurchaseRoute, getSeatMapRoute, routePaths } from 'app/routePaths'
import PagePlaceholder from 'components/ui/PagePlaceholder'
import { useOptionalEventWebSocket } from 'features/purchase/EventWebSocketProvider'
import {
  getPendingServerMessages,
  normalizeSnapshotPayload,
} from 'features/purchase/socketPayloads'
import { usePurchase } from 'features/purchase/usePurchase'
import { calculatePricing, formatHoldTime, getHoldTimeLeft } from 'features/purchase/purchaseUtils'
import { usePageTitle } from 'hooks/usePageTitle'
import { cn } from 'utils/cn'

function EventBasketGroup({ isBusy, item, onCheckout, onRemoveSeat }) {
  const { event, seats, holdExpiresAt } = item
  const holdTimeLeft = getHoldTimeLeft(holdExpiresAt)
  const pricing = calculatePricing(seats)

  return (
    <section className="basket-event-group sync-card">
      <div className="basket-event-group__header">
        <div>
          <div className="sync-card__label">Event</div>
          <h2 className="sync-card__title">{event.title}</h2>
          {(event.dateLabel || event.venue) && (
            <p className="sync-card__text">
              {[event.dateLabel, event.venue].filter(Boolean).join(' - ')}
            </p>
          )}
        </div>

        <Link className="button-link button-link--sm is-secondary" href={getSeatMapRoute(event.id)}>
          Modify seats
        </Link>
      </div>

      {holdTimeLeft !== null && (
        <div className={cn('basket-hold-banner', holdTimeLeft < 120 && 'is-expiring')}>
          <span>Seats held. Complete checkout before time runs out.</span>
          <span className="basket-hold-banner__timer">{formatHoldTime(holdTimeLeft)}</span>
        </div>
      )}

      <div className="basket-items">
        {seats.map((seat) => (
          <div key={seat.id} className="basket-item">
            <div className="basket-item__info">
              <div className="basket-item__seat">{seat.label}</div>
              <div className="basket-item__meta">
                {seat.sectionLabel} - Row {seat.rowLabel} - Seat {seat.seatNumber}
              </div>
            </div>
            <div className="basket-item__price">${seat.price}</div>
            <button
              type="button"
              className="basket-item__remove"
              aria-label={`Remove ${seat.label}`}
              disabled={isBusy}
              onClick={() => void onRemoveSeat(seat)}
            >
              x
            </button>
          </div>
        ))}
      </div>

      <dl className="basket-summary__breakdown basket-summary__breakdown--inline">
        <dt className="is-total">Total</dt><dd className="is-total">${pricing.total}</dd>
      </dl>

      <div className="page-actions" style={{ marginTop: 20 }}>
        <button className="button-link" type="button" onClick={() => onCheckout(event.id)}>
          Proceed to checkout
        </button>
      </div>
    </section>
  )
}

function BasketPage({ eventId: eventIdProp }) {
  usePageTitle('Basket')

  const router = useRouter()
  const eventWebSocket = useOptionalEventWebSocket()
  const {
    allItems,
    clearPurchaseError,
    isUpdatingSelection,
    purchaseError,
    setCurrentEvent,
    syncCurrentEventSelection,
    toggleSeatSelection,
  } = usePurchase()
  const eventId = eventIdProp ?? eventWebSocket?.eventId ?? allItems[0]?.event?.id ?? ''
  const activeItem = allItems.find((item) => item.event.id === eventId) ?? null
  const handledSocketMessageIdRef = useRef(0)

  useEffect(() => {
    if (!eventWebSocket?.messageQueue || !activeItem) {
      return
    }

    const pendingMessages = getPendingServerMessages(
      eventWebSocket.messageQueue,
      handledSocketMessageIdRef.current,
    )

    if (!pendingMessages.length) {
      return
    }

    let syncedSeats = activeItem.seats
    let holdExpiresAt = activeItem.holdExpiresAt
    let selectionChanged = false

    for (const { id: messageId, type, payload = {} } of pendingMessages) {
      handledSocketMessageIdRef.current = messageId

      if (type === 'snapshot') {
        const snapshot = normalizeSnapshotPayload(payload)
        syncedSeats = syncedSeats.filter((seat) => snapshot.myReserved.includes(seat.id))
        holdExpiresAt = snapshot.holdExpiresAt
        selectionChanged = true
        continue
      }

      if (type === 'released' && payload.seatId) {
        const nextSeats = syncedSeats.filter((seat) => seat.id !== payload.seatId)
        selectionChanged ||= nextSeats.length !== syncedSeats.length
        syncedSeats = nextSeats
        continue
      }

      if (type === 'purchased_bulk' && Array.isArray(payload.seatIds)) {
        const nextSeats = syncedSeats.filter((seat) => !payload.seatIds.includes(seat.id))
        selectionChanged ||= nextSeats.length !== syncedSeats.length
        syncedSeats = nextSeats
      }
    }

    if (selectionChanged) {
      syncCurrentEventSelection(eventId, syncedSeats, {
        holdExpiresAt: syncedSeats.length ? holdExpiresAt : null,
      })
    }

    eventWebSocket.acknowledgeMessages(pendingMessages[pendingMessages.length - 1].id)
  }, [
    activeItem,
    eventId,
    eventWebSocket?.acknowledgeMessages,
    eventWebSocket?.messageQueue,
    syncCurrentEventSelection,
  ])

  if (!allItems.length) {
    return (
      <PagePlaceholder
        eyebrow="Basket"
        title="Your basket is empty"
        description="Head to Explore to find an event, then choose your seats before reviewing your basket."
        actions={[
          { label: 'Open explore', to: routePaths.explore },
          { label: 'Browse favourites', to: routePaths.favorites, variant: 'secondary' },
        ]}
      />
    )
  }

  const handleRemoveSeat = async (eventId, seat) => {
    clearPurchaseError()
    setCurrentEvent(eventId)

    if (eventWebSocket && eventWebSocket.eventId === eventId) {
      if (!eventWebSocket.sendMessage('unreserve', { seatId: seat.id })) {
        return
      }

      const nextSeats = (allItems.find((item) => item.event.id === eventId)?.seats ?? [])
        .filter((currentSeat) => currentSeat.id !== seat.id)

      syncCurrentEventSelection(eventId, nextSeats)
      return
    }

    await toggleSeatSelection(seat, eventId)
  }

  const handleCheckout = (eventId) => {
    setCurrentEvent(eventId)
    router.push(getPurchaseRoute(eventId))
  }

  const grandTotal = allItems.reduce((sum, item) => {
    const pricing = calculatePricing(item.seats)
    return sum + pricing.total
  }, 0)

  return (
    <section className="basket-page page-stack">
      <section className="page-card">
        <span className="eyebrow">Basket</span>
        <h1>Your basket</h1>
        <p className="page-description">
          {allItems.length === 1
            ? `1 event - ${allItems[0].seats.length} seat${allItems[0].seats.length === 1 ? '' : 's'}`
            : `${allItems.length} events - ${allItems.reduce((sum, item) => sum + item.seats.length, 0)} seats total`}
        </p>
      </section>

      {purchaseError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Basket</div>
          <h2 className="sync-card__title">Unable to update seat selection</h2>
          <p className="sync-card__text">{purchaseError}</p>
        </section>
      ) : null}

      {eventWebSocket?.connectionError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Live availability</div>
          <h2 className="sync-card__title">Realtime connection unavailable</h2>
          <p className="sync-card__text">{eventWebSocket.connectionError}</p>
        </section>
      ) : null}

      <div className={cn('basket-layout', allItems.length === 1 && 'basket-layout--single')}>
        <div className="basket-groups">
          {allItems.map((item) => (
            <EventBasketGroup
              key={item.event.id}
              isBusy={isUpdatingSelection}
              item={item}
              onCheckout={handleCheckout}
              onRemoveSeat={(seat) => handleRemoveSeat(item.event.id, seat)}
            />
          ))}
        </div>

        {allItems.length > 1 && (
          <aside className="basket-summary">
            <section className="sync-card">
              <div className="sync-card__label">Summary</div>
              <h2 className="sync-card__title">All events</h2>

              <dl className="basket-summary__breakdown">
                {allItems.map((item) => {
                  const pricing = calculatePricing(item.seats)

                  return (
                    <div key={item.event.id} className="basket-summary__event-row">
                      <dt className="basket-summary__event-name">
                        {item.event.title}
                        <span className="basket-summary__event-seats">
                          {item.seats.length} seat{item.seats.length === 1 ? '' : 's'}
                        </span>
                      </dt>
                      <dd>${pricing.total}</dd>
                    </div>
                  )
                })}
                <dt className="is-total">Grand total</dt>
                <dd className="is-total">${grandTotal}</dd>
              </dl>
            </section>
          </aside>
        )}
      </div>
    </section>
  )
}

export default BasketPage
