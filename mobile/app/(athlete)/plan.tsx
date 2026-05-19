import { useMemo } from 'react'
import { useRouter } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { useAssignments, usePlanSessions } from '@/src/hooks/use-swimcoach'
import { formatMeters } from '@/src/utils/format'

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

export default function AthletePlanScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const assignments = useAssignments()
  const activeAssignment = assignments.data?.find((item) => item.status === 'active')
  const sessions = usePlanSessions(activeAssignment?.plan)
  const grouped = useMemo(() => DAYS.map((day, index) => ({ day, session: sessions.data?.find((item) => item.day_of_week === index) })), [sessions.data])

  return (
    <AppScreen title={t('nav.plan')} subtitle={activeAssignment ? `Week 1 of ${activeAssignment.plan_duration_weeks} · ${activeAssignment.plan_name}` : undefined}>
      <SectionCard>
        {grouped.map(({ day, session }) => (
          <Pressable key={day} onPress={() => session && router.push(`/session/${session.id}`)} className="mb-3 flex-row items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
            <View><Text className="text-base font-semibold text-slate-900">{day}</Text></View>
            {session ? <View className="items-end"><Text className="font-semibold text-slate-900">{session.name}</Text><Text className="text-sm text-slate-500">{formatMeters(session.total_distance_m)}</Text></View> : <Text className="text-slate-400">{t('plan.rest_day')}</Text>}
          </Pressable>
        ))}
      </SectionCard>
    </AppScreen>
  )
}
