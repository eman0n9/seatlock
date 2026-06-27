import { getExploreActivityById } from 'lib/api/activityApi'
import { readSoldSeatIds, recordPurchase } from 'lib/api/mock/purchaseStorage'
import { formatPrice } from 'features/purchase/purchaseUtils'
import { getTicketTypeMeta } from 'lib/api/ticketTypes'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import { SEAT_MAP_QUERY, GET_ORDERS_QUERY } from 'lib/api/graphql/queries'
import { RESERVE_SEATS_MUTATION, CANCEL_RESERVATION_MUTATION, CHECKOUT_MUTATION } from 'lib/api/graphql/mutations'
import { isPurchaseMockEnabled } from 'lib/api/runtime'
import { SEAT_LIVE_STATES, createSeatLiveState } from 'lib/api/seatModels'

const BASE_PRICE_BY_TIER = {
  $: 39,
  $$: 64,
  $$$: 118,
  $$$$: 172,
}

const SEAT_LAYOUTS = {
  concerts: [
    {
      id: 'front-floor',
      label: 'Front Floor',
      multiplier: 1.45,
      rows: [
        ['A', 8],
        ['B', 10],
        ['C', 10],
      ],
      sold: ['A-2', 'B-5', 'C-9'],
      held: ['A-3', 'B-7'],
    },
    {
      id: 'lower-bowl',
      label: 'Lower Bowl',
      multiplier: 1.1,
      rows: [
        ['D', 10],
        ['E', 10],
        ['F', 10],
      ],
      sold: ['D-4', 'E-8'],
      held: ['D-6', 'F-3'],
    },
    {
      id: 'upper-tier',
      label: 'Upper Tier',
      multiplier: 0.82,
      rows: [
        ['G', 12],
        ['H', 12],
      ],
      sold: ['G-3', 'H-10'],
      held: ['G-7'],
    },
  ],
  sports: [
    {
      id: 'west-stand',
      label: 'West Stand',
      multiplier: 1.25,
      rows: [
        ['A', 10],
        ['B', 12],
        ['C', 12],
      ],
      sold: ['A-1', 'B-6', 'C-11'],
      held: ['A-4', 'B-9'],
    },
    {
      id: 'east-stand',
      label: 'East Stand',
      multiplier: 1,
      rows: [
        ['D', 12],
        ['E', 12],
        ['F', 12],
      ],
      sold: ['D-5', 'E-7'],
      held: ['D-3', 'F-8'],
    },
    {
      id: 'north-stand',
      label: 'North Stand',
      multiplier: 0.78,
      rows: [
        ['G', 14],
        ['H', 14],
      ],
      sold: ['G-8', 'H-2', 'H-13'],
      held: ['G-5'],
    },
  ],
  theater: [
    {
      id: 'orchestra',
      label: 'Orchestra',
      multiplier: 1.38,
      rows: [
        ['A', 8],
        ['B', 8],
        ['C', 8],
      ],
      sold: ['A-4', 'B-3', 'C-7'],
      held: ['A-6', 'B-5'],
    },
    {
      id: 'mezzanine',
      label: 'Mezzanine',
      multiplier: 1.05,
      rows: [
        ['D', 10],
        ['E', 10],
      ],
      sold: ['D-6', 'E-2'],
      held: ['D-4'],
    },
    {
      id: 'balcony',
      label: 'Balcony',
      multiplier: 0.72,
      rows: [
        ['F', 10],
        ['G', 10],
      ],
      sold: ['F-8', 'G-5'],
      held: ['F-3', 'G-7'],
    },
  ],
  festivals: [
    {
      id: 'gold-circle',
      label: 'Gold Circle',
      multiplier: 1.3,
      rows: [
        ['A', 10],
        ['B', 10],
      ],
      sold: ['A-5', 'B-2'],
      held: ['A-3', 'B-8'],
    },
    {
      id: 'field',
      label: 'Field',
      multiplier: 1,
      rows: [
        ['C', 12],
        ['D', 12],
      ],
      sold: ['C-4', 'D-9'],
      held: ['C-7'],
    },
    {
      id: 'rear-view',
      label: 'Rear View',
      multiplier: 0.7,
      rows: [
        ['E', 14],
        ['F', 14],
      ],
      sold: ['E-7', 'F-11'],
      held: ['E-4', 'F-9'],
    },
  ],
  default: [
    {
      id: 'section-a',
      label: 'Section A',
      multiplier: 1.2,
      rows: [
        ['A', 8],
        ['B', 8],
      ],
      sold: ['A-2', 'B-6'],
      held: ['A-5'],
    },
    {
      id: 'section-b',
      label: 'Section B',
      multiplier: 0.9,
      rows: [
        ['C', 10],
        ['D', 10],
      ],
      sold: ['C-4', 'D-8'],
      held: ['C-7'],
    },
  ],
}


