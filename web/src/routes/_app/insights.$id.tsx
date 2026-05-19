import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Check, ChevronRight, Sparkles, TrendingDown, TrendingUp } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { formatMetricValue, getInsightLastSentence, insightsApi } from '@/lib/insights-api'

export const Route = createFileRoute('/_app/insights/$id')({
  component: InsightDetailPage,
})

function trendVisual(direction?: string) {
  if (direction === 'improving') return { icon: TrendingUp, className: 'text-emerald-500' }
  if (direction === 'declining') return { icon: TrendingDown, className: 'text-destructive' }
  return { icon: ChevronRight, className: 'text-amber-500' }
}

function InsightDetailPage() {
  const { id } = Route.useParams()
  const { user } = useAuth()
  const { t, lang } = useLanguage()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: insight } = useQuery({
    queryKey: ['insights', 'detail', id],
    queryFn: () => insightsApi.detail(id),
  })

  const shareMutation = useMutation({
    mutationFn: () => insightsApi.share(id),
    onSuccess: (result) => {
      queryClient.setQueryData(['insights', 'detail', id], result)
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  if (!insight) {
    return <div className="px-4 py-8 text-sm text-muted-foreground">{t('common.loading')}</div>
  }

  const lastSentence = getInsightLastSentence(insight.content)
  const metrics = [
    ['swolf_avg', t('metrics.swolf')],
    ['pace_avg', t('metrics.pace')],
    ['hr_avg', t('metrics.heart_rate')],
    ['compliance_score', t('metrics.compliance')],
  ] as const

  return (
    <div className="flex min-w-0 flex-1 flex-col px-4 py-6 lg:px-6">
      <div className="mb-6 flex items-center gap-3">
        <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => navigate({ to: '/insights' })}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <p className="text-sm font-semibold text-foreground">
            {insight.insight_type === 'weekly_digest' ? t('insights.weekly_digest') : t('insights.post_workout')}
          </p>
          <p className="text-xs text-muted-foreground">
            {new Date(insight.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
          </p>
        </div>
      </div>

      {insight.session_reference && (
        <p className="mb-4 text-sm text-muted-foreground">
          {t('insights.session_reference')}: {insight.session_reference.session_name ?? 'Swim'} · {new Date(insight.session_reference.logged_date).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')} · {insight.session_reference.actual_distance_m ?? 0}m
        </p>
      )}

      <Card>
        <CardContent className="space-y-4 p-5">
          <p className="whitespace-pre-wrap text-base leading-7 text-foreground">{insight.content}</p>
          <div className="rounded-2xl bg-primary/10 p-4 text-sm font-medium text-primary">
            {lastSentence}
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Sparkles className="h-3.5 w-3.5" />
            {insight.is_fallback ? (
              <span>Based on your session data</span>
            ) : (
              <span>{t('insights.generated_by')} AI{insight.model_used ? ` · ${insight.model_used}` : ''}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map(([key, label]) => {
          const value = formatMetricValue(key, insight.metrics?.[key])
          if (!value) return null
          return (
            <Card key={key}>
              <CardContent className="p-4">
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {insight.trends && Object.keys(insight.trends).length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="text-lg font-semibold text-foreground">{t('insights.your_trends')}</h2>
          {Object.entries(insight.trends).map(([key, trend]) => {
            const visual = trendVisual(trend.direction)
            const Icon = visual.icon
            return (
              <Card key={key}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{key.toUpperCase()}</p>
                    <p className="text-xs text-muted-foreground">
                      {trend.direction === 'improving'
                        ? t('insights.trend_improving')
                        : trend.direction === 'declining'
                        ? t('insights.trend_declining')
                        : t('insights.trend_plateau')}
                    </p>
                  </div>
                  <div className={`flex items-center gap-2 text-sm font-semibold ${visual.className}`}>
                    <Icon className="h-4 w-4" />
                    {trend.pct_change}%
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}

      {user?.role === 'athlete' && insight.target_audience === 'athlete' && (
        <Button className="mt-6" onClick={() => shareMutation.mutate()} disabled={shareMutation.isPending || shareMutation.isSuccess}>
          {shareMutation.isSuccess ? <Check className="mr-2 h-4 w-4" /> : null}
          {shareMutation.isSuccess ? t('insights.shared_with_coach') : t('insights.share_with_coach')}
        </Button>
      )}

      {user?.role === 'coach' && insight.insight_type === 'weekly_digest' && insight.input_context?.athletes && (
        <div className="mt-6 space-y-3">
          {insight.input_context.athletes.map((athlete: any) => {
            const atRisk = !athlete.sessions_completed || (athlete.avg_compliance ?? 0) < 70
            return (
              <Card key={athlete.athlete_id ?? athlete.name}>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-foreground">{athlete.name}</p>
                    <p className="text-xs text-muted-foreground">{athlete.sessions_completed} sessions this week</p>
                  </div>
                  <div className={`rounded-full px-3 py-1 text-xs font-semibold ${atRisk ? 'bg-destructive/10 text-destructive' : 'bg-emerald-500/10 text-emerald-600'}`}>
                    {atRisk ? t('insights.at_risk') : t('insights.on_track')}
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
