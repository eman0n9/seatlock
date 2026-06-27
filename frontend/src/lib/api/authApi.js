import { httpClient } from 'lib/api/httpClient'
import { ROLE_CODES, normalizeUserRole } from 'lib/auth/roles'
import { fetchGraphQL } from 'lib/api/graphqlClient'
import { ApiError, normalizeApiError } from 'lib/api/errors'
import { CURRENT_USER_QUERY } from 'lib/api/graphql/queries'
import { isMockApiEnabled } from 'lib/api/runtime'

const MOCK_SESSION_KEY = 'seatlock.auth.mock.user'

const mockUserDefaults = {
  id: 'mock-user',
  username: 'seatlock-user',
  role: ROLE_CODES.USER,
}

function deriveMockRoleFromEmail(email) {
  const localPart = email?.toString().split('@')[0]?.trim().toLowerCase() ?? ''

  if (
    localPart === 'admin' ||
    localPart.startsWith('admin+') ||
    localPart.endsWith('+admin')
  ) {
    return ROLE_CODES.ADMIN
  }

  const organizerTokens = ['org', 'organizer', 'organization']
  const isOrganizerSession = organizerTokens.some((token) =>
    localPart === token ||
    localPart.startsWith(`${token}+`) ||
    localPart.endsWith(`+${token}`),
  )

  return isOrganizerSession ? ROLE_CODES.ORGANIZATION : ROLE_CODES.USER
}

function readMockSession() {
  if (typeof window === 'undefined') return null
  try {
    const value = window.sessionStorage.getItem(MOCK_SESSION_KEY)
    return value ? JSON.parse(value) : null
  } catch {
    return null
  }
}

function writeMockSession(user) {
  if (typeof window === 'undefined') return
  window.sessionStorage.setItem(MOCK_SESSION_KEY, JSON.stringify(user))
}

function clearMockSession() {
  if (typeof window === 'undefined') return
  window.sessionStorage.removeItem(MOCK_SESSION_KEY)
}

function normalizeCurrentUser(user) {
  if (!user) {
    return null
  }

  const email = user.email ?? user.username ?? ''
  const name = user.name ?? ''
  const surname = user.surname ?? ''
  const fullName = [name, surname].filter(Boolean).join(' ')
  const username = (user.username ?? fullName) || email.split('@')[0]

  return {
    id: user.id ?? null,
    username,
    email,
    name,
    surname,
    role: normalizeUserRole(user.role) ?? ROLE_CODES.USER,
  }
}

export async function register(payload) {
  if (isMockApiEnabled()) {
    return payload
  }

  try {
    await httpClient.post('/api/auth/register', payload)
  } catch (error) {
    throw normalizeApiError(error, 'Unable to register')
  }
}

export async function login(payload) {
  if (isMockApiEnabled()) {
    const email = payload?.email ?? ''
    const mockUser = normalizeCurrentUser({
      ...mockUserDefaults,
      email,
      username: email || mockUserDefaults.username,
      role: deriveMockRoleFromEmail(email),
    })
    writeMockSession(mockUser)
    return mockUser
  }

  try {
    await httpClient.post('/api/auth/login', payload)
    return getCurrentUser()
  } catch (error) {
    throw normalizeApiError(error, 'Unable to sign in')
  }
}

export async function logout() {
  if (isMockApiEnabled()) {
    clearMockSession()
    return
  }

  try {
    await httpClient.post('/api/auth/logout')
  } catch (error) {
    throw normalizeApiError(error, 'Unable to sign out')
  }
}

export async function getCurrentUser() {
  if (isMockApiEnabled()) {
    return readMockSession()
  }

  try {
    const data = await fetchGraphQL(CURRENT_USER_QUERY)
    return normalizeCurrentUser(data?.me ?? null)
  } catch (error) {
    const apiError = normalizeApiError(error, 'Unable to load current user')

    if (apiError.status === 401 || apiError.status === 403) {
      return null
    }

    if (apiError.source === 'graphql' && /permission|unauth|forbidden/i.test(apiError.message)) {
      return null
    }

    throw new ApiError(apiError.message, {
      details: apiError.details,
      source: apiError.source,
      status: apiError.status,
    })
  }
}