function getStageLabel(category) {
  if (category === 'sports') {
    return 'Pitch'
  }

  return 'Stage'
}

const PURCHASE_STATUS_MAP = {
  [SEAT_LIVE_STATES.FREE]: 'available',
  [SEAT_LIVE_STATES.MY_RESERVED]: 'held',
  [SEAT_LIVE_STATES.OTHER_RESERVED]: 'held',
  [SEAT_LIVE_STATES.PURCHASED]: 'sold',
}

function createManagedSeatId(hallId, rowNumber, seatNumber) {
  return `seat-${hallId ?? 'managed'}-${rowNumber}-${seatNumber}`
}

function normalizeManagedSeat(seat, hallId, rowNumber, fallbackSeatNumber) {
  const seatNumber = Number(seat?.seatNumber ?? seat?.seat ?? fallbackSeatNumber)
  const resolvedRowNumber = Number(seat?.rowNumber ?? seat?.row ?? rowNumber)

  if (!Number.isFinite(seatNumber) || !Number.isFinite(resolvedRowNumber)) {
    return null
  }

  return {
    id: seat?.id ?? createManagedSeatId(hallId, resolvedRowNumber, seatNumber),
    rowNumber: resolvedRowNumber,
    seatNumber,
  }
}

function normalizeManagedRows(hall) {
  const rows = Array.isArray(hall?.rows) ? hall.rows : []

  return rows
    .map((row) => {
      const rowNumber = Number(row?.number ?? row?.rowNumber)

      if (!Number.isFinite(rowNumber)) {
        return null
      }

      const seats = Array.isArray(row?.seats)
        ? row.seats
          .map((seat, index) => normalizeManagedSeat(seat, hall?.id, rowNumber, index + 1))
          .filter(Boolean)
        : Array.from({ length: Math.max(0, Number(row?.countOfSeats ?? 0)) }, (_, index) =>
          normalizeManagedSeat(null, hall?.id, rowNumber, index + 1),
        ).filter(Boolean)

      return {
        number: rowNumber,
        seats,
      }
    })
    .filter(Boolean)
}

function normalizeManagedPriceZone(zone) {
  const ticketType = zone?.type ?? zone?.ticketType
  const price = Number(zone?.price)

  if (!ticketType || !Number.isFinite(price)) {
    return null
  }

  return {
    type: ticketType,
    price,
    seatIds: Array.isArray(zone?.seatIds) ? zone.seatIds.filter(Boolean) : [],
  }
}

