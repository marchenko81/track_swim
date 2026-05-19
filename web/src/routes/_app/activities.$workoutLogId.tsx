import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { ArrowLeft, Waves, Info } from 'lucide-react'
import { api } from '@/lib/api'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/_app/activities/$workoutLogId')({
  component: ActivityDetailPage,
})

interface SetLog {
  id: string
  order: number
  repetitions_completed: number | null
  distance_m: number | null
  stroke: string | null
  avg_pace_per_100m: string | null
  avg_hr_bpm: number | null
  max_hr_bpm: number | null
  avg_swolf: number | null
  avg_stroke_count_per_length: number | null
  rest_taken_seconds: number | null
  notes: string | null
}

interface MetricSnapshot {
  id: string
  metric_type: string
  value: number
  unit: string
}

interface ActivityDetail {
  id: string
  strava_activity_id: number | null
  logged_date: string
  actual_distance_m: number | null
  actual_duration_min: number | null
  pool_length_m: number | null
  avg_hr_bpm: number | null
  max_hr_bpm: number | null
  session_name: string | null
  is_matched: boolean
  source: string
  set_logs: SetLog[]
  metric_snapshots: MetricSnapshot[]
}

const STROKE_LABELS: Record<string, string> = {
  freestyle: 'Freestyle',
  backstroke: 'Backstroke',
  breaststroke: 'Breaststroke',
  butterfly: 'Butterfly',
  im: 'IM',
  choice: 'Choice',
}

function formatDuration(min: number | null): string {
  if (!min) return '—'
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function formatDistance(m: number | null): string {
  if (!m) return '—'
  return `${m.toLocaleString()}m`
}

function getMetric(snapshots: MetricSnapshot[], type: string): number | null {
  return snapshots.find((s) => s.metric_type === type)?.value ?? null
}

function formatPace(secPer100m: number | null): string {
  if (!secPer100m) return '—'
  const m = Math.floor(secPer100m / 60)
  const s = Math.round(secPer100m % 60)
  return `${m}:${String(s).padStart(2, '0')}/100m`
}

function ActivityDetailPage() {
  const { workoutLogId } = Route.useParams()
  const navigate = useNavigate()
  const { user } = useAuth()
  const { t } = useLanguage()

  const { data: activity, isPending } = useQuery<ActivityDetail>({
    queryKey: ['activity', workoutLogId],
    queryFn: () => api.get<ActivityDetail>(`/strava/activities/${workoutLogId}/`),
    staleTime: 60_000,
    networkMode: 'always',
  })

  if (isPending) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!activity) {
    return (
      <div className="px-4 py-10 text-center text-muted-foreground">
        Activity not found.
      </div>
    )
  }

  const paceAvg = getMetric(activity.metric_snapshots, 'pace_avg')
  const swolfAvg = getMetric(activity.metric_snapshots, 'swolf_avg')
  const compliance = getMetric(activity.metric_snapshots, 'compliance_score')
  const isOpenWater = !activity.pool_length_m

  const title = activity.session_name ?? `Swim — ${new Date(activity.logged_date).toLocaleDateString()}`

  return (
    <div className="bg-background pb-10">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button
          onClick={() => navigate({ to: user?.role === 'coach' ? '/metrics/team' : '/settings/devices' })}
          className="rounded-full p-1 text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1 min-w-0">
          <p className="truncate text-base font-semibold text-foreground">{title}</p>
          <p className="text-xs text-muted-foreground">
            {new Date(activity.logged_date).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}
            {' · '}
            {isOpenWater ? 'Open Water' : `Pool ${activity.pool_length_m}m`}
          </p>
        </div>
        {activity.is_matched ? (
          <Badge className="shrink-0 bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px]">
            ✓ {t('strava.matched_to_plan')}
          </Badge>
        ) : (
          <Badge variant="outline" className="shrink-0 text-[10px] text-muted-foreground">
            {t('strava.unplanned')}
          </Badge>
        )}
      </div>

      <div className="px-4 pt-4 space-y-4">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard label="Distance" value={formatDistance(activity.actual_distance_m)} />
          <StatCard label="Duration" value={formatDuration(activity.actual_duration_min)} />
          <StatCard label="Pace" value={paceAvg ? formatPace(paceAvg) : '—'} />
          <StatCard
            label="SWOLF"
            value={swolfAvg ? swolfAvg.toFixed(1) : '—'}
            dimmed={isOpenWater}
            tooltip={isOpenWater ? t('strava.open_water_note') : undefined}
          />
        </div>

        {/* Open Water Note */}
        {isOpenWater && (
          <div className="flex items-start gap-2 rounded-xl border border-border bg-muted/40 px-3 py-3">
            <Info className="h-4 w-4 shrink-0 text-muted-foreground mt-0.5" />
            <p className="text-xs text-muted-foreground">{t('strava.open_water_note')}</p>
          </div>
        )}

        {/* Compliance */}
        {activity.is_matched && compliance !== null && (
          <div className="rounded-2xl border border-border bg-card px-4 py-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">{t('strava.compliance_score')}</h2>
            <div className="mb-2 h-3 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full rounded-full bg-emerald-500 transition-all"
                style={{ width: `${Math.min(compliance, 100)}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-lg font-bold text-emerald-600">{compliance.toFixed(0)}%</span>
              <span className="text-xs text-muted-foreground">
                {formatDistance(activity.actual_distance_m)} completed
              </span>
            </div>
          </div>
        )}

        {/* Set Breakdown */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold text-foreground">{t('strava.set_breakdown')}</h2>
          </div>

          {activity.set_logs.length === 0 ? (
            <div className="flex items-center gap-2 px-4 py-5">
              <Waves className="h-4 w-4 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Set detail not available — activity synced at summary level only
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {activity.set_logs.map((sl) => (
                <SetLogRow key={sl.id} setLog={sl} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({
  label, value, dimmed, tooltip,
}: {
  label: string
  value: string
  dimmed?: boolean
  tooltip?: string
}) {
  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 text-xl font-bold ${dimmed ? 'text-muted-foreground line-through decoration-muted-foreground/50' : 'text-foreground'}`}>
        {value}
      </p>
      {tooltip && <p className="mt-0.5 text-[10px] text-muted-foreground leading-tight">{tooltip}</p>}
    </div>
  )
}

function SetLogRow({ setLog }: { setLog: SetLog }) {
  const stroke = STROKE_LABELS[setLog.stroke ?? 'choice'] ?? setLog.stroke

  const chips = [
    setLog.avg_swolf !== null && `SWOLF ${setLog.avg_swolf.toFixed(1)}`,
    setLog.avg_hr_bpm !== null && `HR ${setLog.avg_hr_bpm} bpm`,
    setLog.avg_pace_per_100m && `${setLog.avg_pace_per_100m}/100m`,
  ].filter(Boolean) as string[]

  return (
    <div className="px-4 py-3">
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-foreground">
            {setLog.repetitions_completed !== null && setLog.distance_m
              ? `${setLog.repetitions_completed} × ${setLog.distance_m}m ${stroke}`
              : stroke}
          </p>
          {chips.length > 0 && (
            <div className="mt-1 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <span key={chip} className="rounded-md bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">
                  {chip}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
