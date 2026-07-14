export function getSafeInternalRedirect(value, fallback) {
  if (
    typeof value !== 'string' ||
    !value.startsWith('/') ||
    value.startsWith('//') ||
    value.includes('\\')
  ) {
    return fallback
  }

  try {
    const baseUrl = 'http://seatlock.local'
    const redirectUrl = new URL(value, baseUrl)

    return redirectUrl.origin === baseUrl
      ? `${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`
      : fallback
  } catch {
    return fallback
  }
}
