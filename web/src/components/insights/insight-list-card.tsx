import { Link } from '@tanstack/react-router'
import { AlertTriangle, CalendarDays, Sparkles, Waves } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { useLanguage } from '@/contexts/language-context'
import type { InsightItem } from '@/lib/insights-api'

function iconForType(type: InsightItem['insight_type']) {
  if (type === 'weekly_digest') return CalendarDays
  if (type === 'load_alert') return AlertTriangle
  return Waves
}

export function InsightListCard({ insight }: { insight: InsightItem }) {
  const { t, lang } = useLanguage()
  const Icon = iconForType(insight.insight_type)

  return (
    <Link to="/insights/$id" params={{ id: insight.id }} className="block">
      <Card className="transition-colors hover:border-primary/30">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-semibold text-foreground">
                  {insight.insight_type === 'post_workout'
                    ? t('insights.filter_post_workout')
                    : insight.insight_type === 'weekly_digest'
                    ? t('insights.weekly_digest')
                    : insight.insight_type === 'load_alert'
                    ? t('insights.load_alert')
                    : t('insights.technique')}
                </p>
                {insight.unread && <Badge>{t('insights.unread')}</Badge>}
                <span className="text-xs text-muted-foreground">
                  {new Date(insight.created_at).toLocaleDateString(lang === 'ru' ? 'ru-RU' : 'en-US')}
                </span>
              </div>
              <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground">{insight.content}</p>
              {insight.target_audience === 'both' && (
                <div className="mt-3 flex items-center gap-1 text-xs text-primary">
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>{insight.athlete_name}</span>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
