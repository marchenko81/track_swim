import { getAccessToken, getRefreshToken, setTokens, clearTokens } from './auth'

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api'

export class ApiError extends Error {
  constructor(
    public status: number,
    public data: unknown
  ) {
    super(`Request failed with status ${status}`)
    this.name = 'ApiError'
  }
}

// Refresh lock — prevents concurrent refresh races
let isRefreshing = false
let refreshPromise: Promise<string | null> | null = null

async function refreshAccessToken(): Promise<string | null> {
  if (isRefreshing && refreshPromise) return refreshPromise
  isRefreshing = true
  refreshPromise = (async () => {
    try {
      const refresh = getRefreshToken()
      if (!refresh) return null
      const res = await fetch(`${API_BASE}/users/auth/token/refresh/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh }),
      })
      if (!res.ok) {
        clearTokens()
        return null
      }
      const data = await res.json()
      setTokens(data.access, data.refresh)
      return data.access
    } catch {
      clearTokens()
      return null
    } finally {
      isRefreshing = false
      refreshPromise = null
    }
  })()
  return refreshPromise
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const doFetch = (token: string | null) => {
    const headers: Record<string, string> = {}
    if (!(options.body instanceof FormData)) {
      headers['Content-Type'] = 'application/json'
    }
    if (token) headers['Authorization'] = `Bearer ${token}`
    // Merge caller headers last so they can override
    Object.assign(headers, options.headers as Record<string, string>)

    return fetch(`${API_BASE}${endpoint}`, { ...options, headers })
  }

  let access = getAccessToken()
  let res = await doFetch(access)

  if (res.status === 401 && getRefreshToken()) {
    const newAccess = await refreshAccessToken()
    if (newAccess) {
      access = newAccess
      res = await doFetch(newAccess)
    }
  }

  if (!res.ok) {
    const data = await res.json().catch(() => null)
    throw new ApiError(res.status, data)
  }

  if (res.status === 204) return undefined as T
  return res.json()
}

export const api = {
  get: <T>(endpoint: string) => apiFetch<T>(endpoint),
  post: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'PUT', body: JSON.stringify(data) }),
  patch: <T>(endpoint: string, data: unknown) =>
    apiFetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: <T>(endpoint: string) => apiFetch<T>(endpoint, { method: 'DELETE' }),
}

export function fetchHealth() {
  return api.get<{ status: string; message: string; oauth_enabled: boolean }>('/health/')
}
