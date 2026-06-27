import { enrichPurchaseEvent } from 'lib/api/purchaseModel'

const CATEGORY_MAP = {
  concert: 'concerts',
  concerts: 'concerts',
  festival: 'festivals',
  festivals: 'festivals',
  sport: 'sports',
  sports: 'sports',
  theatre: 'theater',
  theater: 'theater',
}

const ART_BY_CATEGORY = {
  concerts: 'rose-stage',
  festivals: 'festival-crowd',
  sports: 'football-red',
  theater: 'theater-spot',
}

const DATE_FORMATTER = new Intl.DateTimeFormat('en-US', {
  day: '2-digit',
  month: 'short',
  weekday: 'short',
})

function toCategoryId(category) {
  const normalized = category?.toString().trim().toLowerCase()
  return CATEGORY_MAP[normalized] ?? 'all'
}

function toCategoryName(category) {
  if (!category) {
    return ''
  }

  if (typeof category === 'string') {
    return category
  }

  return category.name ?? ''
}

function toDateLabel(value) {
  if (!value) {
    return 'Date TBA'
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return value
  }

  return DATE_FORMATTER.format(date).replace(',', '')
}

function toTimeLabel(startTime, endTime) {
  if (startTime && endTime) {
    return `${startTime} - ${endTime}`
  }

  return startTime ?? endTime ?? 'Time TBA'
}

function toDateGroup(value) {
  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return 'later'
  }

  const today = new Date()
  const todayStart = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const diffInDays = Math.floor((date - todayStart) / 86400000)

  if (diffInDays <= 0) {
    return 'today'
  }

  if (diffInDays <= 2) {
    return 'this-weekend'
  }

  if (date.getMonth() === today.getMonth() && date.getFullYear() === today.getFullYear()) {
    return 'this-month'
  }

  return 'later'
}

export function mapActivityToExploreEvent(activity) {
  const categoryName = toCategoryName(activity.category)
  const category = toCategoryId(categoryName)
  const hall = activity.hall
    ? {
        id: activity.hall.id ?? `hall-${activity.id}`,
        name: activity.hall.name ?? 'Venue',
        address: activity.hall.address ?? '',
        city: activity.hall.city ?? '',
        rows: Array.isArray(activity.hall.rows) ? activity.hall.rows : undefined,
      }
    : null
  const venueName = hall?.name ?? ''
  const venueCity = hall?.city ?? ''
  const venue = [venueName, venueCity].filter(Boolean).join(' - ')

  return enrichPurchaseEvent({
    id: activity.id,
    title: activity.name ?? 'Untitled Event',
    description: activity.description ?? '',
    dateRaw: activity.date,
    dateLabel: toDateLabel(activity.date),
    timeLabel: toTimeLabel(activity.startTime, activity.endTime),
    venue: venue || 'Venue TBA',
    hall,
    priceZones: Array.isArray(activity.priceZones) ? activity.priceZones : [],
    category,
    subcategory: categoryName,
    priceTier: '$$',
    dateGroup: toDateGroup(activity.date),
    art: ART_BY_CATEGORY[category] ?? 'rose-stage',
    source: 'backend',
  })
}
