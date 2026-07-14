const DATE_ONLY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

export function parseLocalDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : new Date(value.getTime())
  }

  if (typeof value === 'string') {
    const match = DATE_ONLY_PATTERN.exec(value.trim())

    if (match) {
      const [, yearText, monthText, dayText] = match
      const year = Number(yearText)
      const month = Number(monthText) - 1
      const day = Number(dayText)
      const date = new Date(year, month, day)

      return date.getFullYear() === year && date.getMonth() === month && date.getDate() === day
        ? date
        : null
    }
  }

  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}
