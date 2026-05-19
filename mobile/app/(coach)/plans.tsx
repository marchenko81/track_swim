import DateTimePicker from '@react-native-community/datetimepicker'
import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { useRef, useState } from 'react'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { usePlans, useTeamRoster } from '@/src/hooks/use-swimcoach'
import { api } from '@/src/api/client'

export default function CoachPlansScreen() {
  const plans = usePlans()
  const roster = useTeamRoster()
  const assignSheet = useRef<BottomSheetModal>(null)
  const [planId, setPlanId] = useState<string>()
  const [startDate, setStartDate] = useState(new Date())
  const [selectedAthletes, setSelectedAthletes] = useState<string[]>([])

  async function assignPlan() {
    if (!planId) return
    await api.post(`/plans/${planId}/assign/`, { athlete_ids: selectedAthletes, start_date: startDate.toISOString().slice(0, 10) })
    assignSheet.current?.dismiss()
  }

  return (
    <AppScreen title="Plans">
      <SectionCard><Text className="text-slate-500">Create and edit plans on the web app for the best experience.</Text></SectionCard>
      <SectionCard>
        {(plans.data ?? []).map((plan) => (
          <View key={plan.id} className="mb-3 rounded-2xl bg-slate-50 px-4 py-4">
            <Text className="font-semibold text-slate-900">{plan.name}</Text><Text className="text-sm text-slate-500">{plan.duration_weeks} weeks · {plan.session_count} sessions</Text>
            <Button className="mt-3 rounded-2xl bg-sky-500" onPress={() => { setPlanId(plan.id); assignSheet.current?.present() }}><Text className="text-white">Assign</Text></Button>
          </View>
        ))}
      </SectionCard>
      <BottomSheetModal ref={assignSheet} snapPoints={['60%']}>
        <BottomSheetView style={{ padding: 20, gap: 16 }}>
          <Text className="text-lg font-bold text-slate-900">Assign Plan</Text>
          <DateTimePicker value={startDate} onChange={(_, value) => value && setStartDate(value)} />
          {(roster.data ?? []).filter((item) => item.athlete_profile).map((item) => (
            <Button key={item.id} variant={selectedAthletes.includes(item.athlete_profile!.id) ? 'default' : 'outline'} className="justify-start rounded-2xl" onPress={() => setSelectedAthletes((current) => current.includes(item.athlete_profile!.id) ? current.filter((value) => value !== item.athlete_profile!.id) : [...current, item.athlete_profile!.id])}><Text className={selectedAthletes.includes(item.athlete_profile!.id) ? 'text-white' : 'text-slate-900'}>{item.athlete_profile!.first_name} {item.athlete_profile!.last_name}</Text></Button>
          ))}
          <Button className="rounded-2xl bg-sky-500" onPress={assignPlan}><Text className="text-white">Assign Plan</Text></Button>
        </BottomSheetView>
      </BottomSheetModal>
    </AppScreen>
  )
}
