export const ROLE_CODES = Object.freeze({
  USER: 'USER',
  ORGANIZATION: 'ORGANIZATION',
  ADMIN: 'ADMIN',
})

const ROLE_LEVELS = Object.freeze({
  [ROLE_CODES.USER]: 0,
  [ROLE_CODES.ORGANIZATION]: 1,
  [ROLE_CODES.ADMIN]: 2,
})

const ROLE_ALIASES = Object.freeze({
  CUSTOMER: ROLE_CODES.USER,
  USER: ROLE_CODES.USER,
  ORGANIZER: ROLE_CODES.ORGANIZATION,
  ORGANISATION: ROLE_CODES.ORGANIZATION,
  ORGANIZATION: ROLE_CODES.ORGANIZATION,
  ADMIN: ROLE_CODES.ADMIN,
})

export function normalizeUserRole(role) {
  if (!role) return null

  const normalizedRole = role
    .toString()
    .trim()
    .toUpperCase()
    .replace(/^ROLE_/, '')

  return ROLE_ALIASES[normalizedRole] ?? null
}

export function hasRequiredRole(userRole, requiredRoles = []) {
  const normalizedUserRole = normalizeUserRole(userRole)

  if (!normalizedUserRole || !requiredRoles.length) {
    return false
  }

  const userLevel = ROLE_LEVELS[normalizedUserRole]

  return requiredRoles.some((requiredRole) => {
    const normalizedRequiredRole = normalizeUserRole(requiredRole)
    return normalizedRequiredRole != null && userLevel >= ROLE_LEVELS[normalizedRequiredRole]
  })
}
