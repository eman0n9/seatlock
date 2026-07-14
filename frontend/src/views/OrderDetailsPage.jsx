'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { routePaths } from 'app/routePaths'
import PagePlaceholder from 'components/ui/PagePlaceholder'
import { usePageTitle } from 'hooks/usePageTitle'
import { getMyOrderById } from 'lib/api/ticketApi'

function OrderDetailsPage({ orderId }) {
  usePageTitle('Order Details')

  const [order, setOrder] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOrder = async () => {
      try {
        setIsLoading(true)
        setError('')
        const nextOrder = await getMyOrderById(orderId)

        if (isMounted) {
          setOrder(nextOrder)
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError.message ?? 'Unable to load this order.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    void loadOrder()

    return () => {
      isMounted = false
    }
  }, [orderId])

  if (isLoading) {
    return (
      <section className="order-details-page page-stack">
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Order</div>
          <h1 className="sync-card__title">Loading order...</h1>
        </section>
      </section>
    )
  }

  if (error) {
    return (
      <PagePlaceholder
        eyebrow="Order"
        title="Unable to load this order"
        description={error}
        actions={[{ label: 'Back to My Orders', to: routePaths.orders }]}
      />
    )
  }

  if (!order) {
    return (
      <PagePlaceholder
        eyebrow="Order"
        title="Order not found"
        description="This order does not exist or is not available to your account."
        actions={[{ label: 'Back to My Orders', to: routePaths.orders }]}
      />
    )
  }

  const status = order.statusLabel ?? order.status
  const total = order.totalPriceLabel ?? order.totalLabel

  return (
    <section className="order-details-page page-stack">
      <section className="page-card">
        <span className="eyebrow">Order {order.id}</span>
        <h1>{order.eventTitle}</h1>
        <p className="page-description">
          {[order.eventDate, order.venue].filter(Boolean).join(' - ')}
        </p>
        <div className="page-actions" style={{ marginTop: 20 }}>
          <Link className="button-link is-secondary" href={routePaths.orders}>
            Back to My Orders
          </Link>
        </div>
      </section>

      <div className="order-details-layout">
        <section className="sync-card">
          <div className="sync-card__label">Tickets</div>
          <h2 className="sync-card__title">
            {order.tickets.length} ticket{order.tickets.length === 1 ? '' : 's'}
          </h2>

          <div className="ticket-grid" style={{ marginTop: 16 }}>
            {order.tickets.map((ticket) => (
              <article className="ticket-item-card" key={ticket.id}>
                <div className="ticket-qr-stub" aria-hidden="true">QR</div>
                <div className="ticket-item-card__info">
                  <p className="ticket-item-card__seat">{ticket.seatLabel}</p>
                  <p className="ticket-item-card__order">Ticket {ticket.id}</p>
                  <span className="ticket-status-badge">{ticket.statusLabel ?? status}</span>
                </div>
              </article>
            ))}
          </div>
        </section>

        <aside className="sync-card order-details-summary">
          <div className="sync-card__label">Summary</div>
          <h2 className="sync-card__title">Order details</h2>
          <div className="order-details-meta">
            <div className="order-details-meta__item">
              <span>Status</span>
              <strong>{status}</strong>
            </div>
            <div className="order-details-meta__item">
              <span>Total</span>
              <strong>{total}</strong>
            </div>
            <div className="order-details-meta__item">
              <span>Placed</span>
              <strong>{order.createdAt ? new Date(order.createdAt).toLocaleString() : 'Date unavailable'}</strong>
            </div>
          </div>
        </aside>
      </div>
    </section>
  )
}

export default OrderDetailsPage
