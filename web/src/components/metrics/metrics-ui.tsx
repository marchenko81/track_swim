import { useMemo } from 'react'
import { addDays, eachDayOfInterval, eachWeekOfInterval, format, isAfter, isSameDay, startOfWeek, subWeeks } from 'date-fns'
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
} from 'recharts'
import { ArrowDownRight, ArrowUpRight, Minus } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip'
import type {
  MetricChartPoint,
  MetricsRange,
  MetricTrend,
  PersonalBest,
  StrokeDistribution,
  TeamAthleteRow,
} from '@/lib/metrics-api'
import { cn } from '@/lib/utils'

const RANGE_OPTIONS: MetricsRange[] = ['4w', '8w', '12w', 'season']
const LINE_COLORS = {
  swolf: '#3b82f6',
  pace: '#22c55e',
  hr: '#f59e0b',
} as const
const STROKE_COLORS = ['#3b82f6', '#14b8a6', '#f59e0b', '#f97316', '#8b5cf6']
const AXIS_COLOR = 'rgba(120, 130, 150, 0.85)'
const GRID_COLOR = 'rgba(120, 130, 150, 0.14)'

export function formatPace(seconds?: number | null) {
  if (seconds == null) return '—'
  const minutes = Math.floor(seconds / 60)
  const remaining = Math.round(seconds % 60)
  return `${minutes}:${String(remaining).padStart(2, '0')}`
}

export function formatDistanceKm(distanceM?: number | null) {
  if (!distanceM) return '0 km'
  return `${(distanceM / 1000).toFixed(distanceM >= 10000 ? 0 : 1)} km`
}

export function formatShortDateLabel(date: string, locale?: string) {
  return new Date(date).toLocaleDateString(locale, { month: 'short', day: 'numeric' })
}

export function getStrokeLabel(stroke: string, t: (key: string) => string) {
  const keyMap: Record<string, string> = {
    freestyle: 'set.freestyle',
    backstroke: 'set.backstroke',
    breaststroke: 'set.breaststroke',
    butterfly: 'set.butterfly',
    im: 'set.im',
  }
  return t(keyMap[stroke] ?? stroke)
}

export function RangeTabs({ range, onChange, t }: { range: MetricsRange; onChange: (value: MetricsRange) => void; t: (key: string) => string }) {
  return (
    <div className="flex flex-wrap gap-2">
      {RANGE_OPTIONS.map((option) => {
        const active = option === range
        return (
          <Button
            key={option}
            type="button"
            size="sm"
            variant={active ? 'default' : 'outline'}
            className={cn('min-h-11 rounded-full px-4', !active && 'bg-card')}
            onClick={() => onChange(option)}
          >
            {t(`metrics.range_${option}`)}
          </Button>
        )
      })}
    </div>
  )
}

export function MetricSummaryCard({
  label,
  value,
  trend,
  t,
  invertColors = false,
  neutral = false,
}: {
  label: string
  value: string
  trend: MetricTrend
  t: (key: string) => string
  invertColors?: boolean
  neutral?: boolean
}) {
  const improving = trend.direction === 'improving'
  const declining = trend.direction === 'declining'
  const Icon = improving ? ArrowDownRight : declining ? ArrowUpRight : Minus
  const tone = neutral
    ? 'text-muted-foreground'
    : improving
      ? invertColors
        ? 'text-emerald-600'
        : 'text-emerald-600'
      : declining
        ? 'text-rose-600'
        : 'text-muted-foreground'

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="space-y-2 pb-3">
        <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
        <div className="text-3xl font-semibold tracking-tight text-foreground">{value}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className={cn('flex items-center gap-2 text-sm', tone)}>
          <Icon className="h-4 w-4" />
          <span>{t(`metrics.trend_${trend.direction}`)}</span>
          <span>{trend.pct_change.toFixed(1)}%</span>
        </div>
      </CardContent>
    </Card>
  )
}

