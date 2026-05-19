import { useEffect } from 'react'
import { create } from 'zustand'
import * as Network from 'expo-network'

import { queryClient } from '@/src/api/query-client'
import { api } from '@/src/api/client'
import { getCacheItem, setCacheItem } from '@/src/api/cache-store'

const WORKOUT_QUEUE_KEY = 'queue:workout_logs'

type OfflineState = {
  isOffline: boolean
  setOffline: (value: boolean) => void
  enqueueWorkoutLog: (payload: Record<string, unknown>) => Promise<void>
  flushWorkoutLogQueue: () => Promise<void>
}

export const useOfflineStore = create<OfflineState>((set) => ({
  isOffline: false,
  setOffline: (value) => set({ isOffline: value }),
  enqueueWorkoutLog: async (payload) => {
    const current = JSON.parse((await getCacheItem(WORKOUT_QUEUE_KEY)) || '[]') as Record<string, unknown>[]
    current.push(payload)
    await setCacheItem(WORKOUT_QUEUE_KEY, JSON.stringify(current))
  },
  flushWorkoutLogQueue: async () => {
    const items = JSON.parse((await getCacheItem(WORKOUT_QUEUE_KEY)) || '[]') as Record<string, unknown>[]
    if (!items.length) return
    const failed: Record<string, unknown>[] = []
    for (const item of items) {
      try {
        await api.post('/workouts/', item)
      } catch (error: any) {
        if (error?.response?.status !== 409) failed.push(item)
      }
    }
    await setCacheItem(WORKOUT_QUEUE_KEY, JSON.stringify(failed))
  },
}))

export function useOfflineBootstrap() {
  const setOffline = useOfflineStore((state) => state.setOffline)
  const flushWorkoutLogQueue = useOfflineStore((state) => state.flushWorkoutLogQueue)

  useEffect(() => {
    let mounted = true
    async function syncState() {
      const state = await Network.getNetworkStateAsync()
      if (!mounted) return
      const offline = !state.isConnected
      setOffline(offline)
      if (!offline) {
        await flushWorkoutLogQueue()
        queryClient.invalidateQueries()
      }
    }
    syncState()
    const timer = setInterval(syncState, 10000)
    return () => {
      mounted = false
      clearInterval(timer)
    }
  }, [flushWorkoutLogQueue, setOffline])
}
