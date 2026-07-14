import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  getFavoriteState,
  toggleFavoriteActivity,
  toggleFavoritePerformer,
} from './favoritesApi'

describe('mock favorites', () => {
  let currentSession

  beforeEach(() => {
    const values = new Map()
    currentSession = { email: 'first@example.com', id: 'mock-user' }
    vi.stubGlobal('window', {
      localStorage: {
        getItem: (key) => values.get(key) ?? null,
        setItem: (key, value) => values.set(key, value),
      },
      sessionStorage: {
        getItem: () => JSON.stringify(currentSession),
      },
    })
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('stores mock favorites locally without calling GraphQL', async () => {
    await toggleFavoriteActivity('activity-1')
    await toggleFavoritePerformer('performer-1')

    const state = await getFavoriteState()
    expect(state.favoriteActivityIds).toEqual(['activity-1'])
    expect(state.favoritePerformerIds).toEqual(['performer-1'])
  })

  it('keeps favorites isolated between mock accounts', async () => {
    await toggleFavoriteActivity('activity-1')

    currentSession = { email: 'second@example.com', id: 'mock-user' }
    expect((await getFavoriteState()).favoriteActivityIds).toEqual([])

    currentSession = { email: 'first@example.com', id: 'mock-user' }
    expect((await getFavoriteState()).favoriteActivityIds).toEqual(['activity-1'])
  })
})
