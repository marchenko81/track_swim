import { createFileRoute, Link } from '@tanstack/react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarDays } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/contexts/language-context'
import { insightsApi } from '@/lib/insights-api'

export const Route = createFileRoute('/_app/insights/digest')({
  component: CoachDigestPage,
})

function CoachDigestPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: ['insights', 'digest-list'],
    queryFn: () => insightsApi.list({ type: 'weekly_digest' }),
    staleTime: 0,
  })

  const latest = data?.results[0]
  const generatedWithin24h = latest ? Date.now() - new Date(latest.created_at).getTime() < 24 * 60 * 60 * 1000 : false

  const generateMutation = useMutation({
    mutationFn: () => insightsApi.generate({ insight_type: 'weekly_digest' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['insights'] })
    },
  })

  return (
    <div className="flex min-w-0 flex-1 flex-col px-4 py-6 lg:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('insights.coach_digest')}</h1>
          <p className="text-sm text-muted-foreground">{t('insights.generate_digest')}</p>
        </div>
        <Button onClick={() => generateMutation.mutate()} disabled={generatedWithin24h || generateMutation.isPending}>
          {t('insights.generate_now')}
        </Button>
      </div>

      <div className="space-y-3">
        {(data?.results ?? []).map((insight) => (
          <Link key={insight.id} to="/insights/$id" params={{ id: insight.id }} className="block">
            <Card className="transition-colors hover:border-primary/30">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <CalendarDays className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{t('insights.weekly_digest')}</p>
                    <p className="text-xs text-muted-foreground">{new Date(insight.created_at).toLocaleDateString()}</p>
                    <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{insight.content}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  )
}
