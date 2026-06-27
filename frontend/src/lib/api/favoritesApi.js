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

function normalizeFavoriteIds(items = []) {
  return items
    .map((item) => item?.id)
    .filter(Boolean)
}

export async function getFavoriteActivities() {
  try {
    const data = await fetchGraphQL(GET_FAVORITE_ACTIVITIES_QUERY)
    return Array.isArray(data?.getFavoriteActivities) ? data.getFavoriteActivities : []
  } catch (error) {
    throw normalizeApiError(error, 'Unable to load favorite activities')
  }
}

export async function getFavoritePerformers() {
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
  try {
    const data = await fetchGraphQL(TOGGLE_FAVORITE_PERFORMER_MUTATION, {
      variables: { performerId },
    })

    return data?.toggleFavoritePerformer === true
  } catch (error) {
    throw normalizeApiError(error, 'Unable to update favorite performer')
  }
}
