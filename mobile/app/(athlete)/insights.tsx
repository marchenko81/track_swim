import { useState } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { useInsights } from '@/src/hooks/use-swimcoach'
import { formatRelative } from '@/src/utils/format'

const FILTERS = [
  { label: 'insights.filter_all', value: '' },
  { label: 'insights.filter_post_workout', value: '?type=post_workout' },
  { label: 'insights.filter_digests', value: '?type=weekly_digest' },
  { label: 'insights.filter_alerts', value: '?type=load_alert' },
]

export default function AthleteInsightsScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const [filter, setFilter] = useState('')
  const insights = useInsights(filter)

  return (
    <AppScreen title={t('insights.title')} subtitle={`${insights.data?.unread_count ?? 0} unread`}>
      <View className="flex-row flex-wrap gap-2">
        {FILTERS.map((item) => <Pressable key={item.label} onPress={() => setFilter(item.value)} className={`rounded-full px-4 py-2 ${filter === item.value ? 'bg-sky-500' : 'bg-white'}`}><Text className={filter === item.value ? 'text-white' : 'text-slate-700'}>{t(item.label)}</Text></Pressable>)}
      </View>
      <SectionCard>
        {(insights.data?.results ?? []).map((insight: any) => (
          <Pressable key={insight.id} onPress={() => router.push(`/insight/${insight.id}`)} className="mb-3 rounded-2xl bg-slate-50 px-4 py-4">
            <View className="flex-row items-start justify-between gap-3"><View className="flex-1"><Text className="font-semibold text-slate-900">{insight.insight_type_label}</Text><Text className="text-sm text-slate-500">{formatRelative(insight.created_at)}</Text></View>{insight.unread ? <Text className="rounded-full bg-sky-100 px-2 py-1 text-xs font-semibold text-sky-700">NEW</Text> : null}</View>
            <Text className="mt-2 text-slate-700">{insight.preview}</Text>
          </Pressable>
        ))}
      </SectionCard>
    </AppScreen>
  )
}
