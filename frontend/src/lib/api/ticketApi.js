import { mockOrders, mockTickets } from 'lib/api/mock/ticketMocks'
import { readStoredOrders, readStoredTickets } from 'lib/api/mock/purchaseStorage'
import { mapOrderToViewModel, mapTicketToViewModel } from 'lib/api/mappers/ticketMapper'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import { GET_ORDERS_QUERY } from 'lib/api/graphql/queries'
import { isProfileMockEnabled } from 'lib/api/runtime'

const ORDER_PLACEHOLDERS = new Set([
  'Date TBA',
  'Event details unavailable',
  'Venue TBA',
])

function isMissingOrderValue(value) {
  return value == null || value === '' || ORDER_PLACEHOLDERS.has(value)
}

function pickPreferredValue(primary, fallback) {
  if (isMissingOrderValue(primary) && !isMissingOrderValue(fallback)) {
    return fallback
  }

  return primary
}

function mapBackendTicket(order, ticket) {
  return mapTicketToViewModel({
    id: ticket.id,
    orderId: order.id,
    seat: {
      rowNumber: ticket.rowNumber,
      seatNumber: ticket.seatNumber,
    },
    status: order.status,
  })
}

function buildOrderDetails(order, tickets) {
  const orderTickets = (tickets ?? []).filter(
    (ticket) => String(ticket.orderId) === String(order.id),
  )
  const ticketWithContext = orderTickets.find(
    (ticket) => ticket.activity || ticket.eventTitle || ticket.eventDate || ticket.venue,
  )
  const activity = order.activity ?? ticketWithContext?.activity ?? null

  return {
    ...order,
    activity,
    eventDate: pickPreferredValue(order.eventDate, ticketWithContext?.eventDate),
    eventTitle: pickPreferredValue(order.eventTitle, ticketWithContext?.eventTitle),
    tickets: orderTickets,
    venue: pickPreferredValue(order.venue, ticketWithContext?.venue),
  }
}

export async function getMyOrders() {
  if (isProfileMockEnabled()) {
    return [...readStoredOrders(), ...mockOrders].map(mapOrderToViewModel)
  }

  const data = await fetchGraphQL(GET_ORDERS_QUERY)
  return (data?.getOrders ?? []).map(mapOrderToViewModel)
}

export async function getMyTickets() {
  if (isProfileMockEnabled()) {
    return [...readStoredTickets(), ...mockTickets].map(mapTicketToViewModel)
  }

  const data = await fetchGraphQL(GET_ORDERS_QUERY)
  const rawOrders = data?.getOrders ?? []

  return rawOrders.flatMap((order) =>
    (order.tickets ?? []).map((ticket) => mapBackendTicket(order, ticket)),
  )
}

export async function getMyOrderById(orderId) {
  if (!orderId) {
    return null
  }

  const [orders, tickets] = await Promise.all([getMyOrders(), getMyTickets()])
  const order = orders.find((item) => String(item.id) === String(orderId))

  if (!order) {
    return null
  }

  return buildOrderDetails(order, tickets)
}
