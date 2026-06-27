const BACKEND_CATEGORY_MAP = {
  concerts: 'Concerts',
  festivals: 'Festivals',
  sports: 'Sports',
  theater: 'Theater',
}

const DATE_RANGE_INPUT_FIELDS = {
  from: 'from',
  to: 'to',
}

function padDatePart(value) {
  return value.toString().padStart(2, '0')
}

function formatDateForApi(value) {
  if (!value) {
    return undefined
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return `${date.getFullYear()}-${padDatePart(date.getMonth() + 1)}-${padDatePart(date.getDate())}`
}

function normalizeDate(value) {
  if (!value) {
    return null
  }

  const date = new Date(value)
  if (Number.isNaN(date.getTime())) {
    return null
  }

  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date, amount) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate() + amount)
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0)
}

export function deriveDateRangeFromPreset(preset, customRange, referenceDate = new Date()) {
  const customStart = normalizeDate(customRange?.start)
  const customEnd = normalizeDate(customRange?.end)

  if (customStart && customEnd) {
    return customStart.getTime() <= customEnd.getTime()
      ? { start: customStart, end: customEnd }
      : { start: customEnd, end: customStart }
  }

  const today = normalizeDate(referenceDate)
  if (!today || !preset || preset === 'All dates') {
    return null
  }

  if (preset === 'Today') {
    return { start: today, end: today }
  }

  if (preset === 'This weekend') {
    const currentDay = today.getDay()

    if (currentDay === 6) {
      return { start: today, end: addDays(today, 1) }
    }

    if (currentDay === 0) {
      return { start: today, end: today }
    }

    const daysUntilSaturday = 6 - currentDay
    const saturday = addDays(today, daysUntilSaturday)

    return { start: saturday, end: addDays(saturday, 1) }
  }

  if (preset === 'This month') {
    return { start: today, end: endOfMonth(today) }
  }

  return null
}

function buildDateRangeInput(dateRange) {
  if (!dateRange?.start || !dateRange?.end) {
    return {}
  }

  return {
    [DATE_RANGE_INPUT_FIELDS.from]: formatDateForApi(dateRange.start),
    [DATE_RANGE_INPUT_FIELDS.to]: formatDateForApi(dateRange.end),
  }
}

function deriveCategory(filters) {
  if (!filters.activeCategory || filters.activeCategory === 'all') {
    return undefined
  }

  return BACKEND_CATEGORY_MAP[filters.activeCategory] ?? filters.activeCategory
}

export function mapExploreFiltersToSearchInput(filters) {
  if (!filters) {
    return null
  }

  const dateRange = deriveDateRangeFromPreset(filters.selectedDatePreset, filters.selectedDateRange)
  const input = {
    text: filters.searchText?.trim() || undefined,
    category: deriveCategory(filters),
    city: filters.selectedLocation || undefined,
    ...buildDateRangeInput(dateRange),
  }

  const hasAnyValue = Object.values(input).some((value) => value !== undefined && value !== '')
  return hasAnyValue ? input : null
}
