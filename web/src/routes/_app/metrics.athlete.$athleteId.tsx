import { useMemo, useState } from 'react'
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { toast } from 'sonner'

import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { Badge } from '@/components/ui/badge'
import {
  ComplianceCard,
  formatPace,
  MetricSummaryCard,
  RangeTabs,
  StrokeDistributionChart,
  SwolfChart,
} from '@/components/metrics/metrics-ui'
import { metricsApi } from '@/lib/metrics-api'

export const Route = createFileRoute('/_app/metrics/athlete/$athleteId')({
  validateSearch: (search) => ({
    range: metricsApi.normalizeRange(typeof search.range === 'string' ? search.range : undefined),
  }),
  component: AthleteDetailPage,
})

function AthleteDetailPage() {
  const { athleteId } = Route.useParams()
  const search = Route.useSearch()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t, lang } = useLanguage()
  const [note, setNote] = useState('')
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [page, setPage] = useState(1)

  const { data, isPending } = useQuery({
    queryKey: ['metrics', 'athlete', athleteId, search.range],
    queryFn: () => metricsApi.athleteDetail(athleteId, search.range),
    staleTime: 60_000,
    networkMode: 'always',
  })

  const saveNote = useMutation({
    mutationFn: () => metricsApi.createCoachNote(athleteId, note),
    onSuccess: () => {
      setNote('')
      setShowNoteForm(false)
      toast.success(t('metrics.note_saved'))
      queryClient.invalidateQueries({ queryKey: ['metrics', 'athlete', athleteId] })
    },
    onError: () => toast.error(t('common.error')),
  })

  const sessionPage = useMemo(() => (data?.session_history ?? []).slice((page - 1) * 20, page * 20), [data?.session_history, page])
  const totalPages = Math.max(1, Math.ceil((data?.session_history?.length ?? 0) / 20))

  if (isPending || !data) {
    return <div className="flex items-center justify-center py-20"><div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" /></div>
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-6 px-4 py-6 pb-28">
      <div className="flex flex-wrap items-start gap-3">
        <Button variant="outline" size="icon" className="h-11 w-11" onClick={() => navigate({ to: '/metrics/team', search: { range: search.range } })}><ArrowLeft className="h-4 w-4" /></Button>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold text-foreground">{data.athlete_info.name}</h1>
            <Badge variant="secondary">{t(`onboarding.${data.athlete_info.stroke_specialty === 'none' ? 'no_specialty' : data.athlete_info.stroke_specialty}`)}</Badge>
            <Badge variant="outline">{t(`onboarding.${data.athlete_info.fitness_level}`)}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {data.athlete_info.current_plan
              ? `${t('metrics.weeks_on_plan', { current: data.athlete_info.current_plan.week_current, total: data.athlete_info.current_plan.week_total })} — ${data.athlete_info.current_plan.name}`
              : t('metrics.no_active_plan')}
          </p>
        </div>
      </div>

      <RangeTabs range={search.range} onChange={(range) => navigate({ to: '/metrics/athlete/$athleteId', params: { athleteId }, search: { range } })} t={t} />

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <MetricSummaryCard label={t('metrics.swolf_avg')} value={data.summary.swolf_avg != null ? data.summary.swolf_avg.toFixed(1) : '—'} trend={data.summary.swolf_trend} t={t} invertColors />
        <MetricSummaryCard label={t('metrics.pace_avg')} value={data.summary.pace_avg_sec != null ? `${formatPace(data.summary.pace_avg_sec)}/100m` : '—'} trend={data.summary.pace_trend} t={t} invertColors />
        <MetricSummaryCard label={t('metrics.compliance')} value={data.summary.compliance_score != null ? `${Math.round(data.summary.compliance_score)}%` : '—'} trend={{ direction: 'stable', pct_change: 0, sessions: 0 }} t={t} neutral />
      </div>

      <SwolfChart data={data.chart_data} t={t} locale={lang} onSelectWorkout={(workoutLogId) => navigate({ to: '/activities/$workoutLogId', params: { workoutLogId } })} />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <Card className="border-border/70 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t('metrics.session_history')}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {sessionPage.map((session) => (
              <button key={session.id} type="button" className="flex w-full items-center justify-between gap-3 rounded-2xl border border-border px-4 py-3 text-left hover:bg-muted/30" onClick={() => navigate({ to: '/activities/$workoutLogId', params: { workoutLogId: session.id } })}>
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-foreground">{session.session_name ?? t('strava.unplanned')}</div>
                  <div className="text-xs text-muted-foreground">{new Date(session.date).toLocaleDateString()} · {session.actual_distance_m?.toLocaleString() ?? '—'}m</div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline">SWOLF {session.avg_swolf != null ? session.avg_swolf.toFixed(1) : '—'}</Badge>
                  <Badge className={session.status === 'completed' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : session.status === 'skipped' ? 'bg-amber-100 text-amber-700 border-amber-200' : 'bg-muted text-muted-foreground border-border'}>
                    {session.status === 'completed' ? `✓ ${t('workout.completed')}` : session.status === 'skipped' ? `✗ ${t('workout.skipped')}` : `— ${t('workout.missed')}`}
                  </Badge>
                </div>
              </button>
            ))}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <div className="text-xs text-muted-foreground">{page} / {totalPages}</div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.max(1, current - 1))} disabled={page === 1}>{t('common.back')}</Button>
                <Button variant="outline" size="sm" onClick={() => setPage((current) => Math.min(totalPages, current + 1))} disabled={page === totalPages}>{t('common.next')}</Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <StrokeDistributionChart distribution={data.stroke_distribution} t={t} />
          <ComplianceCard percent={data.summary.compliance_score} completed={data.summary.sessions_completed} planned={data.summary.sessions_planned} t={t} />
        </div>
      </div>

      <Card className="border-border/70 shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="text-base">{t('metrics.coach_notes')}</CardTitle>
          <Button variant="outline" onClick={() => setShowNoteForm((current) => !current)}>{t('metrics.leave_note')}</Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {showNoteForm ? (
            <div className="space-y-3 rounded-2xl border border-border bg-muted/20 p-4">
              <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={4} placeholder={t('metrics.note_placeholder')} />
              <div className="flex flex-wrap justify-end gap-2">
                <Button variant="outline" onClick={() => setShowNoteForm(false)}>{t('common.cancel')}</Button>
                <Button onClick={() => saveNote.mutate()} disabled={!note.trim() || saveNote.isPending}>{t('metrics.save_note')}</Button>
              </div>
            </div>
          ) : null}
          <div className="space-y-3">
            {data.coach_notes.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-border px-4 py-3">
                <div className="text-xs text-muted-foreground">{new Date(entry.created_at).toLocaleString()}</div>
                <div className="mt-2 whitespace-pre-wrap text-sm text-foreground">{entry.content}</div>
              </div>
            ))}
            {!data.coach_notes.length ? <div className="text-sm text-muted-foreground">{t('metrics.no_notes_yet')}</div> : null}
          </div>
        </CardContent>
      </Card>

      <div className="sticky bottom-20 z-10 flex justify-end">
        <Button className="min-h-11 rounded-full px-5 shadow-lg" disabled={!data.athlete_info.current_plan} onClick={() => data.athlete_info.current_plan && navigate({ to: '/plans/$id', params: { id: data.athlete_info.current_plan.id } })}>{t('metrics.adjust_plan')}</Button>
      </div>
    </div>
  )
}
