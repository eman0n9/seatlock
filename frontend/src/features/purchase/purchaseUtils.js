// ─── Pricing constants ───────────────────────────────────────────────────────

export const HOLD_DURATION_MS = 10 * 60 * 1000 // 10 minutes
export const MAX_SEATS_PER_ORDER = 10

// ─── Pricing ─────────────────────────────────────────────────────────────────

/**
 * Compute the backend-aligned subtotal for a list of seats.
 * @param {Array<{ price?: number }>} seats
 * @returns {{ subtotal: number, total: number }}
 */
export function calculatePricing(seats) {
  const subtotal = seats.reduce((sum, seat) => sum + (seat.price ?? 0), 0)
  return { subtotal, total: subtotal }
}

/**
 * Format a numeric price as a dollar string, e.g. 64 → "$64".
 * @param {number} value
 * @returns {string}
 */
export function formatPrice(value) {
  return `$${value}`
}

// ─── Hold timers ─────────────────────────────────────────────────────────────

/**
 * Format a hold countdown in M:SS format.
 * @param {number} seconds
 * @returns {string}
 */
export function formatHoldTime(seconds) {
  if (!seconds || seconds <= 0) return '0:00'
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/**
 * Return seconds remaining on a hold, or null if no hold is active.
 * @param {number | null} holdExpiresAt  Unix timestamp in ms
 * @returns {number | null}
 */
export function getHoldTimeLeft(holdExpiresAt) {
  if (!holdExpiresAt) return null
  return Math.max(0, Math.floor((holdExpiresAt - Date.now()) / 1000))
}
