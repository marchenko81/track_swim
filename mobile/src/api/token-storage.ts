import { Platform } from 'react-native'
import * as SecureStore from 'expo-secure-store'

export type AuthTokens = { access: string; refresh: string }

const ACCESS_KEY = 'swimcoach_access_token'
const REFRESH_KEY = 'swimcoach_refresh_token'

export async function getStoredTokens(): Promise<AuthTokens | null> {
  if (Platform.OS === 'web') {
    if (typeof localStorage === 'undefined') return null
    const access = localStorage.getItem(ACCESS_KEY)
    const refresh = localStorage.getItem(REFRESH_KEY)
    return access && refresh ? { access, refresh } : null
  }
  const [access, refresh] = await Promise.all([
    SecureStore.getItemAsync(ACCESS_KEY),
    SecureStore.getItemAsync(REFRESH_KEY),
  ])
  return access && refresh ? { access, refresh } : null
}

export async function setStoredTokens(tokens: AuthTokens) {
  if (Platform.OS === 'web') {
    localStorage.setItem(ACCESS_KEY, tokens.access)
    localStorage.setItem(REFRESH_KEY, tokens.refresh)
    return
  }
  await Promise.all([
    SecureStore.setItemAsync(ACCESS_KEY, tokens.access),
    SecureStore.setItemAsync(REFRESH_KEY, tokens.refresh),
  ])
}

export async function clearStoredTokens() {
  if (Platform.OS === 'web') {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
    return
  }
  await Promise.all([
    SecureStore.deleteItemAsync(ACCESS_KEY),
    SecureStore.deleteItemAsync(REFRESH_KEY),
  ])
}
