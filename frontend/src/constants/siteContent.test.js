import { describe, expect, it } from 'vitest'
import {
  getMarketFooterSupportLinks,
  marketFooterCompanyLinks,
  marketFooterLocale,
} from './siteContent'

describe('market footer content', () => {
  it('shows sign in only to guests', () => {
    expect(getMarketFooterSupportLinks(false).map(({ label }) => label))
      .toEqual(['Profile', 'Sign in'])
    expect(getMarketFooterSupportLinks(true).map(({ label }) => label))
      .toEqual(['Profile'])
  })

  it('matches the supported marketplace capabilities and currency', () => {
    expect(marketFooterCompanyLinks.map(({ label }) => label))
      .toEqual(['Explore events', 'My orders'])
    expect(marketFooterLocale.currency).toBe('USD United States Dollar')
  })
})
