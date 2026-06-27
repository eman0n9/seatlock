import axios from 'axios'
import { normalizeApiError } from 'lib/api/errors'
import { API_URL, REQUEST_CREDENTIALS } from 'lib/api/runtime'

export const httpClient = axios.create({
  baseURL: API_URL,
  withCredentials: REQUEST_CREDENTIALS === 'include',
})

httpClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(normalizeApiError(error)),
)
