import { describe, expect, it } from 'vitest'
import { getSafeInternalRedirect } from './safeRedirect'

describe('getSafeInternalRedirect', () => {
  const fallback = '/explore'

  it('keeps internal paths including query strings and hashes', () => {
    expect(getSafeInternalRedirect('/my-orders?status=paid#latest', fallback))
      .toBe('/my-orders?status=paid#latest')
  })

  it.each([
    'https://example.com',
    '//example.com',
    '/\\example.com',
    'javascript:alert(1)',
    '',
    null,
  ])('falls back for an unsafe redirect: %s', (value) => {
    expect(getSafeInternalRedirect(value, fallback)).toBe(fallback)
  })
})