function buildManagedMockSeatMap(event) {
  const rows = normalizeManagedRows(event?.hall)
  const priceZones = Array.isArray(event?.priceZones)
    ? event.priceZones.map(normalizeManagedPriceZone).filter(Boolean)
    : []

  if (!rows.some((row) => row.seats.length) || !priceZones.length) {
    return null
  }

  const basePrice = BASE_PRICE_BY_TIER[event.priceTier] ?? BASE_PRICE_BY_TIER['$$']
  const soldSeatIds = readSoldSeatIds(event.id)
  const zoneBySeatId = new Map()

  priceZones.forEach((zone) => {
    zone.seatIds.forEach((seatId) => {
      zoneBySeatId.set(seatId, zone)
    })
  })

  const liveStateBySeatId = createSeatLiveState({
    seats: rows.flatMap((row) => row.seats.map((seat) => ({
      seatId: seat.id,
      seatNumber: seat.seatNumber,
      rowNumber: seat.rowNumber,
    }))),
    purchased: soldSeatIds,
  })

  const managedRows = rows.map((row) => {
    const rowLabel = String(row.number)

    return {
      id: `row-${event.hall?.id ?? event.id}-${row.number}`,
      label: rowLabel,
      seats: row.seats.map((seat) => {
        const zone = zoneBySeatId.get(seat.id)
        const ticketType = zone?.type ?? 'STANDARD'
        const ticketMeta = getTicketTypeMeta(ticketType) ?? getTicketTypeMeta('STANDARD')
        const price = zone?.price ?? basePrice
        const liveState = liveStateBySeatId[seat.id] ?? SEAT_LIVE_STATES.FREE

        return {
          id: seat.id,
          label: `Row ${rowLabel}, Seat ${seat.seatNumber}`,
          price,
          priceLabel: formatPrice(price),
          rowLabel,
          rowNumber: seat.rowNumber,
          seatNumber: seat.seatNumber,
          sectionLabel: ticketMeta?.label ?? 'Standard',
          status: PURCHASE_STATUS_MAP[liveState] ?? 'available',
          ticketType,
          liveState,
          zoneColor: ticketMeta?.color,
        }
      }),
    }
  })

  const prices = managedRows.flatMap((row) => row.seats.map((seat) => seat.price))

  return {
    event,
    stageLabel: getStageLabel(event.category),
    availabilityNote: null,
    sections: [{
      id: event.hall?.id ?? 'managed-main-floor',
      label: event.hall?.name ?? 'Main Floor',
      price: Math.min(...prices),
      priceLabel: formatPrice(Math.min(...prices)),
      rows: managedRows,
    }],
    priceRange: {
      high: Math.max(...prices),
      low: Math.min(...prices),
    },
  }
}

function buildSection(template, price, soldSeatIds) {
  const soldLookup = new Set([...template.sold, ...soldSeatIds])
  const heldLookup = new Set(template.held ?? [])

  return {
    id: template.id,
    label: template.label,
    price,
    priceLabel: formatPrice(price),
    rows: template.rows.map(([rowLabel, count]) => ({
      id: `${template.id}-${rowLabel}`,
      label: rowLabel,
      seats: Array.from({ length: count }, (_, index) => {
        const seatNumber = index + 1
        const seatKey = `${rowLabel}-${seatNumber}`
        const seatId = `${template.id}-${rowLabel}-${seatNumber}`
        const isSold = soldLookup.has(seatKey) || soldLookup.has(seatId)
        const isHeld = !isSold && (heldLookup.has(seatKey) || heldLookup.has(seatId))
        const status = isSold ? 'sold' : isHeld ? 'held' : 'available'

        return {
          id: seatId,
          label: `Section ${template.label}, Row ${rowLabel}, Seat ${seatNumber}`,
          price,
          rowLabel,
          seatNumber,
          sectionLabel: template.label,
          status,
        }
      }),
    })),
  }
}

function buildMockSeatMap(event) {
  const managedSeatMap = buildManagedMockSeatMap(event)

  if (managedSeatMap) {
    return managedSeatMap
  }

  const basePrice = BASE_PRICE_BY_TIER[event.priceTier] ?? BASE_PRICE_BY_TIER['$$']
  const layout = SEAT_LAYOUTS[event.category] ?? SEAT_LAYOUTS.default
  const soldSeatIds = readSoldSeatIds(event.id)
  const sections = layout.map((template) =>
    buildSection(template, Math.round(basePrice * template.multiplier), soldSeatIds),
  )
  const prices = sections.map((section) => section.price)

  return {
    event,
    stageLabel: getStageLabel(event.category),
    availabilityNote:
      'Seat availability is simulated on the frontend until backend inventory endpoints are ready.',
    sections,
    priceRange: {
      high: Math.max(...prices),
      low: Math.min(...prices),
    },
  }
}

function toRowNumber(rowLabel, rowNumber) {
  if (Number.isFinite(rowNumber)) {
    return rowNumber
  }

  const numericRow = Number.parseInt(rowLabel, 10)

  if (Number.isFinite(numericRow)) {
    return numericRow
  }

  const normalizedLabel = rowLabel?.toString().trim().toUpperCase()

  if (!normalizedLabel) {
    return null
  }

  return normalizedLabel.charCodeAt(0) - 64
}

