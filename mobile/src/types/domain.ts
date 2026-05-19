export type Role = 'coach' | 'athlete'
export type Language = 'en' | 'ru'

export type UserProfile = {
  id: number
  email: string
  first_name: string
  last_name: string
  language: Language
  role: Role
  avatar_url?: string | null
  date_of_birth?: string | null
  sport?: string
  stroke_specialty?: string
  fitness_level?: string
  club_name?: string | null
  onboarding_completed: boolean
  expo_push_token?: string | null
  daily_session_reminders_enabled: boolean
  daily_session_reminder_time: string
  coach_messages_notifications_enabled: boolean
  timezone: string
}

export type SessionSet = {
  id: string
  order: number
  set_type: string
  repetitions: number
  distance_m: number | null
  stroke: string
  equipment: string[]
  rest_seconds?: number | null
  send_off_interval?: string | null
  target_pace_per_100m?: string | null
  target_hr_zone?: number | null
  intensity_rpe?: number | null
  description?: string | null
}

export type Session = {
  id: string
  plan: string
  name: string
  description?: string | null
  week_number: number
  day_of_week: number
  session_type: string
  estimated_duration_min?: number | null
  coach_notes?: string | null
  total_distance_m: number
  sets: SessionSet[]
  log_status?: string | null
}

export type TodayPayload = {
  session: Session | null
  assignment: {
    id?: string
    plan_name: string
    week_number: number
    total_weeks: number
    start_date?: string
    custom_notes?: string | null
  } | null
  plan_completed?: boolean
}

export type TrainingPlan = {
  id: string
  name: string
  description?: string | null
  duration_weeks: number
  difficulty: string
  session_count: number
  total_distance_m: number
  sessions?: Session[]
}

export type Assignment = {
  id: string
  plan: string
  plan_name: string
  plan_duration_weeks: number
  start_date: string
  end_date: string
  status: string
  custom_notes?: string | null
}

export type Insight = {
  id: string
  athlete?: number
  workout_log?: string | null
  insight_type: string
  insight_type_label: string
  content: string
  preview: string
  created_at: string
  unread: boolean
  session_reference?: { session_name?: string | null; logged_date?: string; actual_distance_m?: number | null } | null
  metrics?: Record<string, { value: number; unit: string }>
  trends?: Record<string, { direction: string; pct_change: number }>
  target_audience?: string
}

export type MetricsPayload = {
  range: string
  summary: {
    swolf_avg?: number | null
    swolf_trend?: { direction: string; pct_change: number }
    pace_avg_sec?: number | null
    pace_trend?: { direction: string; pct_change: number }
    hr_avg?: number | null
    hr_trend?: { direction: string; pct_change: number }
    compliance_score?: number | null
    total_distance_m: number
    sessions_completed: number
    sessions_planned: number
  }
  chart_data: Array<{ date: string; swolf_avg?: number | null; pace_avg?: number | null; compliance_score?: number | null }>
  heatmap: Array<{ date: string; count: number }>
  personal_bests: Array<{ label: string; value: number | string; unit: string }>
  stroke_distribution: Record<string, number>
}

export type TeamAthleteRow = {
  id: string
  name: string
  first_name: string
  last_name: string
  avatar_url?: string | null
  compliance?: number | null
  swolf_avg?: number | null
  sessions_completed: number
  sessions_planned: number
  status: 'on_track' | 'at_risk'
  last_session_date?: string | null
}

export type TeamMetricsPayload = {
  range: string
  summary: {
    team_swolf_avg?: number | null
    team_compliance?: number | null
    at_risk_count: number
    total_athletes: number
    active_athletes: number
  }
  athletes: TeamAthleteRow[]
  stroke_distribution: Record<string, number>
}

export type TeamRelationship = {
  id: string
  status: string
  invite_email?: string
  invited_at?: string
  accepted_at?: string
  athlete_profile?: {
    id: string
    first_name: string
    last_name: string
    email: string
    avatar_url?: string | null
    fitness_level?: string
    stroke_specialty?: string
  } | null
}

export type CoachAthleteMetrics = MetricsPayload & {
  athlete_info: {
    id: string
    name: string
    fitness_level?: string
    stroke_specialty?: string
    current_plan?: { id: string; name: string; week_current: number; week_total: number } | null
  }
  session_history: Array<{ id: string; date: string; session_name?: string | null; actual_distance_m?: number | null; avg_swolf?: number | null; status: string }>
  coach_notes: Array<{ id: string; content: string; created_at: string }>
}

export type ActivityDetail = {
  id: string
  strava_activity_id?: number | null
  logged_date: string
  actual_distance_m?: number | null
  actual_duration_min?: number | null
  pool_length_m?: number | null
  avg_hr_bpm?: number | null
  max_hr_bpm?: number | null
  source: string
  status: string
  session_name?: string | null
  swolf_avg?: number | null
  is_matched: boolean
  set_logs: Array<{ id: string; order: number; repetitions_completed?: number | null; distance_m?: number | null; stroke?: string | null; avg_pace_per_100m?: number | null; avg_hr_bpm?: number | null; avg_swolf?: number | null }>
  metric_snapshots: Array<{ id: string; metric_type: string; value: number; unit: string }>
}
