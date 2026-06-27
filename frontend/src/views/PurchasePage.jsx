'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { getBasketRoute, getSeatMapRoute, routePaths } from 'app/routePaths'
import PurchaseSummary from 'components/purchase/PurchaseSummary'
import PagePlaceholder from 'components/ui/PagePlaceholder'
import { useAuth } from 'features/auth/useAuth'
import { useOptionalEventWebSocket } from 'features/purchase/EventWebSocketProvider'
import { normalizeSnapshotPayload } from 'features/purchase/socketPayloads'
import { usePurchase } from 'features/purchase/usePurchase'
import { getExploreActivityById } from 'lib/api/activityApi'
import { submitPurchase } from 'lib/api/purchaseApi'
import { usePageTitle } from 'hooks/usePageTitle'
import { cn } from 'utils/cn'

const PAYMENT_OPTIONS = [
  { id: 'Card', icon: 'CC', label: 'Card', sub: 'Visa / Mastercard' },
  { id: 'Apple Pay', icon: 'AP', label: 'Apple Pay', sub: 'Touch ID' },
  { id: 'Bank transfer', icon: 'BT', label: 'Bank transfer', sub: 'SEPA / Faster Payments' },
]

const DELIVERY_OPTIONS = ['Mobile transfer', 'Ticket PDF', 'Venue pickup']

function trimText(value) {
  return value?.trim() ?? ''
}

