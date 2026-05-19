import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'

import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import {
  ComplianceCard,
  MetricSummaryCard,
  RangeTabs,
  StrokeDistributionChart,
  TeamComplianceChart,
} from '@/components/metrics/metrics-ui'
import { ApiError } from '@/lib/api'
import { metricsApi, type TeamAthleteRow } from '@/lib/metrics-api'

export const Route = createFileRoute('/_app/metrics/team')({
  validateSearch: (search) => ({
    range: metricsApi.normalizeRange(typeof search.range === 'string' ? search.range : undefined),
  }),
  component: TeamMetricsPage,
})

type SortMode = 'compliance' | 'name' | 'last_session'

function TeamMetricsPage() {
  const { user } = useAuth()
  const { t } = useLanguage()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const [sortBy, setSortBy] = useState<SortMode>('compliance')

  const { data, isPending } = useQuery({
    queryKey: ['metrics', 'team', search.range],
    queryFn: () => metricsApi.team(search.range),
    enabled: user?.role === 'coach',
    staleTime: 60_000,
    networkMode: 'always',
  })

  const exportCsv = useMutation({
    mutationFn: () => metricsApi.exportTeamCsv(search.range),
    onError: () => toast.error(t('metrics.export_failed')),
  })
  const exportPdf = useMutation({
    mutationFn: () => metricsApi.exportTeamPdf(search.range),
    onError: (error) => {
      if (error instanceof ApiError && error.status === 501) toast.error(t('metrics.pdf_not_available'))
      else toast.error(t('metrics.export_failed'))
    },
  })

  const athletes = useMemo(() => {
    const rows = [...(data?.athletes ?? [])]
    if (sortBy === 'name') return rows.sort((a, b) => a.name.localeCompare(b.name))
    if (sortBy === 'last_session') return rows.sort((a, b) => (b.last_session_date ?? '').localeCompare(a.last_session_date ?? ''))
    return rows.sort((a, b) => (a.compliance ?? 999) - (b.compliance ?? 999))
  }, [data?.athletes, sortBy])

  if (isPending || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 pb-24">
      <div className="space-y-4">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-foreground">{t('metrics.team_analytics')}</h1>
          <p className="text-sm text-muted-foreground">{t('metrics.team_overview_copy')}</p>
        </div>
        <RangeTabs range={search.range} onChange={(range) => navigate({ to: '/metrics/team', search: { range } })} t={t} />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricSummaryCard label={t('metrics.team_swolf_avg')} value={data.summary.team_swolf_avg != null ? data.summary.team_swolf_avg.toFixed(1) : '—'} trend={{ direction: 'stable', pct_change: 0, sessions: 0 }} t={t} neutral />
        <ComplianceCard percent={data.summary.team_compliance} completed={data.summary.active_athletes} planned={data.summary.total_athletes} t={t} />
        <Card className={data.summary.at_risk_count > 0 ? 'border-rose-300 shadow-sm' : 'border-emerald-300 shadow-sm'}>
          <CardHeader><CardTitle className="text-base">{t('metrics.at_risk')}</CardTitle></CardHeader>
          <CardContent>
            <div className={data.summary.at_risk_count > 0 ? 'text-4xl font-semibold text-rose-600' : 'text-4xl font-semibold text-emerald-600'}>{data.summary.at_risk_count}</div>
            <div className="mt-2 text-sm text-muted-foreground">{t('metrics.at_risk_count', { count: data.summary.at_risk_count })}</div>
          </CardContent>
        </Card>
      </div>

      <TeamComplianceChart athletes={athletes} t={t} />

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle className="text-base">{t('metrics.athlete_breakdown')}</CardTitle>
          <div className="flex flex-wrap gap-2">
            <Select value={sortBy} onValueChange={(value: SortMode) => setSortBy(value)}>
              <SelectTrigger className="w-[180px] bg-card"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compliance">{t('metrics.sort_compliance')}</SelectItem>
                <SelectItem value="name">{t('metrics.sort_name')}</SelectItem>
                <SelectItem value="last_session">{t('metrics.sort_last_session')}</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={() => exportCsv.mutate()} disabled={exportCsv.isPending}>{t('metrics.export_csv')}</Button>
            <Button variant="outline" onClick={() => exportPdf.mutate()} disabled={exportPdf.isPending}>{t('metrics.export_pdf')}</Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="min-w-[760px] w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-2 py-3">{t('metrics.athlete')}</th>
                  <th className="px-2 py-3">{t('metrics.compliance')}</th>
                  <th className="px-2 py-3">%</th>
                  <th className="px-2 py-3">{t('metrics.status')}</th>
                  <th className="px-2 py-3">{t('team.last_session')}</th>
                </tr>
              </thead>
              <tbody>
                {athletes.map((athlete) => (
                  <AthleteTableRow key={athlete.id} athlete={athlete} t={t} onClick={() => navigate({ to: '/metrics/athlete/$athleteId', params: { athleteId: athlete.id }, search: { range: search.range } })} />
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <StrokeDistributionChart distribution={data.stroke_distribution} t={t} />
    </div>
  )
}

function AthleteTableRow({ athlete, t, onClick }: { athlete: TeamAthleteRow; t: (key: string) => string; onClick: () => void }) {
  const initials = `${athlete.first_name?.[0] ?? ''}${athlete.last_name?.[0] ?? ''}`.trim() || athlete.name.slice(0, 2).toUpperCase()
  const compliance = athlete.compliance ?? 0
  return (
    <tr className="cursor-pointer border-b border-border/70 transition-colors hover:bg-muted/30" onClick={onClick}>
      <td className="px-2 py-3">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10"><AvatarImage src={athlete.avatar_url ?? undefined} /><AvatarFallback>{initials}</AvatarFallback></Avatar>
          <div className="min-w-0"><div className="truncate font-medium text-foreground">{athlete.name}</div></div>
        </div>
      </td>
      <td className="px-2 py-3">
        <div className="h-2 w-20 overflow-hidden rounded-full bg-muted"><div className={compliance >= 80 ? 'h-full bg-emerald-500' : compliance >= 60 ? 'h-full bg-amber-500' : 'h-full bg-rose-500'} style={{ width: `${Math.min(compliance, 100)}%` }} /></div>
      </td>
      <td className="px-2 py-3 font-medium text-foreground">{athlete.compliance != null ? `${Math.round(athlete.compliance)}%` : '—'}</td>
      <td className="px-2 py-3"><Badge className={athlete.status === 'on_track' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-rose-100 text-rose-700 border-rose-200'}>{athlete.status === 'on_track' ? t('metrics.on_track') : t('metrics.at_risk')}</Badge></td>
      <td className="px-2 py-3 text-muted-foreground">{athlete.last_session_date ? new Date(athlete.last_session_date).toLocaleDateString() : '—'}</td>
    </tr>
  )
}
