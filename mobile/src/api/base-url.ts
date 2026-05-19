import { Platform } from 'react-native'

const LOCAL_IP = process.env.EXPO_PUBLIC_LOCAL_IP || '192.168.1.2'
const SANDBOX_API_URL = process.env.EXPO_PUBLIC_API_URL

export function getApiBaseUrl(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.location.hostname === 'localhost') {
    const expoPort = parseInt(window.location.port, 10)
    if (expoPort > 9000) return `http://localhost:${expoPort - 2}/api`
  }

  if (SANDBOX_API_URL) return SANDBOX_API_URL

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname
    if (hostname.includes('.sandbox.cayu.app') && hostname.startsWith('mobile-')) {
      return `https://${hostname.replace('mobile-', '')}/api`
    }
  }

  return Platform.OS === 'web' ? 'http://localhost:8000/api' : `http://${LOCAL_IP}:8000/api`
}
