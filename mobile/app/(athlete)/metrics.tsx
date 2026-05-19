import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { Heatmap, SimpleLineChart } from '@/src/components/charts'
import { MetricCard, SectionCard } from '@/src/components/common'
import { useMetrics } from '@/src/hooks/use-swimcoach'
import { formatMeters, formatPace } from '@/src/utils/format'

const RANGES = ['4w', '8w', '12w', 'season']

export default function AthleteMetricsScreen() {
  const { t } = useTranslation()
  const [range, setRange] = useState('4w')
  const [selectedHeatmap, setSelectedHeatmap] = useState<string>()
  const metrics = useMetrics(range)

  return (
    <AppScreen title={t('metrics.title')}>
      <View className="flex-row gap-2">
        {RANGES.map((item) => <Pressable key={item} onPress={() => setRange(item)} className={`rounded-full px-4 py-2 ${range === item ? 'bg-sky-500' : 'bg-white'}`}><Text className={range === item ? 'text-white' : 'text-slate-700'}>{t(`metrics.range_${item}`)}</Text></Pressable>)}
      </View>
      <View className="flex-row gap-3">
        <MetricCard label="SWOLF" value={metrics.data?.summary.swolf_avg?.toFixed(1) ?? '—'} hint={metrics.data?.summary.swolf_trend?.direction ?? '—'} />
        <MetricCard label="Pace" value={formatPace(metrics.data?.summary.pace_avg_sec)} hint={metrics.data?.summary.pace_trend?.direction ?? '—'} />
        <MetricCard label={t('metrics.compliance')} value={metrics.data?.summary.compliance_score ? `${Math.round(metrics.data.summary.compliance_score)}%` : '—'} hint={`${metrics.data?.summary.sessions_completed ?? 0} sessions`} />
      </View>
      <SectionCard title="SWOLF trend">
        <SimpleLineChart values={metrics.data?.chart_data.map((item) => item.swolf_avg) ?? []} />
      </SectionCard>
      <SectionCard title={t('metrics.stroke_distribution')}>
        {Object.entries(metrics.data?.stroke_distribution ?? {}).map(([stroke, value]) => (
          <View key={stroke} className="mb-3 gap-2"><View className="flex-row justify-between"><Text className="text-slate-700">{stroke}</Text><Text className="text-slate-500">{value}%</Text></View><View className="h-2 rounded-full bg-slate-100"><View className="h-2 rounded-full bg-sky-500" style={{ width: `${value}%` }} /></View></View>
        ))}
      </SectionCard>
      <SectionCard title="Training heatmap">
        <Heatmap items={metrics.data?.heatmap ?? []} selected={selectedHeatmap} onSelect={setSelectedHeatmap} />
      </SectionCard>
      <SectionCard title={t('metrics.personal_bests')}>
        {(metrics.data?.personal_bests ?? []).map((item, index) => <Text key={index} className="text-slate-700">{item.label}: {item.value} {item.unit}</Text>)}
        <Text className="text-slate-500">{formatMeters(metrics.data?.summary.total_distance_m)}</Text>
      </SectionCard>
    </AppScreen>
  )
}
