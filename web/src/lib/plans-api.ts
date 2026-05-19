import { api } from './api'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Difficulty = 'easy' | 'moderate' | 'hard' | 'race_pace'
export type Sport = 'swimming' | 'triathlon' | 'open_water'
export type SessionType =
  | 'warm_up' | 'drill' | 'threshold' | 'intervals'
  | 'race_pace' | 'recovery' | 'open_water'
export type SetType = 'warm_up' | 'main' | 'drill' | 'kick' | 'pull' | 'cool_down' | 'rest'
export type Stroke =
  | 'freestyle' | 'backstroke' | 'breaststroke'
  | 'butterfly' | 'im' | 'choice'
export type AssignmentStatus = 'active' | 'paused' | 'completed' | 'cancelled'
export type WorkoutStatus = 'completed' | 'partial' | 'skipped'

export interface SessionSet {
  id: string
  order: number
  set_type: SetType
  repetitions: number
  distance_m: number | null
  stroke: Stroke
  equipment: string[]
  rest_seconds: number | null
  send_off_interval: string | null
  target_pace_per_100m: string | null
  target_hr_zone: number | null
  target_hr_bpm: number | null
  intensity_rpe: number | null
  description: string | null
  video_url: string | null
  created_at: string
}

export interface Session {
  id: string
  plan: string
  name: string
  description: string | null
  week_number: number
  day_of_week: number
  session_type: SessionType
  estimated_duration_min: number | null
  coach_notes: string | null
  order_in_day: number
  created_at: string
  sets: SessionSet[]
  total_distance_m: number
  log_status?: WorkoutStatus | null
}

export interface TrainingPlan {
  id: string
  name: string
  description: string | null
  duration_weeks: number
  difficulty: Difficulty
  sport: Sport
  tags: string[]
  is_template: boolean
  is_archived: boolean
  cloned_from: string | null
  created_at: string
  updated_at: string
  session_count: number
  total_distance_m: number
}

export interface TrainingPlanDetail extends TrainingPlan {
  sessions: Session[]
}

export interface AthleteInfo {
  id: number
  first_name: string
  last_name: string
  email: string
  avatar_url: string | null
}

export interface PlanAssignment {
  id: string
  plan: string
  athlete: number
  assigned_by: number
  start_date: string
  end_date: string
  status: AssignmentStatus
  custom_notes: string | null
  created_at: string
  athlete_info: AthleteInfo
  plan_name: string
  plan_duration_weeks: number
}

export interface SetLibraryItem {
  id: string
  name: string
  set_type: SetType
  repetitions: number
  distance_m: number | null
  stroke: Stroke
  equipment: string[]
  rest_seconds: number | null
  send_off_interval: string | null
  target_pace_per_100m: string | null
  target_hr_zone: number | null
  target_hr_bpm: number | null
  intensity_rpe: number | null
  description: string | null
  created_at: string
}

export interface TodayResponse {
  session: Session | null
  assignment: {
    id: string
    plan_name: string
    week_number: number
    total_weeks: number
    start_date: string
    custom_notes: string | null
  } | null
  plan_completed?: boolean
}

export interface WorkoutLog {
  id: string
  session: string | null
  assignment: string | null
  logged_date: string
  status: WorkoutStatus
  perceived_effort_rpe: number | null
  athlete_notes: string | null
  source: string
  created_at: string
}

// ─── Plans API ────────────────────────────────────────────────────────────────

