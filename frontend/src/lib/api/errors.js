export class ApiError extends Error {
  constructor(message, { status = 500, source = 'api', details = null } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.source = source
    this.details = details
  }
}

export function normalizeApiError(error, fallbackMessage = 'Request failed') {
  if (error instanceof ApiError) {
    return error
  }

  if (error?.response) {
    return new ApiError(
      error.response.data?.message ?? error.message ?? fallbackMessage,
      {
        details: error.response.data,
        source: 'http',
        status: error.response.status ?? 500,
      },
    )
  }

  return new ApiError(error?.message ?? fallbackMessage)
}
