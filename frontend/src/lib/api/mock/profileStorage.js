const PROFILE_STORAGE_KEY = 'seatlock.profile.personal'

const defaultPersonalInfo = {
  firstName: '',
  lastName: '',
  email: '',
}

function readStorage(key, fallback) {
  if (typeof window === 'undefined') {
    return fallback
  }

  try {
    const value = window.localStorage.getItem(key)

    if (!value) {
      return fallback
    }

    return JSON.parse(value)
  } catch {
    return fallback
  }
}

function writeStorage(key, value) {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(key, JSON.stringify(value))
}

export function readPersonalInfo() {
  const stored = readStorage(PROFILE_STORAGE_KEY, {})

  return {
    firstName: stored.firstName ?? defaultPersonalInfo.firstName,
    lastName: stored.lastName ?? defaultPersonalInfo.lastName,
    email: stored.email ?? defaultPersonalInfo.email,
  }
}

export function savePersonalInfo(data) {
  writeStorage(PROFILE_STORAGE_KEY, {
    firstName: data.firstName ?? '',
    lastName: data.lastName ?? '',
    email: data.email ?? '',
  })
}
