import { create } from 'zustand'
import * as Notifications from 'expo-notifications'
import { Platform } from 'react-native'
import i18n from '@/src/i18n'
import { api } from '@/src/api/client'
import { clearStoredTokens, getStoredTokens, setStoredTokens, type AuthTokens } from '@/src/api/token-storage'
import { queryClient } from '@/src/api/query-client'
import type { UserProfile } from '@/src/types/domain'

type AuthState = {
  user: UserProfile | null
  tokens: AuthTokens | null
  isHydrating: boolean
  initialize: () => Promise<void>
  login: (email: string, password: string, inviteToken?: string) => Promise<UserProfile>
  register: (payload: Record<string, unknown>) => Promise<UserProfile>
  logout: () => Promise<void>
  updateProfile: (payload: Partial<UserProfile>) => Promise<UserProfile>
}

function getDeviceTimezone() {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC'
}

async function syncDeviceContext(user: UserProfile) {
  const payload: Partial<UserProfile> = {}
  const deviceTimezone = getDeviceTimezone()

  if (deviceTimezone && deviceTimezone !== user.timezone) {
    payload.timezone = deviceTimezone
  }

  if (Platform.OS !== 'web') {
    const permission = await Notifications.requestPermissionsAsync()
    if (permission.status === 'granted') {
      const token = (await Notifications.getExpoPushTokenAsync()).data
      if (token && token !== user.expo_push_token) {
        payload.expo_push_token = token
      }
    }
  }

  if (Object.keys(payload).length === 0) {
    return user
  }

  const { data } = await api.patch<UserProfile>('/users/profile/', payload)
  return data
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  tokens: null,
  isHydrating: true,
  initialize: async () => {
    const tokens = await getStoredTokens()
    if (!tokens) {
      set({ user: null, tokens: null, isHydrating: false })
      return
    }
    try {
      const { data } = await api.get<UserProfile>('/users/profile/')
      const synced = await syncDeviceContext(data)
      set({ user: synced, tokens, isHydrating: false })
      if (synced.language) i18n.changeLanguage(synced.language)
    } catch {
      await clearStoredTokens()
      set({ user: null, tokens: null, isHydrating: false })
    }
  },
  login: async (email, password, inviteToken) => {
    const { data } = await api.post<{ access: string; refresh: string; user: UserProfile }>('/users/auth/login/', { email, password, invite_token: inviteToken })
    await setStoredTokens({ access: data.access, refresh: data.refresh })
    const synced = await syncDeviceContext(data.user)
    set({ user: synced, tokens: { access: data.access, refresh: data.refresh } })
    i18n.changeLanguage(synced.language || 'en')
    return synced
  },
  register: async (payload) => {
    const { data } = await api.post<{ access: string; refresh: string; user: UserProfile }>('/users/auth/register/', payload)
    await setStoredTokens({ access: data.access, refresh: data.refresh })
    const synced = await syncDeviceContext(data.user)
    set({ user: synced, tokens: { access: data.access, refresh: data.refresh } })
    i18n.changeLanguage(synced.language || 'en')
    return synced
  },
  logout: async () => {
    const tokens = get().tokens ?? (await getStoredTokens())
    if (tokens?.refresh) {
      try { await api.post('/users/auth/logout/', { refresh: tokens.refresh }) } catch {}
    }
    await clearStoredTokens()
    queryClient.clear()
    set({ user: null, tokens: null })
  },
  updateProfile: async (payload) => {
    const { data } = await api.patch<UserProfile>('/users/profile/', payload)
    set({ user: data })
    if (data.language) i18n.changeLanguage(data.language)
    return data
  },
}))
