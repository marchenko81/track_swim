import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

import { api } from '@/src/api/client'
import { getCacheItem, setCacheItem } from '@/src/api/cache-store'
import type { ActivityDetail, Assignment, CoachAthleteMetrics, Insight, MetricsPayload, Session, TeamMetricsPayload, TeamRelationship, TodayPayload, TrainingPlan } from '@/src/types/domain'

async function fetchWithCache<T>(key: string, request: () => Promise<T>, ttlMs?: number) {
  const cached = await getCacheItem(key)
  if (cached) {
    const parsed = JSON.parse(cached) as { expiresAt?: number; value: T }
    if (!parsed.expiresAt || parsed.expiresAt > Date.now()) return parsed.value
  }
  const value = await request()
  await setCacheItem(key, JSON.stringify({ value, expiresAt: ttlMs ? Date.now() + ttlMs : undefined }))
  return value
}

export function useToday() {
  return useQuery({
    queryKey: ['today'],
    queryFn: () => fetchWithCache<TodayPayload>('today:session', async () => (await api.get('/today/')).data, 1000 * 60 * 60 * 12),
  })
}

export function useUnreadInsight() {
  return useQuery({
    queryKey: ['insights', 'unread-highlight'],
    queryFn: () => fetchWithCache<any>('insights:feed', async () => (await api.get('/insights/?unread=true')).data, 1000 * 60 * 60),
  })
}

export function useInsights(params = '') {
  return useQuery({ queryKey: ['insights', params], queryFn: async () => (await api.get(`/insights/${params}`)).data })
}

export function useMetrics(range: string) {
  return useQuery({
    queryKey: ['metrics', range],
    queryFn: () => fetchWithCache<MetricsPayload>('metrics:summary', async () => (await api.get(`/metrics/athlete/?range=${range}`)).data, 1000 * 60 * 60),
  })
}

export function useTeamMetrics(range: string) {
  return useQuery({ queryKey: ['team-metrics', range], queryFn: async () => (await api.get(`/metrics/team/?range=${range}`)).data as TeamMetricsPayload })
}

export function useAssignments() {
  return useQuery({ queryKey: ['assignments'], queryFn: async () => (await api.get('/assignments/')).data as Assignment[] })
}

export function usePlans() {
  return useQuery({ queryKey: ['plans'], queryFn: async () => (await api.get('/plans/')).data as TrainingPlan[] })
}

export function usePlanDetail(planId?: string) {
  return useQuery({ enabled: !!planId, queryKey: ['plan', planId], queryFn: async () => (await api.get(`/plans/${planId}/`)).data as TrainingPlan })
}

export function usePlanSessions(planId?: string) {
  return useQuery({ enabled: !!planId, queryKey: ['plan-sessions', planId], queryFn: async () => (await api.get(`/plans/${planId}/sessions/`)).data as Session[] })
}

export function useTeamRoster() {
  return useQuery({ queryKey: ['team-roster'], queryFn: async () => (await api.get('/team/athletes/')).data as TeamRelationship[] })
}

export function useCoachAthleteMetrics(athleteId?: string, range = '8w') {
  return useQuery({ enabled: !!athleteId, queryKey: ['coach-athlete', athleteId, range], queryFn: async () => (await api.get(`/metrics/athlete/${athleteId}/?range=${range}`)).data as CoachAthleteMetrics })
}

export function useActivityDetail(id?: string) {
  return useQuery({ enabled: !!id, queryKey: ['activity', id], queryFn: async () => (await api.get(`/strava/activities/${id}/`)).data as ActivityDetail })
}

export function useInsightDetail(id?: string) {
  return useQuery({ enabled: !!id, queryKey: ['insight', id], queryFn: async () => (await api.get(`/insights/${id}/`)).data as Insight })
}

export function useWorkoutLogger() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (payload: Record<string, unknown>) => (await api.post('/workouts/', payload)).data,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })
}
