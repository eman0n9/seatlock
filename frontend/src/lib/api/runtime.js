export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8080'
export const GRAPHQL_URL = process.env.NEXT_PUBLIC_GRAPHQL_URL ?? `${API_URL}/graphql`
export const REQUEST_CREDENTIALS = 'include'
export const WS_URL = process.env.NEXT_PUBLIC_WS_URL ?? API_URL.replace(/^http/i, 'ws')

function normalizeApiMode(value, fallback = 'mock') {
  const normalized = value?.toString().trim().toLowerCase()

  if (!normalized) {
    return fallback
  }

  if (normalized === 'mock') {
    return 'mock'
  }

  if (['api', 'backend', 'false', 'real'].includes(normalized)) {
    return 'real'
  }

  return fallback
}

export const API_MODE = normalizeApiMode(process.env.NEXT_PUBLIC_API_MODE, 'mock')
export const PROFILE_API_MODE = normalizeApiMode(process.env.NEXT_PUBLIC_PROFILE_API_MODE, 'mock')
export const PURCHASE_API_MODE = normalizeApiMode(process.env.NEXT_PUBLIC_PURCHASE_API_MODE, 'mock')

export function isMockApiEnabled() {
  return API_MODE === 'mock'
}

export function isProfileMockEnabled() {
  return PROFILE_API_MODE === 'mock'
}

export function isPurchaseMockEnabled() {
  return PURCHASE_API_MODE === 'mock'
}
