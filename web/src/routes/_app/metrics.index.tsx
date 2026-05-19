import { useEffect, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'

import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import {
  ComplianceCard,
  formatDistanceKm,
  formatPace,
  MetricSummaryCard,
  MultiMetricTrendChart,
  PersonalBestsRow,
  RangeTabs,
  StrokeDistributionChart,
  TrainingHeatmap,
  VolumeCard,
} from '@/components/metrics/metrics-ui'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { metricsApi, type MetricsRange } from '@/lib/metrics-api'

export const Route = createFileRoute('/_app/metrics/')({
  validateSearch: (search) => ({
    range: metricsApi.normalizeRange(typeof search.range === 'string' ? search.range : undefined),
  }),
  component: MetricsPage,
})

function MetricsPage() {
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [visibleMetrics, setVisibleMetrics] = useState({ swolf: true, pace: true, hr: true })

  useEffect(() => {
    if (user?.role === 'coach') {
      navigate({ to: '/metrics/team', search })
    }
  }, [navigate, search, user?.role])

  const { data, isPending } = useQuery({
    queryKey: ['metrics', search.range],
    queryFn: () => metricsApi.athlete(search.range),
    enabled: user?.role === 'athlete',
    staleTime: 60_000,
    networkMode: 'always',
  })

  const onRangeChange = (range: MetricsRange) => navigate({ to: '/metrics', search: { range } })

  if (isPending || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 pb-24">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{t('metrics.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('metrics.performance_snapshot')}</p>
        </div>
        <RangeTabs range={search.range} onChange={onRangeChange} t={t} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricSummaryCard label={t('metrics.swolf_avg')} value={data.summary.swolf_avg != null ? data.summary.swolf_avg.toFixed(1) : '—'} trend={data.summary.swolf_trend} t={t} invertColors />
        <MetricSummaryCard label={t('metrics.pace_avg')} value={data.summary.pace_avg_sec != null ? `${formatPace(data.summary.pace_avg_sec)}/100m` : '—'} trend={data.summary.pace_trend} t={t} invertColors />
        <MetricSummaryCard label={t('metrics.hr_avg')} value={data.summary.hr_avg != null ? Math.round(data.summary.hr_avg).toString() : '—'} trend={data.summary.hr_trend} t={t} neutral />
      </div>

      <MultiMetricTrendChart
        data={data.chart_data}
        t={t}
        locale={lang}
        visibleMetrics={visibleMetrics}
        onToggleMetric={(metric) => setVisibleMetrics((current) => ({ ...current, [metric]: !current[metric] }))}
        onSelectWorkout={(workoutLogId) => navigate({ to: '/activities/$workoutLogId', params: { workoutLogId } })}
        emptyText={t('metrics.sync_or_log_to_see_trends')}
      />

      <TrainingHeatmap data={data.heatmap} t={t} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <ComplianceCard percent={data.summary.compliance_score} completed={data.summary.sessions_completed} planned={data.summary.sessions_planned} t={t} />
        <VolumeCard label={t('metrics.total_distance')} value={formatDistanceKm(data.summary.total_distance_m)} />
      </div>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold text-foreground">{t('metrics.personal_bests')}</h2>
        <PersonalBestsRow pbs={data.personal_bests} t={t} />
      </section>

      <StrokeDistributionChart distribution={data.stroke_distribution} t={t} />

      <Card className="border-border/70 shadow-sm">
        <CardHeader>
          <CardTitle className="text-base">{t('metrics.sessions')}</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricTile label={t('metrics.sessions_completed')} value={String(data.summary.sessions_completed)} />
          <MetricTile label={t('metrics.sessions_planned')} value={String(data.summary.sessions_planned)} />
          <MetricTile label={t('metrics.total_distance')} value={data.summary.total_distance_m.toLocaleString()} />
          <MetricTile label={t('metrics.compliance')} value={data.summary.compliance_score != null ? `${Math.round(data.summary.compliance_score)}%` : '—'} />
        </CardContent>
      </Card>
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 p-4">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-2 text-2xl font-semibold text-foreground">{value}</div>
    </div>
  )
}