function normalizeSelectedSeat(seat) {
  if (!seat) {
    return null
  }

  const rowLabel = seat.rowLabel ?? (seat.rowNumber != null ? String(seat.rowNumber) : '')
  const rowNumber = toRowNumber(rowLabel, seat.rowNumber)
  const seatNumber = Number.parseInt(seat.seatNumber, 10)
  const sectionLabel = seat.sectionLabel ?? 'Main floor'

  return {
    ...seat,
    label: seat.label ?? `${sectionLabel}, Row ${rowLabel}, Seat ${seatNumber}`,
    price: Number(seat.price ?? 0),
    rowLabel,
    rowNumber,
    seatNumber,
    sectionLabel,
  }
}

function buildSelectionResult(selectedSeats) {
  return {
    selectedSeats,
    holdExpiresAt: null,
  }
}

function resolveSeatPrice(ticketType, priceZoneMap, fallbackPrice) {
  if (ticketType && priceZoneMap.has(ticketType)) {
    return priceZoneMap.get(ticketType)
  }

  return fallbackPrice
}

async function getMockSeatMap({ event, eventId } = {}) {
  const purchaseEvent = event ?? await getExploreActivityById(eventId)

  if (!purchaseEvent) {
    return null
  }

  return buildMockSeatMap(purchaseEvent)
}

async function submitMockPurchase({ buyer, event, pricing, selectedSeats }) {
  if (!event) {
    throw new Error('Select an event before completing the purchase.')
  }

  if (!selectedSeats?.length) {
    throw new Error('Select at least one seat before continuing.')
  }

  const { order, tickets } = recordPurchase({
    buyer,
    event,
    pricing,
    selectedSeats,
  })

  return {
    deliveryMethod: buyer.deliveryMethod,
    email: buyer.email,
    eventTitle: event.title,
    orderId: order.id,
    seats: tickets.map((ticket) => ticket.seatLabel),
    ticketCount: tickets.length,
    totalLabel: formatPrice(pricing.total),
  }
}

async function toggleMockSeatReservation({ currentSeats = [], seat }) {
  const nextSeat = normalizeSelectedSeat(seat)

  if (!nextSeat) {
    return buildSelectionResult(currentSeats)
  }

  const isSelected = currentSeats.some((currentSeat) => currentSeat.id === nextSeat.id)
  const nextSelectedSeats = isSelected
    ? currentSeats.filter((currentSeat) => currentSeat.id !== nextSeat.id)
    : [...currentSeats, nextSeat]

  return buildSelectionResult(nextSelectedSeats)
}

async function clearMockSeatReservations() {
  return buildSelectionResult([])
}

function buildRealSeatMap(event, seatMap) {
  const basePrice = BASE_PRICE_BY_TIER[event.priceTier] ?? BASE_PRICE_BY_TIER['$$']
  const seatMapRows = seatMap?.rows ?? []
  const priceZoneMap = new Map(
    (seatMap?.priceZones ?? []).map((zone) => [zone.type, Number(zone.price ?? 0)]),
  )
  const normalizedSeats = []

  seatMapRows.forEach((row) => {
    row.tickets.forEach((ticket) => {
      normalizedSeats.push({
        seatId: ticket.id,
        seatNumber: ticket.seat,
        rowNumber: row.number,
      })
    })
  })

  const liveStateBySeatId = createSeatLiveState({
    seats: normalizedSeats,
    myReserved: [],
    otherReserved: [],
    purchased: [],
  })

  const rows = seatMapRows.map((row) => {
    const rowLabel = String(row.number)
    return {
      id: `row-${row.number}`,
      label: rowLabel,
      seats: row.tickets.map((ticket) => ({
        ...(function buildSeatPricing() {
          const ticketType = ticket.type ?? 'STANDARD'
          const price = resolveSeatPrice(ticketType, priceZoneMap, basePrice)
          const ticketMeta = getTicketTypeMeta(ticketType)
          return {
            price,
            priceLabel: formatPrice(price),
            ticketType,
            zoneColor: ticketMeta.color,
            sectionLabel: ticketMeta.label,
          }
        }()),
        id: ticket.id,
        label: `Row ${rowLabel}, Seat ${ticket.seat}`,
        rowLabel,
        rowNumber: row.number,
        seatNumber: ticket.seat,
        liveState: liveStateBySeatId[ticket.id] ?? SEAT_LIVE_STATES.FREE,
        status: PURCHASE_STATUS_MAP[liveStateBySeatId[ticket.id] ?? SEAT_LIVE_STATES.FREE] ?? 'available',
      })),
    }
  })

  const section = {
    id: 'main-floor',
    label: 'Main Floor',
    price: basePrice,
    priceLabel: formatPrice(basePrice),
    rows,
  }

  return {
    event,
    stageLabel: getStageLabel(event.category),
    availabilityNote: null,
    sections: [section],
    priceRange: { high: basePrice, low: basePrice },
  }
}

