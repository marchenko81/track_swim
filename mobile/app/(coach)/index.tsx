import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useRouter } from 'expo-router'
import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { AvatarBadge, MetricCard, SectionCard } from '@/src/components/common'
import { useTeamMetrics, useTeamRoster } from '@/src/hooks/use-swimcoach'
import { useAuthStore } from '@/src/stores/auth-store'
import { api } from '@/src/api/client'

export default function CoachHomeScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const metrics = useTeamMetrics('4w')
  const roster = useTeamRoster()
  const inviteSheet = useRef<BottomSheetModal>(null)
  const [email, setEmail] = useState('')

  return (
    <AppScreen title={`${t('home.good_morning')}, ${user?.first_name ?? ''}`} right={<AvatarBadge firstName={user?.first_name} lastName={user?.last_name} />} refreshing={metrics.isRefetching || roster.isRefetching} onRefresh={() => { metrics.refetch(); roster.refetch() }}>
      <View className="flex-row gap-3">
        <MetricCard label={t('home.total_athletes')} value={String(metrics.data?.summary.total_athletes ?? 0)} />
        <MetricCard label={t('home.active_this_week')} value={String(metrics.data?.summary.active_athletes ?? 0)} />
        <MetricCard label={t('metrics.at_risk_count', { count: metrics.data?.summary.at_risk_count ?? 0 })} value={String(metrics.data?.summary.at_risk_count ?? 0)} />
      </View>
      <SectionCard title={t('team.invite_athlete')} actionLabel="+" onPress={() => inviteSheet.current?.present()}>
        {(roster.data ?? []).map((row) => (
          <Pressable key={row.id} onPress={() => row.athlete_profile && router.push(`/athlete/${row.athlete_profile.id}`)} className="mb-3 flex-row items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
            <View><Text className="font-semibold text-slate-900">{row.athlete_profile ? `${row.athlete_profile.first_name} ${row.athlete_profile.last_name}` : row.invite_email}</Text><Text className="text-sm text-slate-500">{row.status}</Text></View>
            <Text className="text-slate-500">›</Text>
          </Pressable>
        ))}
      </SectionCard>
      <BottomSheetModal ref={inviteSheet} snapPoints={['35%']}>
        <BottomSheetView style={{ padding: 20, gap: 16 }}>
          <Text className="text-lg font-bold text-slate-900">{t('team.invite_athlete')}</Text>
          <Input placeholder="athlete@email.com" value={email} onChangeText={setEmail} />
          <Button className="rounded-2xl bg-sky-500" onPress={async () => { await api.post('/team/invite/', { email }); setEmail(''); inviteSheet.current?.dismiss(); roster.refetch() }}><Text className="text-white">{t('team.send_invite')}</Text></Button>
        </BottomSheetView>
      </BottomSheetModal>
    </AppScreen>
  )
}
