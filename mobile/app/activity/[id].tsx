import { useLocalSearchParams } from 'expo-router'

import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { useActivityDetail } from '@/src/hooks/use-swimcoach'
import { formatDuration, formatMeters, formatPace } from '@/src/utils/format'

export default function ActivityDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>()
  const activity = useActivityDetail(id)
  const pace = activity.data?.metric_snapshots.find((item) => item.metric_type === 'pace_avg')?.value

  return (
    <AppScreen title={activity.data?.session_name ?? 'Activity'} subtitle={activity.data?.logged_date}>
      <SectionCard title="Stats">
        <Text>Distance: {formatMeters(activity.data?.actual_distance_m)}</Text>
        <Text>Duration: {formatDuration(activity.data?.actual_duration_min)}</Text>
        <Text>Pace: {formatPace(pace)}</Text>
        <Text>SWOLF: {activity.data?.swolf_avg ?? '—'}</Text>
      </SectionCard>
      <SectionCard title="Set breakdown">
        {(activity.data?.set_logs ?? []).map((item) => <Text key={item.id}>{item.repetitions_completed ?? 1} × {item.distance_m ?? 0}m {item.stroke ?? ''} · SWOLF {item.avg_swolf ?? '—'}</Text>)}
      </SectionCard>
    </AppScreen>
  )
}
