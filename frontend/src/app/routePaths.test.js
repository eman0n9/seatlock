import { describe, expect, it } from 'vitest'
import {
  getBasketRoute,
  getExploreSearchRoute,
  getOrderDetailsRoute,
  getPurchaseRoute,
  getSeatMapRoute,
} from './routePaths'

describe('purchase routes', () => {
  it('keeps an event purchase inside the shared WebSocket layout', () => {
    const eventId = 'event/id'
    expect(getSeatMapRoute(eventId)).toBe('/event/event%2Fid/seatmap')
    expect(getBasketRoute(eventId)).toBe('/event/event%2Fid/cart')
    expect(getPurchaseRoute(eventId)).toBe('/event/event%2Fid/purchase')
  })

  it('encodes order ids', () => {
    expect(getOrderDetailsRoute('order/id')).toBe('/my-orders/order%2Fid')
  })

  it('builds a trimmed and encoded explore search route', () => {
    expect(getExploreSearchRoute('  live music & sport  '))
      .toBe('/explore?q=live%20music%20%26%20sport')
    expect(getExploreSearchRoute('   ')).toBe('/explore')
  })
})
