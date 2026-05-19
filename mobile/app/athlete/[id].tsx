import { useLocalSearchParams } from 'expo-router'
import { Linking, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { SimpleLineChart } from '@/src/components/charts'
import { useCoachAthleteMetrics } from '@/src/hooks/use-swimcoach'
import { api } from '@/src/api/client'
import { formatPace } from '@/src/utils/format'

export default function CoachAthleteDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const athlete = useCoachAthleteMetrics(id)

  return (
    <AppScreen title={athlete.data?.athlete_info.name ?? 'Athlete'} subtitle={athlete.data?.athlete_info.current_plan ? `Week ${athlete.data.athlete_info.current_plan.week_current} of ${athlete.data.athlete_info.current_plan.week_total}` : 'No active plan'}>
      <SectionCard title="Snapshot"><Text>SWOLF: {athlete.data?.summary.swolf_avg ?? '—'}</Text><Text>Pace: {formatPace(athlete.data?.summary.pace_avg_sec)}</Text><Text>Compliance: {athlete.data?.summary.compliance_score ? `${Math.round(athlete.data.summary.compliance_score)}%` : '—'}</Text></SectionCard>
      <SectionCard title="SWOLF trend"><SimpleLineChart values={athlete.data?.chart_data.map((item) => item.swolf_avg) ?? []} /></SectionCard>
      <SectionCard title="Session history">{(athlete.data?.session_history ?? []).slice(0, 20).map((item) => <Text key={item.id}>{item.date} · {item.session_name ?? 'Session'} · {item.actual_distance_m ?? 0}m · {item.avg_swolf ?? '—'}</Text>)}</SectionCard>
      <SectionCard title="Coach notes">{(athlete.data?.coach_notes ?? []).map((note) => <Text key={note.id}>{note.content}</Text>)}<Button className="mt-3 rounded-2xl bg-sky-500" onPress={() => api.post('/metrics/coach-notes/', { athlete_id: id, content: 'Quick mobile note' })}><Text className="text-white">Save Note</Text></Button></SectionCard>
      <Button className="rounded-2xl bg-slate-900" onPress={() => Linking.openURL(`${api.defaults.baseURL?.replace('/api', '')}/plans`)}><Text className="text-white">Adjust Plan</Text></Button>
    </AppScreen>
  )
}
