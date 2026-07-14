export const marketDisclosureText =
  'SeatLock is a portfolio project demonstrating live seat reservations and transactional checkout. Payments are simulated.'

export const marketFooterCompanyLinks = [
  { label: 'Explore events', href: '/explore' },
  { label: 'My orders', href: '/my-orders' },
]

export const marketFooterSupportLinks = [
  { label: 'Profile', href: '/profile' },
  { label: 'Sign in', href: '/login', guestOnly: true },
]

export function getMarketFooterSupportLinks(isAuthenticated) {
  return marketFooterSupportLinks.filter(
    (link) => !link.guestOnly || !isAuthenticated,
  )
}

export const marketFooterLocale = {
  title: 'Live events all over the world',
  country: 'Czech Republic',
  language: 'English (UK)',
  currency: 'USD United States Dollar',
}

export const marketFooterLegal = {
  copyright: 'Copyright © SeatLock 2026',
  disclaimer: 'Portfolio demo — no real payments are processed.',
}
