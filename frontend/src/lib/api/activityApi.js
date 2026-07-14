import { ApiError, normalizeApiError } from 'lib/api/errors'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import {
  EXPLORE_ACTIVITY_BY_ID_QUERY,
  EXPLORE_ACTIVITIES_QUERY,
  SEARCH_ACTIVITIES_QUERY,
} from 'lib/api/graphql/queries'
import { mapActivityToExploreEvent } from 'lib/api/mappers/activityMapper'
import {
  getMockExploreActivities,
  getMockExploreActivityById,
} from 'lib/api/mock/managementStorage'
import { mapExploreFiltersToSearchInput } from 'lib/api/mappers/searchInputMapper'
import { isMockApiEnabled } from 'lib/api/runtime'

const DEFAULT_ACTIVITY_PAGE = 0
const DEFAULT_ACTIVITY_PAGE_SIZE = 100

export async function getExploreActivities({ filters, signal } = {}) {
  if (isMockApiEnabled()) {
    return getMockExploreActivities()
  }

  try {
    const searchInput = mapExploreFiltersToSearchInput(filters)
    const data = searchInput
      ? await fetchGraphQL(SEARCH_ACTIVITIES_QUERY, {
          signal,
          variables: { input: searchInput },
        })
      : await fetchGraphQL(EXPLORE_ACTIVITIES_QUERY, {
          signal,
          variables: {
            page: DEFAULT_ACTIVITY_PAGE,
            size: DEFAULT_ACTIVITY_PAGE_SIZE,
          },
        })
    const activities = searchInput
      ? data?.searchActivities ?? []
      : data?.getAllActivities?.content ?? []

    if (!Array.isArray(activities)) {
      throw new ApiError('Activity response shape is invalid', {
        source: 'graphql',
        status: 500,
      })
    }

    const realEvents = activities.map(mapActivityToExploreEvent)
    return realEvents
  } catch (error) {
    throw normalizeApiError(error, 'Unable to load activities')
  }
}

export async function getExploreActivityById(id, { signal } = {}) {
  if (!id) {
    return null
  }

  if (isMockApiEnabled()) {
    return getMockExploreActivityById(id)
  }

  try {
    const data = await fetchGraphQL(EXPLORE_ACTIVITY_BY_ID_QUERY, {
      signal,
      variables: { id },
    })
    const activity = data?.getActivityById

    return activity ? mapActivityToExploreEvent(activity) : null
  } catch (error) {
    throw normalizeApiError(error, 'Unable to load activity')
  }
}
