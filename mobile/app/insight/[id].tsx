import { Stack, useLocalSearchParams } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { useInsightDetail } from '@/src/hooks/use-swimcoach'
import { api } from '@/src/api/client'
import { formatRelative } from '@/src/utils/format'

export default function InsightDetailScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const insight = useInsightDetail(id)
  const sentences = (insight.data?.content ?? '').split('. ').filter(Boolean)
  const actionable = sentences[sentences.length - 1]

  return (
    <AppScreen title={insight.data?.insight_type_label ?? t('insights.title')} subtitle={formatRelative(insight.data?.created_at)}>
      <Stack.Screen options={{ headerShown: false }} />
      <SectionCard title={t('insights.session_reference')}>
        <Text className="text-slate-600">{insight.data?.session_reference?.session_name ?? '—'}</Text>
      </SectionCard>
      <SectionCard>
        <Text className="text-base leading-7 text-slate-800">{insight.data?.content}</Text>
      </SectionCard>
      {actionable ? <SectionCard><Text className="rounded-2xl bg-sky-50 px-4 py-4 text-sky-800">{actionable}</Text></SectionCard> : null}
      <SectionCard title="Stats">
        {Object.entries(insight.data?.metrics ?? {}).map(([key, value]) => <Text key={key} className="text-slate-700">{key}: {value.value} {value.unit}</Text>)}
      </SectionCard>
      <Button className="rounded-2xl bg-sky-500" onPress={() => api.post(`/insights/${id}/share/`, {})}><Text className="text-white">{t('insights.share_with_coach')}</Text></Button>
    </AppScreen>
  )
}
