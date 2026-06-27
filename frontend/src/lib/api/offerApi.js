import { getExploreActivityById } from 'lib/api/activityApi'
import { mockOffers } from 'lib/api/mock/offerMocks'
import { mapOfferToViewModel } from 'lib/api/mappers/offerMapper'
import { buildActivityOffers, enrichPurchaseEvent } from 'lib/api/purchaseModel'
import { isProfileMockEnabled } from 'lib/api/runtime'

export async function getMyOffers() {
  if (!isProfileMockEnabled()) {
    return []
  }

  return mockOffers.map(mapOfferToViewModel)
}

export async function getOffersByActivity(activityOrId) {
  const event = typeof activityOrId === 'string'
    ? await getExploreActivityById(activityOrId)
    : activityOrId

  if (!event) {
    return []
  }

  if (!isProfileMockEnabled()) {
    return []
  }

  return buildActivityOffers(enrichPurchaseEvent(event))
}
