import { describe, expect, it } from 'vitest'
import { normalizeApiError } from './errors'

describe('normalizeApiError', () => {
  it('uses the backend error field and preserves the status', () => {
    const error = normalizeApiError({
      message: 'Request failed with status code 401',
      response: {
        data: { error: 'Invalid credentials' },
        status: 401,
      },
    })

    expect(error.message).toBe('Invalid credentials')
    expect(error.status).toBe(401)
  })
})