async function getRealSeatMap({ event, eventId } = {}) {
  const purchaseEvent = event ?? (await getExploreActivityById(eventId))

  if (!purchaseEvent) {
    return null
  }

  const data = await fetchGraphQL(SEAT_MAP_QUERY, {
    variables: { id: eventId ?? purchaseEvent.id },
  })

  return buildRealSeatMap(purchaseEvent, data?.getSeatMap ?? null)
}

async function toggleRealSeatReservation({ currentSeats = [], seat, event }) {
  const nextSeat = normalizeSelectedSeat(seat)

  if (!nextSeat) {
    return buildSelectionResult(currentSeats)
  }

  const isSelected = currentSeats.some((s) => s.id === nextSeat.id)

  if (isSelected) {
    await fetchGraphQL(CANCEL_RESERVATION_MUTATION, {
      variables: { activityId: event.id, seatId: nextSeat.id },
    })
    return buildSelectionResult(currentSeats.filter((s) => s.id !== nextSeat.id))
  } else {
    await fetchGraphQL(RESERVE_SEATS_MUTATION, {
      variables: { activityId: event.id, seatIds: [nextSeat.id] },
    })
    return buildSelectionResult([...currentSeats, nextSeat])
  }
}

async function clearRealSeatReservations({ event, currentSeats = [] }) {
  await Promise.all(
    currentSeats.map((seat) =>
      fetchGraphQL(CANCEL_RESERVATION_MUTATION, {
        variables: { activityId: event.id, seatId: seat.id },
      }),
    ),
  )
  return buildSelectionResult([])
}

async function submitRealPurchase({ buyer, event, pricing, selectedSeats }) {
  await fetchGraphQL(CHECKOUT_MUTATION, {
    variables: {
      activityId: event.id,
      seatIds: selectedSeats.map((seat) => seat.id),
    },
  })

  const data = await fetchGraphQL(GET_ORDERS_QUERY)
  const orders = (data?.getOrders ?? []).sort(
    (a, b) => new Date(b.createdAt) - new Date(a.createdAt),
  )
  const latestOrder = orders[0]

  return {
    deliveryMethod: buyer.deliveryMethod,
    email: buyer.email,
    eventTitle: event.title,
    orderId: latestOrder?.id ?? 'confirmed',
    seats: selectedSeats.map((seat) => seat.label),
    ticketCount: selectedSeats.length,
    totalLabel: formatPrice(pricing.total),
  }
}

export async function getSeatMap({ event, eventId } = {}) {
  return isPurchaseMockEnabled()
    ? getMockSeatMap({ event, eventId })
    : getRealSeatMap({ event, eventId })
}

export async function submitPurchase({ buyer, event, pricing, selectedSeats }) {
  return isPurchaseMockEnabled()
    ? submitMockPurchase({ buyer, event, pricing, selectedSeats })
    : submitRealPurchase({ buyer, event, pricing, selectedSeats })
}

export async function toggleSeatReservation({ event, currentSeats, seat }) {
  return isPurchaseMockEnabled()
    ? toggleMockSeatReservation({ event, currentSeats, seat })
    : toggleRealSeatReservation({ event, currentSeats, seat })
}

export async function clearSeatReservations({ event, currentSeats }) {
  return isPurchaseMockEnabled()
    ? clearMockSeatReservations({ event, currentSeats })
    : clearRealSeatReservations({ event, currentSeats })
}