function CheckoutStepper({ step }) {
  const steps = ['Select seats', 'Review basket', 'Checkout']

  return (
    <div className="checkout-stepper">
      {steps.map((label, idx) => {
        const stepNum = idx + 1
        const isDone = step > stepNum
        const isActive = step === stepNum

        return (
          <div key={label} style={{ display: 'contents' }}>
            <div className={cn('checkout-step', isDone && 'is-done', isActive && 'is-active')}>
              <div className="checkout-step__number">
                {isDone ? 'OK' : stepNum}
              </div>
              <span>{label}</span>
            </div>
            {idx < steps.length - 1 && (
              <div className={cn('checkout-step__connector', isDone && 'is-done')} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function PurchasePage({ eventId: eventIdProp }) {
  usePageTitle('Checkout')

  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading: isAuthLoading, user } = useAuth()
  const eventWebSocket = useOptionalEventWebSocket()
  const {
    allItems,
    beginPurchase,
    pricing,
    removeEventFromBasket,
    selectedEvent,
    selectedSeats,
    setCurrentEvent,
    syncCurrentEventSelection,
  } = usePurchase()
  const eventId = eventIdProp ?? searchParams.get('event') ?? selectedEvent?.id ?? ''
  const [checkoutForm, setCheckoutForm] = useState({
    deliveryMethod: 'Mobile transfer',
    email: user?.email ?? '',
    fullName: '',
    note: '',
    paymentMethod: 'Card',
    phone: '',
  })
  const [confirmation, setConfirmation] = useState(null)
  const [error, setError] = useState('')
  const [isResolvingEvent, setIsResolvingEvent] = useState(false)
  const [resolveError, setResolveError] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const authIdentityRef = useRef(user?.id ?? user?.email ?? 'guest')
  const processedSocketMessageIdRef = useRef(0)

  useEffect(() => {
    if (!isAuthLoading && !isAuthenticated) {
      router.replace(routePaths.login)
    }
  }, [isAuthLoading, isAuthenticated, router])

  useEffect(() => {
    const nextIdentity = user?.id ?? user?.email ?? 'guest'

    if (authIdentityRef.current !== nextIdentity) {
      authIdentityRef.current = nextIdentity
      setCheckoutForm({
        deliveryMethod: 'Mobile transfer',
        email: user?.email ?? '',
        fullName: '',
        note: '',
        paymentMethod: 'Card',
        phone: '',
      })
      return
    }

    if (!user?.email) {
      return
    }

    setCheckoutForm((current) => (
      current.email ? current : { ...current, email: user.email }
    ))
  }, [user?.email, user?.id])

  useEffect(() => {
    if (!eventId || selectedEvent?.id === eventId) {
      setIsResolvingEvent(false)
      setResolveError('')
      return
    }

    const alreadyInBasket = allItems.some((item) => item.event.id === eventId)
    if (alreadyInBasket) {
      setCurrentEvent(eventId)
      setIsResolvingEvent(false)
      setResolveError('')
      return
    }

    let isMounted = true

    const resolveEvent = async () => {
      try {
        setIsResolvingEvent(true)
        setResolveError('')
        const event = await getExploreActivityById(eventId)

        if (!event) {
          throw new Error('The selected event could not be loaded for checkout.')
        }

        if (isMounted) {
          beginPurchase(event)
        }
      } catch (nextError) {
        if (isMounted) {
          setResolveError(nextError.message ?? 'Unable to load the selected event for checkout.')
        }
      } finally {
        if (isMounted) {
          setIsResolvingEvent(false)
        }
      }
    }

    resolveEvent()

    return () => {
      isMounted = false
    }
  }, [allItems, beginPurchase, eventId, selectedEvent?.id, setCurrentEvent])

  useEffect(() => {
    if (!selectedEvent || selectedEvent.id !== eventId) {
      return
    }

    const unreadMessages = (eventWebSocket?.messageLog ?? [])
      .filter((message) => message.id > processedSocketMessageIdRef.current)

    if (!unreadMessages.length) {
      return
    }

    processedSocketMessageIdRef.current = unreadMessages[unreadMessages.length - 1].id

    const eventMessages = unreadMessages.filter((message) => message.eventId === eventId)

    if (!eventMessages.length) {
      return
    }

    let nextSeats = selectedSeats
    let nextSelectionOptions
    let shouldSyncSelection = false

    const queueSelectionSync = (seats, options) => {
      nextSeats = seats
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
        queueSelectionSync(
          selectedSeats.filter((seat) => snapshot.myReserved.includes(seat.id)),
          { holdExpiresAt: snapshot.holdExpiresAt },
        )
        return
      }

      if (type === 'released' && payload.seatId) {
        queueSelectionSync(nextSeats.filter((seat) => seat.id !== payload.seatId))
        return
      }

      if (type === 'purchased_bulk' && Array.isArray(payload.seatIds)) {
        queueSelectionSync(nextSeats.filter((seat) => !payload.seatIds.includes(seat.id)))
      }
    })

    if (shouldSyncSelection) {
      syncCurrentEventSelection(eventId, nextSeats, nextSelectionOptions)
    }
  }, [eventId, eventWebSocket?.messageLog, selectedEvent, selectedSeats, syncCurrentEventSelection])

  const handleFieldChange = (field) => (event) => {
    setCheckoutForm((current) => ({ ...current, [field]: event.target.value }))
  }

  const handlePaymentSelect = (id) => {
    setCheckoutForm((current) => ({ ...current, paymentMethod: id }))
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    try {
      setIsSubmitting(true)
      setError('')

      const trimmedBuyer = {
        ...checkoutForm,
        email: trimText(checkoutForm.email),
        fullName: trimText(checkoutForm.fullName),
        note: trimText(checkoutForm.note),
        phone: trimText(checkoutForm.phone),
      }

      if (!trimmedBuyer.fullName || !trimmedBuyer.email || !trimmedBuyer.phone) {
        setCheckoutForm((current) => ({ ...current, ...trimmedBuyer }))
        setError('Full name, email and phone cannot be empty.')
        return
      }

      setCheckoutForm((current) => ({ ...current, ...trimmedBuyer }))
      const purchasedSeatIds = selectedSeats.map((seat) => seat.id)
      const nextConfirmation = await submitPurchase({
        buyer: trimmedBuyer,
        event: selectedEvent,
        pricing,
        selectedSeats,
      })

      eventWebSocket?.sendMessage('purchased', { seatIds: purchasedSeatIds })
      eventWebSocket?.closeConnection(1000, 'purchase-complete')
      setConfirmation(nextConfirmation)
      removeEventFromBasket(selectedEvent.id)
    } catch (nextError) {
      setError(nextError.message ?? 'Unable to complete purchase.')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (confirmation) {
    return (
      <section className="page-stack">
        <section className="page-card page-card--stack purchase-confirmation">
          <span className="eyebrow">Purchase confirmed</span>
          <h1>{confirmation.eventTitle}</h1>
          <p className="page-description">
            Your order is confirmed and available from My Orders.
          </p>

          <div className="purchase-confirmation__meta">
            <div>
              <span>Email</span>
              <strong>{confirmation.email}</strong>
            </div>
            <div>
              <span>Delivery</span>
              <strong>{confirmation.deliveryMethod}</strong>
            </div>
            <div>
              <span>Tickets</span>
              <strong>{confirmation.ticketCount} seat{confirmation.ticketCount === 1 ? '' : 's'}</strong>
            </div>
            <div>
              <span>Total</span>
              <strong>{confirmation.totalLabel}</strong>
            </div>
          </div>

          {confirmation.seats?.length > 0 && (
            <div className="confirmation-tickets">
              {confirmation.seats.map((seat, idx) => (
                <div key={idx} className="confirmation-ticket-row">
                  <span className="confirmation-ticket-row__seat">{seat}</span>
                  <span className="confirmation-ticket-row__badge">Valid</span>
                </div>
              ))}
            </div>
          )}

          <div className="page-actions">
            <Link className="button-link" href={routePaths.orders}>
              Open My Orders
            </Link>
            <Link className="button-link is-secondary" href={routePaths.explore}>
              Continue browsing
            </Link>
          </div>
        </section>
      </section>
    )
  }

  if (isAuthLoading || !isAuthenticated) {
    return null
  }

  if (!eventId && !selectedEvent) {
    return (
      <PagePlaceholder
        eyebrow="Checkout"
        title="Your cart is empty"
        description="Start with an event, choose seats, then this page becomes your checkout screen."
        actions={[
          { label: 'Open explore', to: routePaths.explore },
          { label: 'Open favourites', to: routePaths.favorites, variant: 'secondary' },
        ]}
      />
    )
  }

  if (isResolvingEvent) {
    return (
      <section className="page-stack">
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Checkout</div>
          <h2 className="sync-card__title">Loading order context</h2>
          <p className="sync-card__text">Restoring the selected event before opening checkout.</p>
        </section>
      </section>
    )
  }

  if (resolveError) {
    return (
      <section className="page-stack">
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Checkout</div>
          <h2 className="sync-card__title">Unable to load the selected event</h2>
          <p className="sync-card__text">{resolveError}</p>
          <div className="page-actions" style={{ marginTop: 20 }}>
            <Link className="button-link" href={routePaths.explore}>
              Open explore
            </Link>
            <Link className="button-link is-secondary" href={routePaths.basket}>
              Back to basket
            </Link>
          </div>
        </section>
      </section>
    )
  }

  if (!selectedEvent) {
    return (
      <PagePlaceholder
        eyebrow="Checkout"
        title="Select an event before checkout"
        description="The checkout page is ready, but it needs an active event context from Explore or Seat Map."
        actions={[
          { label: 'Open explore', to: routePaths.explore },
          { label: 'Choose seats', to: eventId ? getSeatMapRoute(eventId) : routePaths.seatMap, variant: 'secondary' },
        ]}
      />
    )
  }

  if (!selectedSeats.length) {
    return (
      <PagePlaceholder
        eyebrow="Checkout"
        title="Select seats before checkout"
        description="Your purchase flow is active, but there are no selected seats in the current basket."
        actions={[
          { label: 'Back to basket', to: getBasketRoute(selectedEvent.id) },
          { label: 'Open seat map', to: getSeatMapRoute(selectedEvent.id), variant: 'secondary' },
        ]}
      />
    )
  }

  return (
    <section className="purchase-page page-stack">
      <section className="page-card page-card--stack">
        <span className="eyebrow">Checkout</span>
        <h1>Complete your order</h1>
        <CheckoutStepper step={3} />
      </section>

      {error ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Checkout</div>
          <h2 className="sync-card__title">Unable to complete purchase</h2>
          <p className="sync-card__text">{error}</p>
        </section>
      ) : null}

      <section className="purchase-layout">
        <form className="sync-card checkout-form" onSubmit={handleSubmit}>
          <div className="sync-card__label">Buyer details</div>
          <h2 className="sync-card__title">Your information</h2>

          <div className="checkout-form__grid">
            <label className="checkout-field">
              <span>Full name</span>
              <input
                className="auth-panel__input"
                name="fullName"
                required
                type="text"
                value={checkoutForm.fullName}
                onChange={handleFieldChange('fullName')}
              />
            </label>

            <label className="checkout-field">
              <span>Email</span>
              <input
                className="auth-panel__input"
                name="email"
                required
                type="email"
                value={checkoutForm.email}
                onChange={handleFieldChange('email')}
                placeholder={isAuthenticated ? '' : 'you@example.com'}
              />
            </label>

            <label className="checkout-field">
              <span>Phone</span>
              <input
                className="auth-panel__input"
                name="phone"
                required
                type="tel"
                value={checkoutForm.phone}
                onChange={handleFieldChange('phone')}
              />
            </label>

            <label className="checkout-field">
              <span>Delivery method</span>
              <select
                className="auth-panel__input"
                name="deliveryMethod"
                value={checkoutForm.deliveryMethod}
                onChange={handleFieldChange('deliveryMethod')}
              >
                {DELIVERY_OPTIONS.map((opt) => <option key={opt}>{opt}</option>)}
              </select>
            </label>

            <label className="checkout-field checkout-field--wide">
              <span>Order note (optional)</span>
              <textarea
                className="auth-panel__input checkout-field__textarea"
                name="note"
                rows={3}
                value={checkoutForm.note}
                onChange={handleFieldChange('note')}
              />
            </label>
          </div>

          <div style={{ marginTop: 20 }}>
            <div className="sync-card__label" style={{ marginBottom: 10 }}>Payment</div>
            <div className="payment-picker">
              {PAYMENT_OPTIONS.map((opt) => (
                <button
                  key={opt.id}
                  type="button"
                  className={cn('payment-option', checkoutForm.paymentMethod === opt.id && 'is-selected')}
                  onClick={() => handlePaymentSelect(opt.id)}
                >
                  <span className="payment-option__icon" aria-hidden="true">{opt.icon}</span>
                  <span className="payment-option__label">{opt.label}</span>
                  <span className="payment-option__sub">{opt.sub}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="page-actions">
            <button className="button-link" type="submit" disabled={isSubmitting}>
              {isSubmitting ? 'Processing...' : 'Complete purchase'}
            </button>
            <Link className="button-link is-secondary" href={getBasketRoute(selectedEvent.id)}>
              Back to basket
            </Link>
          </div>
        </form>

        <PurchaseSummary
          event={selectedEvent}
          note="Review the order details before completing checkout."
          pricing={pricing}
          selectedSeats={selectedSeats}
          title="Order summary"
        />
      </section>
    </section>
  )
}

export default PurchasePage
