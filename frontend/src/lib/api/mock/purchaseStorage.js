import { formatPrice } from 'features/purchase/purchaseUtils'
import { enrichPurchaseEvent } from 'lib/api/purchaseModel'

const ORDERS_STORAGE_KEY = 'seatlock.purchase.orders'
const TICKETS_STORAGE_KEY = 'seatlock.purchase.tickets'
const SOLD_SEATS_STORAGE_KEY = 'seatlock.purchase.soldSeats'

function readStorage(key, fallbackValue) {
  if (typeof window === 'undefined') {
    return fallbackValue
  }

  try {
    const value = window.localStorage.getItem(key)

    if (!value) {
      return fallbackValue
    }

    return JSON.parse(value)
  } catch {
    return fallbackValue
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readStoredOrders() {
  const value = readStorage(ORDERS_STORAGE_KEY, [])
  return Array.isArray(value) ? value : []
}

export function readStoredTickets() {
  const value = readStorage(TICKETS_STORAGE_KEY, [])
  return Array.isArray(value) ? value : []
}

export function readSoldSeatIds(eventId) {
  const soldSeatsByEvent = readStorage(SOLD_SEATS_STORAGE_KEY, {})
  const value = soldSeatsByEvent?.[eventId]

  return Array.isArray(value) ? value : []
}

function extractTimeRange(event) {
  const timeLabel = event?.timeLabel ?? ''
  const [rangeStart, rangeEnd] = timeLabel.split('-').map((value) => value.trim()).filter(Boolean)

  return {
    endTime: event?.endTime ?? rangeEnd ?? null,
    startTime: event?.startTime ?? rangeStart ?? (timeLabel && !timeLabel.includes('-') ? timeLabel : null),
  }
}

function buildActivitySnapshot(event) {
  const nextEvent = enrichPurchaseEvent(event)
  const { startTime, endTime } = extractTimeRange(nextEvent)

  return {
    date: nextEvent?.dateRaw ?? nextEvent?.dateLabel ?? null,
    hall: nextEvent?.hall
      ? {
          address: nextEvent.hall.address ?? '',
          city: nextEvent.hall.city ?? '',
          id: nextEvent.hall.id ?? null,
          name: nextEvent.hall.name ?? '',
        }
      : null,
    endTime,
    id: nextEvent?.id ?? null,
    name: nextEvent?.title ?? nextEvent?.name ?? 'Untitled Event',
    startTime,
  }
}

export function recordPurchase({ buyer, event, pricing, selectedSeats }) {
  const timestamp = Date.now()
  const orderId = `order-${timestamp}`
  const activity = buildActivitySnapshot(event)
  const order = {
    activity,
    id: orderId,
    buyerEmail: buyer.email,
    createdAt: new Date(timestamp).toISOString(),
    eventTitle: event.title,
    eventDate: event.dateLabel,
    venue: event.venue,
    status: 'Confirmed',
    totalLabel: formatPrice(pricing.total),
  }
  const tickets = selectedSeats.map((seat, index) => ({
    activity,
    eventDate: event.dateLabel,
    eventTitle: event.title,
    id: `ticket-${timestamp}-${index + 1}`,
    seatLabel: seat.label,
    orderId,
    status: 'Valid',
    venue: event.venue,
  }))
  const soldSeatsByEvent = readStorage(SOLD_SEATS_STORAGE_KEY, {})
  const currentSoldSeatIds = Array.isArray(soldSeatsByEvent[event.id])
    ? soldSeatsByEvent[event.id]
    : []

  writeStorage(ORDERS_STORAGE_KEY, [order, ...readStoredOrders()])
  writeStorage(TICKETS_STORAGE_KEY, [...tickets, ...readStoredTickets()])
  writeStorage(SOLD_SEATS_STORAGE_KEY, {
    ...soldSeatsByEvent,
    [event.id]: [...new Set([...currentSoldSeatIds, ...selectedSeats.map((seat) => seat.id)])],
  })

  return { order, tickets }
}
