import { ApiError } from 'lib/api/errors'
import { GRAPHQL_URL, REQUEST_CREDENTIALS } from 'lib/api/runtime'

export async function fetchGraphQL(query, { variables, signal } = {}) {
  const response = await fetch(GRAPHQL_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    credentials: REQUEST_CREDENTIALS,
    body: JSON.stringify({
      query,
      variables,
    }),
    signal,
  })

  const payload = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(
      payload?.errors?.[0]?.message ?? `GraphQL request failed with status ${response.status}`,
      {
        details: payload?.errors,
        source: 'graphql',
        status: response.status,
      },
    )
  }

  if (payload?.errors?.length) {
    throw new ApiError(payload.errors[0].message ?? 'GraphQL request failed', {
      details: payload.errors,
      source: 'graphql',
      status: response.status,
    })
  }

  return payload?.data ?? null
}
