import { exploreEvents } from 'features/explore/data/exploreMockData'

export function getMockExploreActivities() {
  return exploreEvents
}

export function getMockExploreActivityById(id) {
  return exploreEvents.find((activity) => activity.id === id) ?? null
}