export const plansApi = {
  // Plans
  list: (template = false) =>
    api.get<TrainingPlan[]>(`/plans/?template=${template}`),

  get: (id: string) =>
    api.get<TrainingPlanDetail>(`/plans/${id}/`),

  create: (data: {
    name: string
    description?: string
    duration_weeks: number
    difficulty: Difficulty
    sport?: Sport
    tags?: string[]
    is_template?: boolean
  }) => api.post<TrainingPlan>('/plans/', data),

  update: (id: string, data: Partial<TrainingPlan>) =>
    api.patch<TrainingPlan>(`/plans/${id}/`, data),

  archive: (id: string) =>
    api.delete<void>(`/plans/${id}/`),

  clone: (id: string) =>
    api.post<{ id: string }>(`/plans/${id}/clone/`, {}),

  assign: (id: string, data: {
    athlete_ids?: number[]
    assign_full_team?: boolean
    start_date: string
    custom_notes?: string
  }) => api.post<{ assigned: number; warnings: { athlete_id: string; message: string }[] }>(
    `/plans/${id}/assign/`, data
  ),

  // Sessions
  listSessions: (planId: string) =>
    api.get<Session[]>(`/plans/${planId}/sessions/`),

  createSession: (planId: string, data: {
    name: string
    week_number: number
    day_of_week: number
    session_type: SessionType
    estimated_duration_min?: number | null
    coach_notes?: string | null
  }) => api.post<Session>(`/plans/${planId}/sessions/`, data),

  updateSession: (id: string, data: Partial<Session>) =>
    api.patch<Session>(`/sessions/${id}/`, data),

  deleteSession: (id: string) =>
    api.delete<void>(`/sessions/${id}/`),

  duplicateSession: (id: string, data: { week_number: number; day_of_week: number }) =>
    api.post<Session>(`/sessions/${id}/duplicate/`, data),

  // Sets
  listSets: (sessionId: string) =>
    api.get<SessionSet[]>(`/sessions/${sessionId}/sets/`),

  createSet: (sessionId: string, data: Partial<SessionSet>) =>
    api.post<SessionSet>(`/sessions/${sessionId}/sets/`, data),

  updateSet: (id: string, data: Partial<SessionSet>) =>
    api.patch<SessionSet>(`/sets/${id}/`, data),

  deleteSet: (id: string) =>
    api.delete<void>(`/sets/${id}/`),

  reorderSets: (sessionId: string, order: { id: string; order: number }[]) =>
    api.patch<{ status: string }>(`/sessions/${sessionId}/sets/reorder/`, { order }),

  saveSetToLibrary: (setId: string, name: string) =>
    api.post<SetLibraryItem>(`/sets/${setId}/save-to-library/`, { name }),

  addSetFromLibrary: (sessionId: string, libraryItemId: string) =>
    api.post<SessionSet>(`/sessions/${sessionId}/sets/from-library/`, {
      library_item_id: libraryItemId,
    }),

  // Set Library
  getLibrary: () =>
    api.get<SetLibraryItem[]>('/set-library/'),

  deleteLibraryItem: (id: string) =>
    api.delete<void>(`/set-library/${id}/`),

  // Assignments
  listAssignments: () =>
    api.get<PlanAssignment[]>('/assignments/'),

  updateAssignment: (id: string, data: { status?: AssignmentStatus; custom_notes?: string }) =>
    api.patch<PlanAssignment>(`/assignments/${id}/`, data),

  // Today
  getToday: () =>
    api.get<TodayResponse>('/today/'),

  // Workout logs
  logWorkout: (data: {
    session_id?: string
    assignment_id?: string
    logged_date: string
    status: WorkoutStatus
    perceived_effort_rpe?: number | null
    athlete_notes?: string | null
  }) => api.post<WorkoutLog>('/workouts/', data),

  listWorkouts: () =>
    api.get<WorkoutLog[]>('/workouts/'),
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  easy: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
  moderate: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  hard: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
  race_pace: 'bg-red-500/20 text-red-400 border-red-500/30',
}

export const SESSION_TYPE_COLORS: Record<SessionType, string> = {
  warm_up: 'bg-yellow-500/20 text-yellow-400',
  drill: 'bg-purple-500/20 text-purple-400',
  threshold: 'bg-orange-500/20 text-orange-400',
  intervals: 'bg-blue-500/20 text-blue-400',
  race_pace: 'bg-red-500/20 text-red-400',
  recovery: 'bg-green-500/20 text-green-400',
  open_water: 'bg-cyan-500/20 text-cyan-400',
}

export const SET_TYPE_COLORS: Record<SetType, string> = {
  warm_up: 'bg-yellow-500/20 text-yellow-400',
  main: 'bg-blue-500/20 text-blue-400',
  drill: 'bg-purple-500/20 text-purple-400',
  kick: 'bg-pink-500/20 text-pink-400',
  pull: 'bg-indigo-500/20 text-indigo-400',
  cool_down: 'bg-green-500/20 text-green-400',
  rest: 'bg-muted text-muted-foreground',
}

export const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export function setLabel(s: SessionSet): string {
  if (!s.distance_m) return `${s.repetitions}× ${s.stroke}`
  return `${s.repetitions} × ${s.distance_m}m ${s.stroke}`
}

export function sessionDistance(session: Session): number {
  return session.sets.reduce(
    (acc, s) => acc + (s.repetitions || 0) * (s.distance_m || 0),
    0
  )
}

export function formatDistance(m: number): string {
  if (m >= 1000) return `${(m / 1000).toFixed(1)}km`
  return `${m}m`
}
