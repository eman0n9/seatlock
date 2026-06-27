'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getOrderDetailsRoute, routePaths } from 'app/routePaths'
import { getMyOrders } from 'lib/api/ticketApi'
import { usePageTitle } from 'hooks/usePageTitle'
import { cn } from 'utils/cn'

function statusClass(status) {
  const s = (status ?? '').toLowerCase()
  if (s === 'valid' || s === 'paid') return 'is-valid'
  if (s === 'confirmed') return 'is-confirmed'
  if (s === 'used') return 'is-used'
  if (s === 'cancelled' || s === 'canceled') return 'is-cancelled'
  if (s === 'pending' || s === 'reserved') return 'is-pending'
  return ''
}

function TicketStatusBadge({ status }) {
  return (
    <span className={cn('ticket-status-badge', statusClass(status))}>
      {status}
    </span>
  )
}

function hasDisplayValue(value) {
  if (value === null || value === undefined) {
    return false
  }

  return typeof value === 'string' ? value.trim() !== '' : true
}

function OrderCard({ order }) {
  const totalLabel = order.totalPriceLabel ?? order.totalLabel
  const status = order.statusLabel ?? order.status

  return (
    <Link className="ticket-order-card" href={getOrderDetailsRoute(order.id)}>
      <div className="ticket-order-card__info">
        <p className="ticket-order-card__title">{order.eventTitle}</p>
        <p className="ticket-order-card__meta">
          {[order.eventDate, order.venue].filter(Boolean).join(' - ')}
        </p>
        <TicketStatusBadge status={status} />
      </div>
      <div className="ticket-order-card__right">
        {hasDisplayValue(totalLabel) ? (
          <span className="ticket-order-card__total">{totalLabel}</span>
        ) : null}
        <span className="ticket-order-card__action">Open order</span>
      </div>
    </Link>
  )
}

function SkeletonCard({ count = 3 }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="ticket-skeleton" />
      ))}
    </>
  )
}

function MyTicketsPage() {
  usePageTitle('My Orders')

  const [orders, setOrders] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let isMounted = true

    const loadOrders = async () => {
      try {
        setIsLoading(true)
        setError('')
        const nextOrders = await getMyOrders()

        if (isMounted) {
          setOrders(nextOrders)
        }
      } catch (nextError) {
        if (isMounted) {
          setError(nextError.message ?? 'Unable to load order history.')
        }
      } finally {
        if (isMounted) {
          setIsLoading(false)
        }
      }
    }

    loadOrders()

    return () => {
      isMounted = false
    }
  }, [])

  return (
    <section className="tickets-page page-stack">
      <section className="page-card">
        <span className="eyebrow">My Orders</span>
        <h1>Your orders</h1>
        <p className="page-description">
          Open any order to review tickets, venue details, pricing and event schedule.
        </p>
        <div className="page-actions" style={{ marginTop: 20 }}>
          <Link className="button-link is-secondary" href={routePaths.explore}>
            Browse events
          </Link>
          <Link className="button-link is-secondary" href={routePaths.profile}>
            Open profile
          </Link>
        </div>
      </section>

      {error ? (
        <section className="sync-card sync-card--wide">
          <div className="sync-card__label">Error</div>
          <h2 className="sync-card__title">Unable to load order history</h2>
          <p className="sync-card__text">{error}</p>
        </section>
      ) : null}

      <section className="sync-card sync-card--wide">
        <div className="sync-card__label">Orders</div>
        <h2 className="sync-card__title">
          {isLoading ? 'Loading orders...' : `${orders.length} order${orders.length === 1 ? '' : 's'}`}
        </h2>

        <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          {isLoading ? (
            <SkeletonCard count={3} />
          ) : orders.length ? (
            orders.map((order) => <OrderCard key={order.id} order={order} />)
          ) : (
            <p className="profile-list-empty">
              No orders yet. Go to Explore, pick an event and choose your seats.
            </p>
          )}
        </div>
      </section>
    </section>
  )
}

export default MyTicketsPage
