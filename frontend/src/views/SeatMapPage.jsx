'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { routePaths, getBasketRoute } from 'app/routePaths'
import PurchaseSummary from 'components/purchase/PurchaseSummary'
import PagePlaceholder from 'components/ui/PagePlaceholder'
import { useOptionalEventWebSocket } from 'features/purchase/EventWebSocketProvider'
import { normalizeSnapshotPayload } from 'features/purchase/socketPayloads'
import { usePurchase } from 'features/purchase/usePurchase'
import { formatHoldTime } from 'features/purchase/purchaseUtils'
import { usePageTitle } from 'hooks/usePageTitle'
import { getExploreActivityById } from 'lib/api/activityApi'
import { getSeatMap } from 'lib/api/purchaseApi'
import { SEAT_LIVE_STATES, createSeatLiveState } from 'lib/api/seatModels'
import { cn } from 'utils/cn'

function SeatMapLegend() {
  return (
    <div className="seat-map-legend">
      <div><span className="seat-map-legend__swatch" /> Available</div>
      <div><span className="seat-map-legend__swatch is-selected" /> Selected</div>
      <div><span className="seat-map-legend__swatch is-sold" /> Sold</div>
      <div><span className="seat-map-legend__swatch is-held" /> Held</div>
    </div>
  )
}

