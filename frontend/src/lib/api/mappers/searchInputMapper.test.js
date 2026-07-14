import { describe, expect, it } from 'vitest'
import { mapExploreFiltersToSearchInput } from './searchInputMapper'

describe('mapExploreFiltersToSearchInput', () => {
  it('maps a local date range to the backend field names', () => {
    expect(mapExploreFiltersToSearchInput({
      activeCategory: 'concerts',
      selectedDatePreset: 'All dates',
      selectedDateRange: {
        start: '2026-05-01',
        end: '2026-05-03',
      },
    })).toEqual({
      category: 'Concerts',
      city: undefined,
      dateFrom: '2026-05-01',
      dateTo: '2026-05-03',
      text: undefined,
    })
  })
})
