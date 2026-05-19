import { Platform } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'

const mmkv = Platform.OS === 'web' ? null : new (require('react-native-mmkv').MMKV)({ id: 'swimcoach-mobile' })

export async function getCacheItem(key: string): Promise<string | null> {
  if (mmkv) return mmkv.getString(key) ?? null
  return AsyncStorage.getItem(key)
}

export async function setCacheItem(key: string, value: string) {
  if (mmkv) {
    mmkv.set(key, value)
    return
  }
  await AsyncStorage.setItem(key, value)
}

export async function removeCacheItem(key: string) {
  if (mmkv) {
    mmkv.delete(key)
    return
  }
  await AsyncStorage.removeItem(key)
}
