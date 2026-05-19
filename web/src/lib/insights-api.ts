import { api } from './api'

export type InsightType = 'post_workout' | 'recovery' | 'load_alert' | 'weekly_digest' | 'technique'
export type InsightAudience = 'athlete' | 'coach' | 'both'

export interface InsightMetric {
  value: number
  unit: string
}

export interface InsightTrend {
  direction: 'improving' | 'declining' | 'plateau' | 'neutral'
  pct_change: number
}

export interface InsightItem {
  id: string
  athlete: number | string
  athlete_name: string
  workout_log: string | null
  generated_by_coach: number | string | null
  insight_type: InsightType
  insight_type_label: string
  target_audience: InsightAudience
  content: string
  preview: string
  model_used: string
  prompt_version: string
  tokens_used: number | null
  is_fallback: boolean
  created_at: string
  unread: boolean
  is_read_athlete: boolean
  is_read_coach: boolean
  input_context?: Record<string, any>
  session_reference?: {
    session_name: string | null
    logged_date: string
    actual_distance_m: number | null
  } | null
  metrics?: Record<string, InsightMetric>
  trends?: Record<string, InsightTrend>
}

export interface InsightListResponse {
  count: number
  next: string | null
  previous: string | null
  unread_count: number
  results: InsightItem[]
}

export const insightsApi = {
  list: (params: {
    type?: string
    unread?: boolean
    athleteId?: string
    page?: number
    pageSize?: number
    limit?: number
  } = {}) => {
    const search = new URLSearchParams()
    if (params.type) search.set('type', params.type)
    if (params.unread) search.set('unread', 'true')
    if (params.athleteId) search.set('athlete_id', params.athleteId)
    if (params.page) search.set('page', String(params.page))
    if (params.pageSize) search.set('page_size', String(params.pageSize))
    if (params.limit) search.set('limit', String(params.limit))
    const query = search.toString()
    return api.get<InsightListResponse>(`/insights/${query ? `?${query}` : ''}`)
  },
  detail: (id: string) => api.get<InsightItem>(`/insights/${id}/`),
  share: (id: string) => api.post<InsightItem>(`/insights/${id}/share/`, {}),
  unreadCount: () => api.get<{ count: number }>('/insights/unread-count/'),
  generate: (data: { athlete_id?: string; insight_type: 'post_workout' | 'weekly_digest' }) =>
    api.post<{ status: string; insight_id: string | null }>('/insights/generate/', data),
}

export function insightFilterToType(filter: 'all' | 'post_workout' | 'digests' | 'alerts') {
  if (filter === 'digests') return 'weekly_digest'
  if (filter === 'alerts') return 'load_alert'
  return filter
}

export function formatInsightRelativeTime(value: string, fallbackJustNow: string) {
  const diff = Date.now() - new Date(value).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return fallbackJustNow
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

export function formatMetricValue(metricKey: string, metric?: InsightMetric) {
  if (!metric) return null
  if (metricKey === 'pace_avg') {
    const totalSeconds = Math.round(metric.value)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${String(seconds).padStart(2, '0')}/100m`
  }
  if (metric.unit === 'score') return metric.value.toFixed(1)
  if (metric.unit === 'sec/100m') return `${metric.value.toFixed(1)} sec`
  return `${metric.value.toFixed(metric.value % 1 ? 1 : 0)} ${metric.unit}`
}

export function getInsightLastSentence(content: string) {
  const sentences = content.split(/(?<=[.!?])\s+/).filter(Boolean)
  return sentences[sentences.length - 1] ?? content
}
