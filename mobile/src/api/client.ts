import axios from 'axios'

import { getApiBaseUrl } from '@/src/api/base-url'
import { clearStoredTokens, getStoredTokens, setStoredTokens } from '@/src/api/token-storage'

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { Accept: 'application/json' },
})

let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken() {
  if (isRefreshing && refreshPromise) return refreshPromise
  isRefreshing = true
  refreshPromise = (async () => {
    const tokens = await getStoredTokens()
    if (!tokens?.refresh) return null
    try {
      const response = await axios.post(`${getApiBaseUrl()}/users/auth/token/refresh/`, { refresh: tokens.refresh }, { headers: { Accept: 'application/json' } })
      const next = { access: response.data.access, refresh: response.data.refresh ?? tokens.refresh }
      await setStoredTokens(next)
      return next.access
    } catch {
      await clearStoredTokens()
      return null
    } finally {
      isRefreshing = false
    }
  })()
  return refreshPromise
}

api.interceptors.request.use(async (config) => {
  const tokens = await getStoredTokens()
  if (tokens?.access) config.headers.Authorization = `Bearer ${tokens.access}`
  if (!(config.data instanceof FormData)) config.headers['Content-Type'] = 'application/json'
  return config
})

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config
    if (error.response?.status === 401 && !originalRequest?._retry) {
      originalRequest._retry = true
      const access = await refreshAccessToken()
      if (access) {
        originalRequest.headers.Authorization = `Bearer ${access}`
        return api(originalRequest)
      }
    }
    return Promise.reject(error)
  }
)

export { api }
