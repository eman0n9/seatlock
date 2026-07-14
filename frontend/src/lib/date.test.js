import { describe, expect, it } from 'vitest'
import { parseLocalDate } from './date'

describe('parseLocalDate', () => {
  it('parses a date-only value as a local calendar date', () => {
    const date = parseLocalDate('2026-05-01')

    expect(date?.getFullYear()).toBe(2026)
    expect(date?.getMonth()).toBe(4)
    expect(date?.getDate()).toBe(1)
    expect(date?.getHours()).toBe(0)
  })

  it('rejects impossible calendar dates', () => {
    expect(parseLocalDate('2026-02-30')).toBeNull()
  })
})
