import { describe, expect, it } from 'vitest'
import { calculatePricing, MAX_SEATS_PER_ORDER } from './purchaseUtils'

describe('purchase pricing', () => {
  it('matches the backend subtotal-only total', () => {
    expect(calculatePricing([{ price: 39 }, { price: 64 }])).toEqual({
      subtotal: 103,
      total: 103,
    })
  })

  it('uses the backend seat limit', () => {
    expect(MAX_SEATS_PER_ORDER).toBe(10)
  })
})
