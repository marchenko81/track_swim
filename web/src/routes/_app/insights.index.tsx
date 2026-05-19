import { createFileRoute } from '@tanstack/react-router'
import { useInfiniteQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { useState } from 'react'

import { InsightListCard } from '@/components/insights/insight-list-card'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { insightFilterToType, insightsApi } from '@/lib/insights-api'

export const Route = createFileRoute('/_app/insights/')({
  component: InsightsIndexPage,
})

function InsightsIndexPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const [filter, setFilter] = useState<'all' | 'post_workout' | 'digests' | 'alerts'>('all')

  const query = useInfiniteQuery({
    queryKey: ['insights', 'feed', user?.role, filter],
    queryFn: ({ pageParam = 1 }) => insightsApi.list({ page: pageParam, type: insightFilterToType(filter) }),
    initialPageParam: 1,
    getNextPageParam: (lastPage, _pages, lastPageParam) => (lastPage.next ? Number(lastPageParam) + 1 : undefined),
  })

  const insights = query.data?.pages.flatMap((page) => page.results) ?? []
  const unreadCount = query.data?.pages[0]?.unread_count ?? 0

  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex flex-1 flex-col gap-4 px-4 py-6 lg:px-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{t('insights.title')}</h1>
          <p className="text-sm text-muted-foreground">{unreadCount} unread</p>
        </div>

        <Tabs value={filter} onValueChange={(value) => setFilter(value as typeof filter)}>
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="all">{t('insights.filter_all')}</TabsTrigger>
            <TabsTrigger value="post_workout">{t('insights.filter_post_workout')}</TabsTrigger>
            <TabsTrigger value="digests">{t('insights.filter_digests')}</TabsTrigger>
            <TabsTrigger value="alerts">{t('insights.filter_alerts')}</TabsTrigger>
          </TabsList>
        </Tabs>

        {insights.length === 0 && !query.isLoading ? (
          <Card className="border-dashed">
            <CardContent className="flex flex-col items-center px-6 py-12 text-center">
              <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/10 text-primary">
                <Sparkles className="h-8 w-8" />
              </div>
              <p className="font-semibold text-foreground">{t('insights.no_insights_yet')}</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-3">
            {insights.map((insight) => (
              <InsightListCard key={insight.id} insight={insight} />
            ))}
          </div>
        )}

        {query.hasNextPage && (
          <Button variant="outline" onClick={() => query.fetchNextPage()} disabled={query.isFetchingNextPage}>
            {query.isFetchingNextPage ? t('common.loading') : t('common.next')}
          </Button>
        )}
      </div>
    </div>
  )
}
