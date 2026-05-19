import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Waves, Clock } from 'lucide-react'
import { format, addDays } from 'date-fns'
import { useLanguage } from '@/contexts/language-context'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import {
  plansApi, SESSION_TYPE_COLORS, SET_TYPE_COLORS,
  setLabel, formatDistance, type Session,
} from '@/lib/plans-api'

export const Route = createFileRoute('/_app/plan')({
  component: AthletePlanPage,
})

const DAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

// ─── Session Detail Sheet ─────────────────────────────────────────────────────
function SessionDetailSheet({ session, open, onClose }: {
  session: Session | null
  open: boolean
  onClose: () => void
}) {
  const { t } = useLanguage()
  if (!session) return null

  const totalDist = session.sets.reduce(
    (acc, s) => acc + (s.repetitions || 0) * (s.distance_m || 0), 0
  )

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-2xl">
        <SheetHeader className="pb-3">
          <SheetTitle>{session.name}</SheetTitle>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SESSION_TYPE_COLORS[session.session_type]}`}>
              {session.session_type.replace('_', ' ')}
            </span>
            {session.estimated_duration_min && <span>{session.estimated_duration_min} min</span>}
            {totalDist > 0 && <span>{formatDistance(totalDist)}</span>}
          </div>
        </SheetHeader>

        {session.coach_notes && (
          <div className="mb-3 rounded-xl bg-amber-500/10 px-3 py-2.5 border border-amber-500/20">
            <p className="text-xs font-semibold text-amber-400 mb-1">{t('session.coach_notes')}</p>
            <p className="text-xs text-muted-foreground">{session.coach_notes}</p>
          </div>
        )}

        <div className="space-y-2 pb-4">
          {session.sets.map((s) => (
            <div
              key={s.id}
              className={`rounded-xl border border-border p-3 ${s.set_type === 'main' ? 'bg-blue-500/5' : 'bg-card'}`}
            >
              <div className="flex items-start gap-2">
                <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${SET_TYPE_COLORS[s.set_type]}`}>
                  {s.set_type.toUpperCase().replace('_', ' ')}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">{setLabel(s)}</p>
                  {s.equipment.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {s.equipment.map((eq) => (
                        <span key={eq} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground capitalize">
                          {eq.replace('_', ' ')}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                    {s.target_pace_per_100m && <span>⏱ {s.target_pace_per_100m}/100m</span>}
                    {s.target_hr_zone && <span>❤ Z{s.target_hr_zone}</span>}
                    {s.intensity_rpe && <span>RPE {s.intensity_rpe}</span>}
                    {s.send_off_interval && <span>→ {s.send_off_interval}</span>}
                    {s.rest_seconds && <span>rest {s.rest_seconds}s</span>}
                  </div>
                  {s.description && (
                    <p className="mt-1 text-[11px] italic text-muted-foreground">{s.description}</p>
                  )}
                </div>
              </div>
            </div>
          ))}
          {session.sets.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-4">No sets added yet.</p>
          )}
          {totalDist > 0 && (
            <p className="pt-1 text-right text-xs font-semibold text-muted-foreground">
              Total: {formatDistance(totalDist)}
            </p>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────
function AthletePlanPage() {
  const { t } = useLanguage()
  const [viewWeek, setViewWeek] = useState(0) // offset from current week
  const [selectedSession, setSelectedSession] = useState<Session | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)

  const { data: todayData } = useQuery({
    queryKey: ['today'],
    queryFn: () => plansApi.getToday(),
    networkMode: 'always',
  })

  const { data: workouts = [] } = useQuery({
    queryKey: ['workouts'],
    queryFn: () => plansApi.listWorkouts(),
    networkMode: 'always',
  })

  // Fetch full plan detail to get all sessions
  const { data: planDetail } = useQuery({
    queryKey: ['plan', 'athlete-weekly'],
    queryFn: async () => {
      const assignments = await plansApi.listAssignments()
      const active = assignments.find((a) => a.status === 'active')
      if (!active) return null
      return plansApi.get(active.plan)
    },
    networkMode: 'always',
  })

  const activeAssignment = (() => {
    if (!planDetail || !todayData?.assignment) return null
    return todayData.assignment
  })()

  // Compute which week to display
  const startDate = activeAssignment
    ? new Date(activeAssignment.start_date)
    : new Date()

  // current plan week number
  const today = new Date()
  const daysSinceStart = Math.floor(
    (today.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
  )
  const currentPlanWeek = Math.max(1, Math.floor(daysSinceStart / 7) + 1)
  const displayWeek = currentPlanWeek + viewWeek
  const totalWeeks = planDetail?.duration_weeks ?? activeAssignment?.total_weeks ?? 0

  // Days in the displayed week
  const weekStartDate = addDays(startDate, (displayWeek - 1) * 7)
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStartDate, i))
  const todayStr = format(today, 'yyyy-MM-dd')

  // Sessions for display week
  const weekSessions = planDetail?.sessions.filter((s) => s.week_number === displayWeek) ?? []

  // Workout logs indexed by session+date
  const logMap = new Map(
    workouts.map((w) => [`${w.session}-${w.logged_date}`, w.status])
  )

  const getSessionStatus = (session: Session): 'completed' | 'skipped' | 'upcoming' | 'missed' => {
    const sessionDate = days[session.day_of_week]
    const dateStr = format(sessionDate, 'yyyy-MM-dd')
    const logStatus = logMap.get(`${session.id}-${dateStr}`)
    if (logStatus === 'completed') return 'completed'
    if (logStatus === 'skipped') return 'skipped'
    if (dateStr < todayStr) return 'missed'
    return 'upcoming'
  }

  const statusBadge = (status: ReturnType<typeof getSessionStatus>) => {
    const map = {
      completed: 'bg-emerald-500/20 text-emerald-400',
      skipped: 'bg-muted text-muted-foreground',
      upcoming: 'bg-blue-500/20 text-blue-400',
      missed: 'bg-red-500/20 text-red-400',
    }
    return (
      <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${map[status]}`}>
        {t(`workout.${status}`)}
      </span>
    )
  }

  const completedThisWeek = weekSessions.filter((s) => getSessionStatus(s) === 'completed').length

  if (!planDetail && !todayData) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!planDetail || !activeAssignment) {
    return (
      <div className="flex flex-col items-center justify-center px-4 py-20 text-center">
        <Waves className="mb-4 h-14 w-14 text-primary/30" />
        <h1 className="mb-2 text-lg font-bold text-foreground">{t('nav.plan')}</h1>
        <p className="text-sm text-muted-foreground">{t('plan.no_plan_yet')}</p>
      </div>
    )
  }

  return (
    <div className="px-4 pb-6 pt-5">
      {/* Week header */}
      <div className="mb-4 flex items-center justify-between">
        <button
          className="rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => setViewWeek((w) => w - 1)}
          disabled={displayWeek <= 1}
        >
          <ChevronLeft className="h-5 w-5" />
        </button>

        <div className="text-center">
          <p className="text-sm font-bold text-foreground">
            {t('session.week_of', { n: String(displayWeek), total: String(totalWeeks) })}
          </p>
          <p className="text-xs text-muted-foreground truncate max-w-[180px]">
            {activeAssignment.plan_name}
          </p>
        </div>

        <button
          className="rounded-full p-1 text-muted-foreground hover:text-foreground disabled:opacity-30"
          onClick={() => setViewWeek((w) => w + 1)}
          disabled={displayWeek >= totalWeeks}
        >
          <ChevronRight className="h-5 w-5" />
        </button>
      </div>

      {/* 7-day list */}
      <div className="space-y-2">
        {days.map((day, dayIdx) => {
          const dateStr = format(day, 'yyyy-MM-dd')
          const isToday = dateStr === todayStr
          const daySessions = weekSessions.filter((s) => s.day_of_week === dayIdx)
          const isPast = dateStr < todayStr && !isToday

          return (
            <div
              key={dateStr}
              className={`rounded-2xl border p-3 transition-colors ${
                isToday
                  ? 'border-primary/40 bg-primary/5'
                  : 'border-border bg-card'
              }`}
            >
              {/* Day header */}
              <div className="mb-2 flex items-center gap-2">
                <div className={`text-xs font-semibold ${isToday ? 'text-primary' : 'text-muted-foreground'}`}>
                  {DAY_LABELS[dayIdx]}
                </div>
                <div className={`text-xs ${isToday ? 'font-bold text-foreground' : 'text-muted-foreground'}`}>
                  {format(day, 'MMM d')}
                </div>
                {isToday && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground">
                    TODAY
                  </span>
                )}
              </div>

              {daySessions.length === 0 ? (
                <p className={`text-xs ${isPast ? 'text-muted-foreground/50' : 'text-muted-foreground'}`}>
                  {t('plan.rest_day')}
                </p>
              ) : (
                <div className="space-y-2">
                  {daySessions.map((session) => {
                    const status = getSessionStatus(session)
                    const dist = session.sets.reduce(
                      (acc, s) => acc + (s.repetitions || 0) * (s.distance_m || 0), 0
                    )
                    return (
                      <div
                        key={session.id}
                        className="cursor-pointer rounded-xl border border-border/60 bg-background/50 p-3 hover:bg-muted/30"
                        onClick={() => { setSelectedSession(session); setSheetOpen(true) }}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{session.name}</p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5">
                              <span className={`rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SESSION_TYPE_COLORS[session.session_type]}`}>
                                {session.session_type.replace('_', ' ')}
                              </span>
                              {dist > 0 && (
                                <span className="text-[10px] text-muted-foreground">{formatDistance(dist)}</span>
                              )}
                              {session.estimated_duration_min && (
                                <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                                  <Clock className="h-2.5 w-2.5" />
                                  {session.estimated_duration_min}m
                                </span>
                              )}
                            </div>
                          </div>
                          {statusBadge(status)}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Week summary */}
      {weekSessions.length > 0 && (
        <div className="mt-4 rounded-xl bg-muted/50 px-4 py-3 text-center text-xs text-muted-foreground">
          <span className="font-semibold text-foreground">{completedThisWeek}</span> of{' '}
          <span className="font-semibold text-foreground">{weekSessions.length}</span> sessions completed
        </div>
      )}

      {/* Session detail sheet */}
      <SessionDetailSheet
        session={selectedSession}
        open={sheetOpen}
        onClose={() => { setSheetOpen(false); setSelectedSession(null) }}
      />
    </div>
  )
}
