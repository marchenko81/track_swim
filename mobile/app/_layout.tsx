import '../global.css'

// Cayu Mobile SDK - enables browser automation for Expo Web
// This import is auto-injected by cayu-pilot
import '../cayu-mobile-sdk'
import '@/src/i18n'

import { GestureHandlerRootView } from 'react-native-gesture-handler'
import { BottomSheetModalProvider } from '@gorhom/bottom-sheet'
import { ThemeProvider } from '@react-navigation/native'
import { PortalHost } from '@rn-primitives/portal'
import { QueryClientProvider } from '@tanstack/react-query'
import { useFonts } from 'expo-font'
import * as Notifications from 'expo-notifications'
import { Stack, useRouter, useSegments } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { useEffect } from 'react'
import { ActivityIndicator, View } from 'react-native'
import 'react-native-reanimated'

import { OfflineBanner } from '@/src/components/offline-banner'
import { queryClient } from '@/src/api/query-client'
import { useAuthStore } from '@/src/stores/auth-store'
import { useOfflineBootstrap } from '@/src/stores/offline-store'

export { ErrorBoundary } from 'expo-router'

export const unstable_settings = {
  initialRouteName: '(athlete)',
}

SplashScreen.preventAutoHideAsync()

export default function RootLayout() {
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  })

  useEffect(() => {
    if (error) throw error
  }, [error])

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync()
    }
  }, [loaded])

  if (!loaded) {
    return null
  }

  return <RootLayoutNav />
}

function RootLayoutNav() {
  const initialize = useAuthStore((state) => state.initialize)
  const isHydrating = useAuthStore((state) => state.isHydrating)
  const user = useAuthStore((state) => state.user)
  const router = useRouter()
  const segments = useSegments()

  useOfflineBootstrap()

  useEffect(() => {
    initialize()
  }, [initialize])

  useEffect(() => {
    const handleNotificationRoute = (route: unknown) => {
      if (typeof route !== 'string' || !route.startsWith('/')) return
      router.push(route as never)
    }

    Notifications.getLastNotificationResponseAsync().then((response) => {
      handleNotificationRoute(response?.notification.request.content.data?.route)
    }).catch(() => {})

    const subscription = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationRoute(response.notification.request.content.data?.route)
    })

    return () => {
      subscription.remove()
    }
  }, [router])

  useEffect(() => {
    if (isHydrating) return

    const inAuthGroup = segments[0] === '(auth)'
    if (!user) {
      if (!inAuthGroup) router.replace('/(auth)/login')
      return
    }

    if (!user.onboarding_completed && segments[1] !== 'onboarding') {
      router.replace('/(auth)/onboarding')
      return
    }

    if (user.onboarding_completed && inAuthGroup) {
      router.replace(user.role === 'coach' ? '/(coach)' : '/(athlete)')
    }
  }, [isHydrating, router, segments, user])

  if (isHydrating) {
    return (
      <View className="flex-1 items-center justify-center bg-background">
        <ActivityIndicator size="large" color="#0ea5e9" />
      </View>
    )
  }

  return (
    <QueryClientProvider client={queryClient}>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <BottomSheetModalProvider>
          <ThemeProvider value={{ dark: false, colors: { primary: '#0ea5e9', background: '#f4f7fb', card: '#ffffff', text: '#0f172a', border: '#dbe3ef', notification: '#ef4444' }, fonts: { regular: { fontFamily: 'System', fontWeight: '400' }, medium: { fontFamily: 'System', fontWeight: '500' }, bold: { fontFamily: 'System', fontWeight: '700' }, heavy: { fontFamily: 'System', fontWeight: '800' } } }}>
            <OfflineBanner />
            <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#f4f7fb' } }}>
              <Stack.Screen name="(auth)" />
              <Stack.Screen name="(athlete)" />
              <Stack.Screen name="(coach)" />
              <Stack.Screen name="session/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="activity/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="insight/[id]" options={{ presentation: 'card' }} />
              <Stack.Screen name="athlete/[id]" options={{ presentation: 'card' }} />
            </Stack>
            <PortalHost />
          </ThemeProvider>
        </BottomSheetModalProvider>
      </GestureHandlerRootView>
    </QueryClientProvider>
  )
}
