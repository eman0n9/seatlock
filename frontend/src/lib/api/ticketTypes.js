const TICKET_TYPE_META = Object.freeze({
  VIP: { label: 'VIP', color: '#8b5cf6' },
  STANDARD: { label: 'Standard', color: '#3b82f6' },
  ECONOMY: { label: 'Economy', color: '#22c55e' },
})

export function getTicketTypeMeta(ticketType) {
  const normalizedType = ticketType?.toString().trim().toUpperCase()
  return TICKET_TYPE_META[normalizedType] ?? TICKET_TYPE_META.STANDARD
}
