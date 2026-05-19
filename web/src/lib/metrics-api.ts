import { getAccessToken } from '@/lib/auth'
import { api, ApiError } from '@/lib/api'

export type MetricsRange = '4w' | '8w' | '12w' | 'season'

export type TrendDirection = 'improving' | 'declining' | 'stable'

export interface MetricTrend {
  direction: TrendDirection
  pct_change: number
  sessions: number
}

export interface MetricChartPoint {
  date: string
  swolf: number | null
  pace: number | null
  hr: number | null
  distance: number | null
  workout_log_id?: string
  session_name?: string | null
}

export interface HeatmapPoint {
  date: string
  count: number
}

export interface PersonalBest {
  distance_m: number
  stroke: string
  pace_sec: number
  date: string
}

export interface StrokeDistribution {
  freestyle: number
  backstroke: number
  breaststroke: number
  butterfly: number
  im: number
}

export interface AthleteMetricsResponse {
  range: MetricsRange
  summary: {
    swolf_avg: number | null
    swolf_trend: MetricTrend
    pace_avg_sec: number | null
    pace_trend: MetricTrend
    hr_avg: number | null
    hr_trend: MetricTrend
    compliance_score: number | null
    total_distance_m: number
    sessions_completed: number
    sessions_planned: number
  }
  chart_data: MetricChartPoint[]
  heatmap: HeatmapPoint[]
  personal_bests: PersonalBest[]
  stroke_distribution: StrokeDistribution
}

export interface TeamAthleteRow {
  id: string
  name: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  compliance: number | null
  swolf_avg: number | null
  sessions_completed: number
  sessions_planned: number
  status: 'on_track' | 'at_risk'
  last_session_date: string | null
}

export interface TeamMetricsResponse {
  range: MetricsRange
  summary: {
    team_swolf_avg: number | null
    team_compliance: number | null
    at_risk_count: number
    total_athletes: number
    active_athletes: number
  }
  athletes: TeamAthleteRow[]
  stroke_distribution: StrokeDistribution
}

export interface AthleteDetailResponse extends AthleteMetricsResponse {
  athlete_info: {
    id: string
    name: string
    fitness_level: string
    stroke_specialty: string
    current_plan: {
      id: string
      name: string
      week_current: number
      week_total: number
    } | null
  }
  session_history: {
    id: string
    date: string
    session_name: string | null
    actual_distance_m: number | null
    avg_swolf: number | null
    status: 'completed' | 'skipped' | 'missed'
  }[]
  coach_notes: {
    id: string
    content: string
    created_at: string
  }[]
}

function normalizeRange(range?: string): MetricsRange {
  return range === '4w' || range === '8w' || range === '12w' || range === 'season' ? range : '8w'
}

async function downloadFile(endpoint: string, fallbackFilename: string): Promise<void> {
  const token = getAccessToken()
  const response = await fetch(`/api${endpoint}`, {
    headers: {
      Accept: 'application/octet-stream',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  })

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(response.status, data)
  }

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  const disposition = response.headers.get('Content-Disposition')
  const match = disposition?.match(/filename="([^"]+)"/)
  link.href = objectUrl
  link.download = match?.[1] ?? fallbackFilename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(objectUrl)
}

export const metricsApi = {
  normalizeRange,
  athlete: (range: MetricsRange) => api.get<AthleteMetricsResponse>(`/metrics/athlete/?range=${range}`),
  team: (range: MetricsRange) => api.get<TeamMetricsResponse>(`/metrics/team/?range=${range}`),
  athleteDetail: (athleteId: string, range: MetricsRange) =>
    api.get<AthleteDetailResponse>(`/metrics/athlete/${athleteId}/?range=${range}`),
  coachNotes: (athleteId: string) => api.get<AthleteDetailResponse['coach_notes']>(`/metrics/coach-notes/${athleteId}/`),
  createCoachNote: (athleteId: string, content: string) =>
    api.post<{ id: string; content: string; created_at: string }>('/metrics/coach-notes/', {
      athlete_id: athleteId,
      content,
    }),
  exportTeamCsv: (range: MetricsRange) =>
    downloadFile(`/metrics/team/export/?format=csv&range=${range}`, `swimcoach-team-${range}.csv`),
  exportTeamPdf: (range: MetricsRange) =>
    downloadFile(`/metrics/team/export/?format=pdf&range=${range}`, `swimcoach-team-${range}.pdf`),
}
