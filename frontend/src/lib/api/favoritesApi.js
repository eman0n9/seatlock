import { normalizeApiError } from 'lib/api/errors'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import {
  TOGGLE_FAVORITE_ACTIVITY_MUTATION,
  TOGGLE_FAVORITE_PERFORMER_MUTATION,
} from 'lib/api/graphql/mutations'
import {
  GET_FAVORITE_ACTIVITIES_QUERY,
  GET_FAVORITE_PERFORMERS_QUERY,
} from 'lib/api/graphql/queries'
import { isMockApiEnabled } from 'lib/api/runtime'

const MOCK_FAVORITES_KEY_PREFIX = 'seatlock.favorites.mock.v1'

function getMockFavoritesKey() {
  try {
    const session = JSON.parse(window.sessionStorage.getItem('seatlock.auth.mock.user'))
    const scope = session?.email ?? session?.id ?? 'guest'
    return `${MOCK_FAVORITES_KEY_PREFIX}.${encodeURIComponent(scope.toString().trim().toLowerCase())}`
  } catch {
    return `${MOCK_FAVORITES_KEY_PREFIX}.guest`
  }
}

function readMockFavorites() {
  if (typeof window === 'undefined') {
    return { activityIds: [], performerIds: [] }
  }

  try {
    const value = JSON.parse(window.localStorage.getItem(getMockFavoritesKey()))
    return {
      activityIds: Array.isArray(value?.activityIds) ? value.activityIds : [],
      performerIds: Array.isArray(value?.performerIds) ? value.performerIds : [],
    }
  } catch {
    return { activityIds: [], performerIds: [] }
  }
}

function writeMockFavorites(favorites) {
  window.localStorage.setItem(getMockFavoritesKey(), JSON.stringify(favorites))
}

function toggleMockFavorite(key, id) {
  const favorites = readMockFavorites()
  const ids = favorites[key]
  const isFavorite = ids.includes(id)
  const nextFavorites = {
    ...favorites,
    [key]: isFavorite ? ids.filter((currentId) => currentId !== id) : [...ids, id],
  }

  writeMockFavorites(nextFavorites)
  return !isFavorite
}

function normalizeFavoriteIds(items = []) {
  return items
    .map((item) => item?.id)
    .filter(Boolean)
}

export async function getFavoriteActivities() {
  if (isMockApiEnabled()) {
    return readMockFavorites().activityIds.map((id) => ({ id }))
  }

  try {
    const data = await fetchGraphQL(GET_FAVORITE_ACTIVITIES_QUERY)
    return Array.isArray(data?.getFavoriteActivities) ? data.getFavoriteActivities : []
  } catch (error) {
    throw normalizeApiError(error, 'Unable to load favorite activities')
  }
}

export async function getFavoritePerformers() {
  if (isMockApiEnabled()) {
    return readMockFavorites().performerIds.map((id) => ({ id }))
  }

  try {
    const data = await fetchGraphQL(GET_FAVORITE_PERFORMERS_QUERY)
    return Array.isArray(data?.getFavoritePerformers) ? data.getFavoritePerformers : []
  } catch (error) {
    throw normalizeApiError(error, 'Unable to load favorite performers')
  }
}

export async function getFavoriteState() {
  const [favoriteActivities, favoritePerformers] = await Promise.all([
    getFavoriteActivities(),
    getFavoritePerformers(),
  ])

  return {
    favoriteActivities,
    favoriteActivityIds: normalizeFavoriteIds(favoriteActivities),
    favoritePerformers,
    favoritePerformerIds: normalizeFavoriteIds(favoritePerformers),
  }
}

export async function toggleFavoriteActivity(activityId) {
  if (isMockApiEnabled()) {
    return toggleMockFavorite('activityIds', activityId)
  }

  try {
    const data = await fetchGraphQL(TOGGLE_FAVORITE_ACTIVITY_MUTATION, {
      variables: { activityId },
    })

    return data?.toggleFavoriteActivity === true
  } catch (error) {
    throw normalizeApiError(error, 'Unable to update favorite activity')
  }
}

export async function toggleFavoritePerformer(performerId) {
  if (isMockApiEnabled()) {
    return toggleMockFavorite('performerIds', performerId)
  }

  try {
    const data = await fetchGraphQL(TOGGLE_FAVORITE_PERFORMER_MUTATION, {
      variables: { performerId },
    })

    return data?.toggleFavoritePerformer === true
  } catch (error) {
    throw normalizeApiError(error, 'Unable to update favorite performer')
  }
}
