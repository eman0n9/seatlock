const BASE_PRICE_BY_TIER = {
  $: 35,
  $$: 55,
  $$$: 85,
  $$$$: 125,
}

function createRowsFromCounts(counts) {
  return counts.map((countOfSeats, index) => ({
    rowNumber: index + 1,
    countOfSeats,
  }))
}

const HALL_CATALOG = {
  'Forum Karlin': {
    id: 'hall-forum-karlin',
    name: 'Forum Karlin',
    address: 'Pernerova 51',
    city: 'Prague',
    rows: createRowsFromCounts([13, 13, 11, 11, 9, 9, 13]),
  },
  'Holesovice Exhibition Grounds': {
    id: 'hall-holesovice-exhibition-grounds',
    name: 'Holesovice Exhibition Grounds',
    address: 'Vystaviste 67',
    city: 'Prague',
    rows: createRowsFromCounts([15, 15, 13, 13, 11, 11, 13, 15]),
  },
  'Letnany Airport': {
    id: 'hall-letnany-airport',
    name: 'Letnany Airport',
    address: 'Beranovych 667',
    city: 'Prague',
    rows: createRowsFromCounts([17, 17, 15, 15, 13, 13, 15, 15, 17]),
  },
  'O2 Arena': {
    id: 'hall-o2-arena',
    name: 'O2 Arena',
    address: 'Ceskomoravska 17',
    city: 'Prague',
    rows: createRowsFromCounts([15, 15, 13, 13, 11, 11, 13, 13, 15]),
  },
  'O2 Universum': {
    id: 'hall-o2-universum',
    name: 'O2 Universum',
    address: 'Ceskomoravska 17',
    city: 'Prague',
    rows: createRowsFromCounts([13, 13, 11, 11, 9, 9, 11, 13]),
  },
  'PVA Expo Praha': {
    id: 'hall-pva-expo-praha',
    name: 'PVA Expo Praha',
    address: 'Beranovych 667',
    city: 'Prague',
    rows: createRowsFromCounts([13, 13, 11, 11, 9, 9, 11, 13]),
  },
  'Prague Congress Centre': {
    id: 'hall-prague-congress-centre',
    name: 'Prague Congress Centre',
    address: '5. kvetna 65',
    city: 'Prague',
    rows: createRowsFromCounts([13, 13, 11, 11, 9, 9, 13]),
  },
  'Sportovni hala Fortuna': {
    id: 'hall-sportovni-hala-fortuna',
    name: 'Sportovni hala Fortuna',
    address: 'Za Elektrarnou 419',
    city: 'Prague',
    rows: createRowsFromCounts([15, 15, 13, 13, 11, 11, 13, 15]),
  },
  'epet ARENA': {
    id: 'hall-epet-arena',
    name: 'epet ARENA',
    address: 'Milady Horakove 1066',
    city: 'Prague',
    rows: createRowsFromCounts([17, 17, 15, 15, 13, 13, 15, 15, 17]),
  },
}

function normalizeVenueKey(value) {
  return value?.replace(/\s*\(.*?\)\s*/g, '').trim() ?? ''
}

function createFallbackHall(event) {
  const category = event?.category ?? 'concerts'

  return {
    id: `hall-${event?.id ?? 'fallback'}`,
    name: event?.venue ?? 'Venue',
    address: '',
    city: '',
    rows:
      category === 'sports'
        ? createRowsFromCounts([17, 17, 15, 15, 13, 13, 15, 15, 17])
        : category === 'festivals'
          ? createRowsFromCounts([15, 15, 13, 13, 11, 11, 13, 15])
          : createRowsFromCounts([13, 13, 11, 11, 9, 9, 13]),
  }
}

export function formatCurrency(value) {
  const amount = Number(value ?? 0)

  if (!Number.isFinite(amount)) {
    return '$0'
  }

  return `$${amount}`
}

export function formatOfferTypeLabel(type) {
  if (!type) {
    return 'Unknown'
  }

  return type
    .toString()
    .toLowerCase()
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (letter) => letter.toUpperCase())
}