function ChartTooltip({ active, payload, label, locale, t }: any) {
  if (!active || !payload?.length) return null
  const point = payload[0]?.payload as MetricChartPoint & { paceVisual?: number | null; hrVisual?: number | null }
  return (
    <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">
      <p className="font-medium text-foreground">{formatShortDateLabel(label, locale)}</p>
      {point.session_name ? <p className="mb-2 text-muted-foreground">{point.session_name}</p> : null}
      <div className="space-y-1 text-muted-foreground">
        <div>SWOLF: {point.swolf?.toFixed(1) ?? '—'}</div>
        <div>{t('metrics.pace_avg')}: {point.pace != null ? `${formatPace(point.pace)}/100m` : '—'}</div>
        <div>{t('metrics.hr_avg')}: {point.hr != null ? Math.round(point.hr) : '—'}</div>
        <div>{t('metrics.total_distance')}: {point.distance?.toLocaleString() ?? '—'}m</div>
      </div>
    </div>
  )
}

export function MultiMetricTrendChart({
  data,
  t,
  locale,
  visibleMetrics,
  onToggleMetric,
  onSelectWorkout,
  emptyText,
}: {
  data: MetricChartPoint[]
  t: (key: string) => string
  locale?: string
  visibleMetrics: Record<'swolf' | 'pace' | 'hr', boolean>
  onToggleMetric: (metric: 'swolf' | 'pace' | 'hr') => void
  onSelectWorkout?: (workoutLogId: string) => void
  emptyText: string
}) {
  const chartData = useMemo(
    () => data.map((point) => ({ ...point, paceVisual: point.pace == null ? null : point.pace / 10, hrVisual: point.hr == null ? null : point.hr / 10 })),
    [data]
  )

  if (!data.length) {
    return <div className="flex min-h-[260px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">{emptyText}</div>
  }

  const renderDot = () => (props: any) => {
    const { cx, cy, payload, stroke } = props
    if (cx == null || cy == null) return <g />
    const interactive = !!payload.workout_log_id && !!onSelectWorkout
    return (
      <circle
        cx={cx}
        cy={cy}
        r={4}
        fill={stroke}
        className={interactive ? 'cursor-pointer' : ''}
        onClick={() => {
          if (interactive) onSelectWorkout?.(payload.workout_log_id)
        }}
      />
    )
  }

  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader className="gap-4">
        <div className="flex flex-wrap gap-3">
          {([
            ['swolf', t('metrics.swolf_avg')],
            ['pace', t('metrics.pace_avg')],
            ['hr', t('metrics.hr_avg')],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex min-h-11 items-center gap-2 rounded-full border border-border px-3 text-sm text-foreground">
              <Checkbox checked={visibleMetrics[key]} onCheckedChange={() => onToggleMetric(key)} />
              {label}
            </label>
          ))}
        </div>
      </CardHeader>
      <CardContent className="h-[300px] pt-0">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" />
            <XAxis dataKey="date" tickFormatter={(value) => formatShortDateLabel(value, locale)} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
            <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} width={48} />
            <RechartsTooltip content={<ChartTooltip locale={locale} t={t} />} />
            {visibleMetrics.swolf ? <Line type="monotone" dataKey="swolf" stroke={LINE_COLORS.swolf} strokeWidth={2.5} dot={renderDot()} connectNulls /> : null}
            {visibleMetrics.pace ? <Line type="monotone" dataKey="paceVisual" stroke={LINE_COLORS.pace} strokeWidth={2.5} dot={renderDot()} connectNulls /> : null}
            {visibleMetrics.hr ? <Line type="monotone" dataKey="hrVisual" stroke={LINE_COLORS.hr} strokeWidth={2.5} dot={renderDot()} connectNulls /> : null}
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function SwolfChart({
  data,
  t,
  locale,
  onSelectWorkout,
}: {
  data: MetricChartPoint[]
  t: (key: string) => string
  locale?: string
  onSelectWorkout?: (workoutLogId: string) => void
}) {
  if (!data.length) {
    return <div className="flex min-h-[280px] items-center justify-center rounded-2xl border border-dashed border-border bg-muted/20 px-4 text-center text-sm text-muted-foreground">{t('metrics.sync_to_see_metrics')}</div>
  }
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="h-[320px] pt-6">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 10, left: -18, bottom: 0 }}>
            <CartesianGrid stroke={GRID_COLOR} strokeDasharray="4 4" />
            <XAxis dataKey="date" tickFormatter={(value) => formatShortDateLabel(value, locale)} tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} />
            <YAxis tick={{ fill: AXIS_COLOR, fontSize: 11 }} axisLine={{ stroke: GRID_COLOR }} tickLine={{ stroke: GRID_COLOR }} width={48} />
            <RechartsTooltip content={<ChartTooltip locale={locale} t={t} />} />
            <Line
              type="monotone"
              dataKey="swolf"
              stroke={LINE_COLORS.swolf}
              strokeWidth={3}
              connectNulls
              dot={(props: any) => {
                const { cx, cy, payload, stroke } = props
                if (cx == null || cy == null) return <g />
                return (
                  <circle
                    cx={cx}
                    cy={cy}
                    r={4}
                    fill={stroke}
                    className={payload.workout_log_id ? 'cursor-pointer' : ''}
                    onClick={() => payload.workout_log_id && onSelectWorkout?.(payload.workout_log_id)}
                  />
                )
              }}
            />
          </LineChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}

