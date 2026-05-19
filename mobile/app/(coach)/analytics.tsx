import { useState } from 'react'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { MetricCard, SectionCard } from '@/src/components/common'
import { useTeamMetrics } from '@/src/hooks/use-swimcoach'

const RANGES = ['4w', '8w', '12w', 'season']

export default function CoachAnalyticsScreen() {
  const [range, setRange] = useState('4w')
  const metrics = useTeamMetrics(range)

  return (
    <AppScreen title="Analytics">
      <View className="flex-row gap-2">{RANGES.map((item) => <Pressable key={item} onPress={() => setRange(item)} className={`rounded-full px-4 py-2 ${range === item ? 'bg-sky-500' : 'bg-white'}`}><Text className={range === item ? 'text-white' : 'text-slate-700'}>{item.toUpperCase()}</Text></Pressable>)}</View>
      <View className="flex-row gap-3"><MetricCard label="Team SWOLF" value={metrics.data?.summary.team_swolf_avg?.toFixed(1) ?? '—'} /><MetricCard label="Compliance" value={metrics.data?.summary.team_compliance ? `${Math.round(metrics.data.summary.team_compliance)}%` : '—'} /><MetricCard label="At risk" value={String(metrics.data?.summary.at_risk_count ?? 0)} /></View>
      <SectionCard title="Compliance list">{(metrics.data?.athletes ?? []).map((athlete) => <View key={athlete.id} className="mb-3 gap-2"><View className="flex-row justify-between"><Text>{athlete.name}</Text><Text>{athlete.compliance ? `${Math.round(athlete.compliance)}%` : '—'}</Text></View><View className="h-2 rounded-full bg-slate-100"><View className={`h-2 rounded-full ${athlete.status === 'at_risk' ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${athlete.compliance ?? 0}%` }} /></View></View>)}</SectionCard>
      <SectionCard title="Stroke distribution">{Object.entries(metrics.data?.stroke_distribution ?? {}).map(([stroke, value]) => <Text key={stroke}>{stroke}: {value}%</Text>)}</SectionCard>
    </AppScreen>
  )
}
