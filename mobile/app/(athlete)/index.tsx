import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { AvatarBadge, MetricCard, SectionCard } from '@/src/components/common'
import { useInsights, useMetrics, useToday, useUnreadInsight } from '@/src/hooks/use-swimcoach'
import { useAuthStore } from '@/src/stores/auth-store'
import { formatMeters, formatRelative, getGreeting } from '@/src/utils/format'

export default function AthleteHomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const today = useToday()
  const unread = useUnreadInsight()
  const unreadCount = useInsights('unread-count/').data?.count ?? 0
  const metrics = useMetrics('4w')

  const firstInsight = unread.data?.results?.[0]

  return (
    <AppScreen title={`${t(`home.${getGreeting()}`)}, ${user?.first_name ?? ''}`} right={<AvatarBadge firstName={user?.first_name} lastName={user?.last_name} />} refreshing={today.isRefetching || unread.isRefetching || metrics.isRefetching} onRefresh={() => { today.refetch(); unread.refetch(); metrics.refetch() }}>
      <SectionCard title={t('session.todays_session')}>
        {today.data?.session ? (
          <View className="gap-4">
            <Text className="text-2xl font-bold text-slate-900">{today.data.session.name}</Text>
            <Text className="text-sm text-slate-500">{formatMeters(today.data.session.total_distance_m)} · {today.data.assignment?.week_number ? `Week ${today.data.assignment.week_number} of ${today.data.assignment.total_weeks}` : ''}</Text>
            <View className="flex-row gap-3">
              <Button className="h-12 flex-1 rounded-2xl bg-sky-500" onPress={() => router.push(`/session/${today.data?.session?.id}`)}><Text className="text-white">View Session</Text></Button>
              <Button variant="outline" className="h-12 w-28 rounded-2xl" onPress={() => router.push(`/session/${today.data?.session?.id}`)}><Text>{t('session.skip_session')}</Text></Button>
            </View>
          </View>
        ) : today.data?.assignment ? (
          <View className="gap-2"><Text className="text-2xl font-bold text-slate-900">Rest Day 🏖</Text><Text className="text-slate-500">Week {today.data.assignment.week_number} of {today.data.assignment.total_weeks}</Text></View>
        ) : (
          <View className="gap-2"><Text className="text-xl font-semibold text-slate-900">No plan assigned yet</Text><Text className="text-slate-500">{t('home.waiting_for_coach')}</Text></View>
        )}
      </SectionCard>

      {firstInsight ? (
        <Pressable onPress={() => router.push(`/insight/${firstInsight.id}`)}>
          <SectionCard title="AI Insight" actionLabel="View →" onPress={() => router.push(`/insight/${firstInsight.id}`)}>
            <Text className="text-sm text-slate-500">{formatRelative(firstInsight.created_at)}</Text>
            <Text className="text-base text-slate-800">{firstInsight.content.slice(0, 120)}...</Text>
          </SectionCard>
        </Pressable>
      ) : null}

      <View className="flex-row gap-3">
        <MetricCard label="SWOLF" value={metrics.data?.summary.swolf_avg?.toFixed(1) ?? '—'} hint={metrics.data?.summary.swolf_trend?.direction ?? '—'} />
        <MetricCard label={t('metrics.compliance')} value={metrics.data?.summary.compliance_score ? `${Math.round(metrics.data.summary.compliance_score)}%` : '—'} hint={`${metrics.data?.summary.sessions_completed ?? 0}/${metrics.data?.summary.sessions_planned ?? 0}`} />
        <MetricCard label="Distance" value={formatMeters(metrics.data?.summary.total_distance_m)} hint={`${unreadCount} unread`} />
      </View>
    </AppScreen>
  )
}