export function TrainingHeatmap({ data, t }: { data: { date: string; count: number }[]; t: (key: string) => string }) {
  const today = new Date()
  const weekStart = startOfWeek(today, { weekStartsOn: 1 })
  const startDate = subWeeks(weekStart, 11)
  const weeks = eachWeekOfInterval({ start: startDate, end: addDays(weekStart, 6) }, { weekStartsOn: 1 })
  const byDate = Object.fromEntries(data.map((entry) => [entry.date, entry.count]))
  const dayLabels = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

  return (
      <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t('metrics.training_frequency')}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <div className="flex min-w-[240px] gap-2">
            <div className="grid grid-rows-7 gap-1 pt-0.5 text-[10px] text-muted-foreground">
              {dayLabels.map((label) => (
                <div key={label} className="flex h-[14px] items-center">{label}</div>
              ))}
            </div>
            <div className="flex gap-1">
              {weeks.map((weekStartDate) => {
                const days = eachDayOfInterval({ start: weekStartDate, end: addDays(weekStartDate, 6) })
                return (
                  <div key={weekStartDate.toISOString()} className="grid grid-rows-7 gap-[2px]">
                    {days.map((day) => {
                      const dayKey = format(day, 'yyyy-MM-dd')
                      const count = byDate[dayKey] ?? 0
                      const isFuture = isAfter(day, today) && !isSameDay(day, today)
                      const tone = isFuture ? 'bg-transparent border border-transparent' : count === 0 ? 'bg-muted' : count === 1 ? 'bg-sky-300' : 'bg-sky-600'
                      return (
                        <Tooltip key={dayKey}>
                          <TooltipTrigger asChild>
                            <div className={cn('h-[14px] w-[14px] rounded-[4px]', tone)} />
                          </TooltipTrigger>
                          {!isFuture ? <TooltipContent>{`${dayKey} — ${count} ${t('metrics.sessions').toLowerCase()}`}</TooltipContent> : null}
                        </Tooltip>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function ComplianceCard({
  percent,
  completed,
  planned,
  t,
}: {
  percent: number | null
  completed: number
  planned: number
  t: (key: string) => string
}) {
  const value = percent ?? 0
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t('metrics.compliance')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="text-sm text-muted-foreground">{completed} / {planned} {t('metrics.sessions').toLowerCase()}</div>
        <div className="h-3 w-full overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(value, 100)}%` }} />
        </div>
        <div className="text-2xl font-semibold text-foreground">{percent != null ? `${Math.round(percent)}%` : '—'}</div>
      </CardContent>
    </Card>
  )
}

export function VolumeCard({ label, value }: { label: string; value: string }) {
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{label}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold text-foreground">{value}</div>
      </CardContent>
    </Card>
  )
}

export function PersonalBestsRow({ pbs, t }: { pbs: PersonalBest[]; t: (key: string) => string }) {
  if (!pbs.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{t('metrics.complete_pool_sessions_for_pbs')}</div>
  }
  const newestDate = pbs[0]?.date
  return (
    <div className="overflow-x-auto pb-2">
      <div className="flex min-w-max gap-3">
        {pbs.slice(0, 8).map((pb) => (
          <Card key={`${pb.stroke}-${pb.distance_m}`} className={cn('w-[132px] shrink-0 border-border/70 shadow-sm', pb.date === newestDate && 'border-l-4 border-l-amber-400')}>
            <CardContent className="space-y-2 p-4">
              <Badge variant="secondary">{pb.distance_m}m</Badge>
              <div className="text-sm font-medium text-foreground">{getStrokeLabel(pb.stroke, t)}</div>
              <div className="text-xl font-semibold text-foreground">{formatPace(pb.pace_sec)}</div>
              <div className="text-xs text-muted-foreground">{new Date(pb.date).toLocaleDateString()}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

export function StrokeDistributionChart({ distribution, t }: { distribution: StrokeDistribution; t: (key: string) => string }) {
  const data = STROKE_KEYS.map((stroke, index) => ({ name: getStrokeLabel(stroke, t), value: distribution[stroke as keyof StrokeDistribution], color: STROKE_COLORS[index] })).filter((item) => item.value > 0)
  return (
    <Card className="border-border/70 shadow-sm">
      <CardHeader>
        <CardTitle className="text-base">{t('metrics.stroke_distribution')}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.length ? (
          <>
            <div className="h-[220px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={data} dataKey="value" nameKey="name" innerRadius={52} outerRadius={78} paddingAngle={2} label={({ percent }) => `${Math.round((percent ?? 0) * 100)}%`}>
                    {data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2">
              {data.map((entry) => (
                <div key={entry.name} className="flex items-center justify-between gap-3 text-sm">
                  <div className="flex min-w-0 items-center gap-2 text-muted-foreground">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: entry.color }} />
                    <span className="truncate">{entry.name}</span>
                  </div>
                  <span className="font-medium text-foreground">{entry.value.toFixed(1)}%</span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-8 text-center text-sm text-muted-foreground">{t('metrics.no_data_yet')}</div>
        )}
      </CardContent>
    </Card>
  )
}

export function TeamComplianceChart({ athletes, t }: { athletes: TeamAthleteRow[]; t: (key: string, vars?: Record<string, string | number>) => string }) {
  if (!athletes.length) {
    return <div className="rounded-2xl border border-dashed border-border bg-muted/20 px-4 py-10 text-center text-sm text-muted-foreground">{t('metrics.no_data_yet')}</div>
  }
  const chartData = athletes.map((athlete) => ({
    name: athlete.first_name || athlete.name,
    compliance: athlete.compliance ?? 0,
    fill: (athlete.compliance ?? 0) >= 80 ? '#22c55e' : (athlete.compliance ?? 0) >= 60 ? '#f59e0b' : '#ef4444',
    sessions: athlete.sessions_completed,
  }))
  const height = Math.max(260, chartData.length * 38)
  return (
    <Card className="border-border/70 shadow-sm">
      <CardContent className="pt-6">
        <div style={{ height }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid horizontal={false} stroke={GRID_COLOR} />
              <XAxis type="number" domain={[0, 100]} tick={{ fill: AXIS_COLOR, fontSize: 11 }} tickLine={{ stroke: GRID_COLOR }} axisLine={{ stroke: GRID_COLOR }} />
              <YAxis type="category" dataKey="name" width={72} tick={{ fill: AXIS_COLOR, fontSize: 12 }} tickLine={false} axisLine={false} />
              <RechartsTooltip content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const row = payload[0].payload
                return <div className="rounded-xl border border-border bg-card px-3 py-2 text-xs shadow-lg">{`${row.name} — ${Math.round(row.compliance)}% ${t('metrics.compliance').toLowerCase()}, ${row.sessions} ${t('metrics.sessions').toLowerCase()}`}</div>
              }} />
              <Bar dataKey="compliance" radius={[0, 8, 8, 0]}>
                {chartData.map((entry) => <Cell key={entry.name} fill={entry.fill} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  )
}

const STROKE_KEYS = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im'] as const
