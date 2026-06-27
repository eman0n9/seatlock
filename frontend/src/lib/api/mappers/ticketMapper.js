import {
  formatCurrency,
  formatOfferTypeLabel,
  formatSeatLabel,
} from 'lib/api/purchaseModel'

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  weekday: 'short',
})

function formatDateLabel(value) {
  if (!value) {
    return 'Date TBA'
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return value
  }

  return DATE_FORMATTER.format(date).replace(',', '')
}

function formatVenue(activity) {
  const hallName = activity?.hall?.name ?? ''
  const hallCity = activity?.hall?.city ?? ''

  return [hallName, hallCity].filter(Boolean).join(' - ') || 'Venue TBA'
}

function formatEnumLabel(value, fallback) {
  if (!value) {
    return fallback
  }

  return value
    .toString()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function getActivityFromOrder(order) {
  return order.activity ?? order.tickets?.[0]?.activity ?? order.tickets?.[0]?.offer?.activity ?? null
}

export function mapOrderToViewModel(order) {
  const activity = getActivityFromOrder(order)

  return {
    ...order,
    activity,
    eventDate: order.eventDate ?? formatDateLabel(activity?.date),
    eventTitle: order.eventTitle ?? activity?.name ?? 'Event details unavailable',
    id: order.id,
    statusLabel: order.statusLabel ?? formatEnumLabel(order.status, 'Pending'),
    ticketCount: order.tickets?.length ?? 0,
    totalPriceLabel: order.totalPriceLabel ?? order.totalLabel ?? formatCurrency(order.totalPrice),
    venue: order.venue ?? formatVenue(activity),
  }
}

export function mapTicketToViewModel(ticket) {
  const activity = ticket.activity ?? ticket.offer?.activity ?? null

  return {
    ...ticket,
    activity,
    eventDate: ticket.eventDate ?? formatDateLabel(activity?.date),
    eventTitle: ticket.eventTitle ?? activity?.name ?? 'Untitled event',
    id: ticket.id,
    offerTypeLabel: ticket.offerTypeLabel ?? formatOfferTypeLabel(ticket.offer?.type),
    orderId: ticket.order?.id ?? ticket.orderId ?? 'Order TBA',
    seatLabel: ticket.seatLabel ?? formatSeatLabel(ticket.seat),
    statusLabel: ticket.statusLabel ?? formatEnumLabel(ticket.status, 'Unknown'),
    venue: ticket.venue ?? formatVenue(activity),
  }
}