function SeatMapPage({ eventId: eventIdProp }) {
  usePageTitle('Seat Map')

  const router = useRouter()
  const searchParams = useSearchParams()
  const eventSocket = useOptionalEventWebSocket()
  const {
    beginPurchase,
    clearPurchaseError,
    holdTimeLeft,
    isUpdatingSelection,
    isSeatSelected,
    pricing,
    purchaseError,
    selectedEvent,
    selectedSeats,
    syncCurrentEventSelection,
  } = usePurchase()
  const eventId = eventIdProp ?? searchParams.get('event') ?? selectedEvent?.id ?? ''

  // Ref to read the latest selectedEvent in the loading effect without
  // making it a reactive dependency (which would cause an infinite re-fetch
  // because beginPurchase always produces a new object reference).
  const selectedEventRef = useRef(selectedEvent)
  const processedSocketMessageIdRef = useRef(0)
  selectedEventRef.current = selectedEvent

  const [seatMap, setSeatMap] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')
  const [seatActionError, setSeatActionError] = useState('')
  const [liveSeatStateById, setLiveSeatStateById] = useState({})

  const seatsById = useMemo(
    () => seatMap?.sections.flatMap((section) => section.rows.flatMap((row) => row.seats)).reduce((accumulator, seat) => {
      accumulator[seat.id] = seat
      return accumulator
    }, {}) ?? {},
    [seatMap],
  )

  const handleSeatToggle = async (seat) => {
    clearPurchaseError()
    setSeatActionError('')

    const currentLiveState = liveSeatStateById[seat.id] ?? SEAT_LIVE_STATES.FREE

    if (currentLiveState === SEAT_LIVE_STATES.FREE) {
      setLiveSeatStateById((current) => ({
        ...current,
        [seat.id]: SEAT_LIVE_STATES.MY_RESERVED,
      }))
      syncCurrentEventSelection(eventId, [...selectedSeats, seat])
      eventSocket?.sendMessage('reserve', { seatId: seat.id })
      return
    }

    if (currentLiveState === SEAT_LIVE_STATES.MY_RESERVED) {
      setLiveSeatStateById((current) => ({
        ...current,
        [seat.id]: SEAT_LIVE_STATES.FREE,
      }))
      syncCurrentEventSelection(
        eventId,
        selectedSeats.filter((selectedSeat) => selectedSeat.id !== seat.id),
      )
      eventSocket?.sendMessage('unreserve', { seatId: seat.id })
      return
    }
  }

  useEffect(() => {
    clearPurchaseError()
  }, [clearPurchaseError, eventId])

  useEffect(() => {
    if (!eventId) {
      setSeatMap(null)
      setIsLoading(false)
      return
    }

    let isMounted = true
    const abortController = new AbortController()

    const loadSeatMap = async () => {
      try {
        setIsLoading(true)
        setError('')

        const cachedEvent = selectedEventRef.current
        const [resolvedEvent, nextSeatMap] = await Promise.all([
          cachedEvent?.id === eventId
            ? Promise.resolve(cachedEvent)
            : getExploreActivityById(eventId, { signal: abortController.signal }),
          getSeatMap({ eventId }),
        ])

        if (!resolvedEvent) {
          throw new Error('Choose an event from Explore before selecting seats.')
        }

        if (!nextSeatMap) {
          throw new Error('Seat map is not available for this event yet.')
        }

        if (isMounted) {
          beginPurchase(resolvedEvent)
          setSeatMap(nextSeatMap)
          const staticSeats = nextSeatMap.sections.flatMap((section) =>
            section.rows.flatMap((row) => row.seats.map((seat) => ({
              seatId: seat.id,
              seatNumber: seat.seatNumber,
              rowNumber: seat.rowNumber,
            }))),
          )
          const purchased = nextSeatMap.sections.flatMap((section) =>
            section.rows.flatMap((row) => row.seats)
              .filter((seat) => seat.liveState === SEAT_LIVE_STATES.PURCHASED)
              .map((seat) => seat.id),
          )

          setLiveSeatStateById(createSeatLiveState({
            seats: staticSeats,
            purchased,
            myReserved: [],
            otherReserved: [],
          }))
        }
      } catch (nextError) {
        if (isMounted && !abortController.signal.aborted) {
          setError(nextError.message ?? 'Unable to load seat map.')
          setSeatMap(null)
        }
      } finally {
        if (isMounted && !abortController.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadSeatMap()

    return () => {
      isMounted = false
      abortController.abort()
    }
  }, [beginPurchase, eventId])

  useEffect(() => {
    if (!seatMap) {
      return
    }

    const unreadMessages = (eventSocket?.messageLog ?? [])
      .filter((message) => message.id > processedSocketMessageIdRef.current)

    if (!unreadMessages.length) {
      return
    }

    processedSocketMessageIdRef.current = unreadMessages[unreadMessages.length - 1].id

    const eventMessages = unreadMessages.filter((message) => message.eventId === eventId)

    if (!eventMessages.length) {
      return
    }

    let nextSelectedSeats = selectedSeats
    let nextSelectionOptions
    let shouldSyncSelection = false

    const queueSelectionSync = (seats, options) => {
      nextSelectedSeats = seats
      nextSelectionOptions = options
      shouldSyncSelection = true
    }

    eventMessages.forEach((message) => {
      const { type } = message
      const payload = message.payload && typeof message.payload === 'object'
        ? message.payload
        : {}

      if (type === 'snapshot') {
        const snapshot = normalizeSnapshotPayload(payload)
        const staticSeats = seatMap.sections.flatMap((section) =>
          section.rows.flatMap((row) => row.seats.map((seat) => ({
            seatId: seat.id,
            seatNumber: seat.seatNumber,
            rowNumber: seat.rowNumber,
          }))),
        )

        setLiveSeatStateById(createSeatLiveState({
          seats: staticSeats,
          purchased: snapshot.purchased,
          myReserved: snapshot.myReserved,
          otherReserved: snapshot.otherReserved,
        }))

        const restoredSeats = snapshot.myReserved
          .map((seatId) => seatsById[seatId])
          .filter(Boolean)

        queueSelectionSync(restoredSeats, {
          holdExpiresAt: snapshot.holdExpiresAt,
        })
        return
      }

      if (type === 'reserved' && payload.seatId) {
        setLiveSeatStateById((current) => ({
          ...current,
          [payload.seatId]: SEAT_LIVE_STATES.OTHER_RESERVED,
        }))
        return
      }

      if (type === 'released' && payload.seatId) {
        setLiveSeatStateById((current) => ({
          ...current,
          [payload.seatId]: SEAT_LIVE_STATES.FREE,
        }))
        queueSelectionSync(
          nextSelectedSeats.filter((seat) => seat.id !== payload.seatId),
        )
        return
      }

      if (type === 'purchased_bulk' && Array.isArray(payload.seatIds)) {
        setLiveSeatStateById((current) => {
          const nextState = { ...current }
          payload.seatIds.forEach((seatId) => {
            nextState[seatId] = SEAT_LIVE_STATES.PURCHASED
          })
          return nextState
        })
        queueSelectionSync(
          nextSelectedSeats.filter((seat) => !payload.seatIds.includes(seat.id)),
        )
        return
      }

      if (type === 'reserve_failed' && payload.seatId) {
        setSeatActionError('That seat was taken just before your click.')
        setLiveSeatStateById((current) => ({
          ...current,
          [payload.seatId]: SEAT_LIVE_STATES.OTHER_RESERVED,
        }))
        queueSelectionSync(
          nextSelectedSeats.filter((seat) => seat.id !== payload.seatId),
        )
      }
    })

    if (shouldSyncSelection) {
      syncCurrentEventSelection(eventId, nextSelectedSeats, nextSelectionOptions)
    }
  }, [eventId, eventSocket?.messageLog, seatMap, seatsById, selectedSeats, syncCurrentEventSelection])

  if (!eventId) {
    return (
      <PagePlaceholder
        eyebrow="Seat map"
        title="Pick an event before choosing seats"
        description="The seat map page is ready, but it needs an event context from Explore or Favourites."
        actions={[
          { label: 'Open explore', to: routePaths.explore },
          { label: 'Open favourites', to: routePaths.favorites, variant: 'secondary' },
        ]}
      />
    )
  }

  return (
    <section className="seat-map-page page-stack">
      <section className="page-card seat-map-hero">
        <span className="eyebrow">Seat map</span>
        <h1>{seatMap?.event?.title ?? selectedEvent?.title ?? 'Choose your seats'}</h1>
        <p className="page-description">
          Select seats first, then review your basket and complete checkout.
        </p>
      </section>

      {error ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Seat map</div>
          <h2 className="sync-card__title">Unable to load seats</h2>
          <p className="sync-card__text">{error}</p>
        </section>
      ) : null}

      {purchaseError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Seat selection</div>
          <h2 className="sync-card__title">Unable to update seat hold</h2>
          <p className="sync-card__text">{purchaseError}</p>
        </section>
      ) : null}

      {seatActionError ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Seat selection</div>
          <h2 className="sync-card__title">Seat status changed</h2>
          <p className="sync-card__text">{seatActionError}</p>
        </section>
      ) : null}

      {isLoading ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Seat map</div>
          <h2 className="sync-card__title">Loading seat availability</h2>
          <p className="sync-card__text">
            Preparing the seating layout for the selected event.
          </p>
        </section>
      ) : null}

      {!isLoading && seatMap ? (
        <section className="seat-map-layout">
          <section className="sync-card seat-map-canvas">
            <div className="sync-card__label">Venue layout</div>
            <div className="seat-map-canvas__header">
              <div>
                <h2 className="sync-card__title">{seatMap.event.venue}</h2>
                <p className="sync-card__text">{seatMap.availabilityNote}</p>
              </div>
              <SeatMapLegend />
            </div>

            <div className="seat-map-front">
              <span>{seatMap.stageLabel}</span>
            </div>

            <div className="seat-map-sections">
              {seatMap.sections.map((section) => (
                <section key={section.id} className="seat-map-section">
                  <header className="seat-map-section__header">
                    <div>
                      <strong>{section.label}</strong>
                      <p>{section.priceLabel}</p>
                    </div>
                  </header>

                  <div className="seat-map-rows">
                    {section.rows.map((row) => (
                      <div key={row.id} className="seat-map-row">
                        <span className="seat-map-row__label">{row.label}</span>

                        <div className="seat-map-row__seats">
                          {row.seats.map((seat) => {
                            const isSelected = isSeatSelected(seat.id)
                            const liveState = liveSeatStateById[seat.id] ?? seat.liveState ?? SEAT_LIVE_STATES.FREE
                            const isSold = liveState === SEAT_LIVE_STATES.PURCHASED
                            const isHeld = liveState === SEAT_LIVE_STATES.OTHER_RESERVED
                            const isMine = liveState === SEAT_LIVE_STATES.MY_RESERVED

                            return (
                              <button
                                key={seat.id}
                                type="button"
                                className={cn(
                                  'seat-map-seat',
                                  (isSelected || isMine) && 'is-selected',
                                  isSold && 'is-sold',
                                  isHeld && 'is-held',
                                )}
                                disabled={isSold || isHeld || isUpdatingSelection}
                                aria-label={seat.label}
                                onClick={() => void handleSeatToggle(seat)}
                              >
                                <span>{seat.seatNumber}</span>
                              </button>
                            )
                          })}
                        </div>

                        <span className="seat-map-row__label">{row.label}</span>
                      </div>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </section>

          <PurchaseSummary
            event={seatMap.event}
            note={holdTimeLeft !== null
              ? `Seats held for ${formatHoldTime(holdTimeLeft)} - complete checkout before time runs out.`
              : selectedSeats.length > 0
                ? `${selectedSeats.length} seat${selectedSeats.length === 1 ? '' : 's'} selected.`
                : 'Select seats to continue.'
            }
            pricing={pricing}
            selectedSeats={selectedSeats}
            title="Selection summary"
            footer={(
              <>
                {holdTimeLeft !== null && (
                  <div className={cn('hold-countdown', holdTimeLeft < 120 && 'is-expiring')}>
                    <span>Seats held for</span>
                    <strong>{formatHoldTime(holdTimeLeft)}</strong>
                  </div>
                )}
                <button
                  className="button-link purchase-summary__button"
                  type="button"
                  style={{ marginTop: 8 }}
                  disabled={!selectedSeats.length}
                  onClick={() => router.push(getBasketRoute(eventId))}
                >
                  Continue to basket
                </button>
              </>
            )}
          />
        </section>
      ) : null}
    </section>
  )
}

export default SeatMapPage