export function formatSeatLabel(seat) {
  if (!seat) {
    return 'Seat TBA'
  }

  return `Row ${seat.rowNumber}, Seat ${seat.seatNumber}`
}

export function enrichPurchaseEvent(event) {
  if (!event) {
    return null
  }

  const sourceHall = event.hall ?? {}
  const hallFromCatalog =
    HALL_CATALOG[sourceHall.name] ??
    HALL_CATALOG[event.venue] ??
    HALL_CATALOG[normalizeVenueKey(sourceHall.name)] ??
    HALL_CATALOG[normalizeVenueKey(event.venue)] ??
    createFallbackHall(event)

  const hall = {
    ...hallFromCatalog,
    id: sourceHall.id ?? hallFromCatalog.id,
    name: sourceHall.name ?? hallFromCatalog.name,
    address: sourceHall.address ?? hallFromCatalog.address,
    city: sourceHall.city ?? hallFromCatalog.city,
    rows: sourceHall.rows ?? hallFromCatalog.rows,
  }

  return {
    ...event,
    title: event.title ?? event.name ?? 'Untitled Event',
    dateRaw: event.dateRaw ?? event.date ?? event.dateLabel ?? 'Date TBA',
    hall,
    venue: [hall.name, hall.city].filter(Boolean).join(' - ') || event.venue || 'Venue TBA',
  }
}

function getBasePrice(event) {
  return BASE_PRICE_BY_TIER[event?.priceTier] ?? BASE_PRICE_BY_TIER['$$']
}

export function buildActivityOffers(event) {
  const nextEvent = enrichPurchaseEvent(event)
  const basePrice = getBasePrice(nextEvent)
  const activity = {
    id: nextEvent.id,
    name: nextEvent.title ?? nextEvent.name ?? 'Untitled Event',
    date: nextEvent.dateRaw,
    hall: nextEvent.hall,
  }

  return [
    {
      id: `offer-${nextEvent.id}-standard`,
      type: 'STANDARD',
      price: basePrice,
      activity,
    },
    {
      id: `offer-${nextEvent.id}-vip`,
      type: 'VIP',
      price: basePrice + Math.max(20, Math.round(basePrice * 0.4)),
      activity,
    },
    {
      id: `offer-${nextEvent.id}-economy`,
      type: 'ECONOMY',
      price: Math.max(20, basePrice - Math.max(10, Math.round(basePrice * 0.25))),
      activity,
    },
  ]
}

export function getDefaultActivityOffer(offers) {
  return offers.find((offer) => offer.type === 'STANDARD') ?? offers[0] ?? null
}

function createSeatId(hallId, rowNumber, seatNumber) {
  return `seat-${hallId}-${rowNumber}-${seatNumber}`
}

function hashString(value) {
  return value.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)
}

export function buildSeededSoldSeatIds(event, hall) {
  const rows = hall?.rows ?? []

  if (!rows.length) {
    return []
  }

  const rowLimit = rows.length
  const seed = hashString(event?.id ?? hall?.id ?? 'seatlock')

  return Array.from({ length: Math.min(4, rowLimit) }, (_, index) => {
    const rowConfig = rows[index % rowLimit]
    const seatNumber = ((seed + index * 3) % rowConfig.countOfSeats) + 1

    return createSeatId(hall.id, rowConfig.rowNumber, seatNumber)
  })
}

export function buildHallSeatRows(hall, soldSeatIds = []) {
  const soldLookup = new Set(soldSeatIds)

  return (hall?.rows ?? []).map((row) => ({
    id: `row-${hall.id}-${row.rowNumber}`,
    rowNumber: row.rowNumber,
    seats: Array.from({ length: row.countOfSeats }, (_, index) => {
      const seatNumber = index + 1
      const seatId = createSeatId(hall.id, row.rowNumber, seatNumber)

      return {
        id: seatId,
        hallId: hall.id,
        rowNumber: row.rowNumber,
        seatNumber,
        status: soldLookup.has(seatId) ? 'SOLD' : 'AVAILABLE',
      }
    }),
  }))
}
