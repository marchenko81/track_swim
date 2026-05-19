import { BottomSheetModal, BottomSheetView } from '@gorhom/bottom-sheet'
import { Stack, useLocalSearchParams, useRouter } from 'expo-router'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, Pressable, ScrollView, TextInput, View } from 'react-native'
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { SectionCard } from '@/src/components/common'
import { useAssignments, usePlanSessions, useToday, useWorkoutLogger } from '@/src/hooks/use-swimcoach'
import { useOfflineStore } from '@/src/stores/offline-store'
import { formatDuration, formatMeters } from '@/src/utils/format'

const SET_COLORS: Record<string, string> = { warm_up: '#22c55e', main: '#3b82f6', drill: '#a855f7', kick: '#f59e0b', pull: '#f59e0b', cool_down: '#9ca3af' }

export default function SessionDetailScreen() {
  const { t } = useTranslation()
  const { id } = useLocalSearchParams<{ id: string }>()
  const router = useRouter()
  const bottomSheetRef = useRef<BottomSheetModal>(null)
  const [rpe, setRpe] = useState('5')
  const [notes, setNotes] = useState('')
  const today = useToday()
  const assignments = useAssignments()
  const activeAssignment = assignments.data?.find((item) => item.status === 'active')
  const sessions = usePlanSessions(activeAssignment?.plan)
  const session = useMemo(() => today.data?.session?.id === id ? today.data.session : sessions.data?.find((item) => item.id === id), [id, sessions.data, today.data?.session])
  const logWorkout = useWorkoutLogger()
  const enqueueWorkoutLog = useOfflineStore((state) => state.enqueueWorkoutLog)
  const isOffline = useOfflineStore((state) => state.isOffline)

  useEffect(() => { activateKeepAwakeAsync(); return () => { deactivateKeepAwake() } }, [])

  async function submit(status: 'completed' | 'skipped') {
    if (!session) return
    const payload = { session: session.id, assignment: today.data?.assignment?.id, status, perceived_effort_rpe: status === 'completed' ? Number(rpe) : undefined, athlete_notes: notes || undefined, logged_date: new Date().toISOString().slice(0, 10) }
    if (isOffline) {
      await enqueueWorkoutLog(payload)
      Alert.alert(t('common.success'), t('mobile.session_logged_offline'))
      router.replace('/(athlete)')
      return
    }
    await logWorkout.mutateAsync(payload)
    Alert.alert(t('common.success'), t('workout.session_logged'))
    router.replace('/(athlete)')
  }

  return (
    <View className="flex-1 bg-[#f4f7fb]">
      <Stack.Screen options={{ headerShown: false }} />
      <View className="px-5 pb-4 pt-14">
        <View className="mb-4 flex-row items-center justify-between"><Pressable onPress={() => router.back()}><Text className="text-base font-semibold text-slate-600">{t('common.back')}</Text></Pressable><Text className="flex-1 px-4 text-center text-lg font-bold text-slate-900">{session?.name}</Text><Button className="rounded-full bg-emerald-500 px-4" onPress={() => bottomSheetRef.current?.present()}><Text className="text-white">Done ✓</Text></Button></View>
        <Text className="mb-3 text-center text-sm text-slate-500">Week {session?.week_number} · {formatMeters(session?.total_distance_m)} · {formatDuration(session?.estimated_duration_min)}</Text>
        <ScrollView contentContainerStyle={{ paddingBottom: 120, gap: 12 }}>
          {session?.coach_notes ? <SectionCard title={t('session.coach_notes')}><Text className="text-slate-700">{session.coach_notes}</Text></SectionCard> : null}
          {(session?.sets ?? []).map((setItem) => (
            <View key={setItem.id} style={{ borderLeftWidth: 5, borderLeftColor: SET_COLORS[setItem.set_type] ?? 'transparent' }} className="rounded-[24px] bg-white px-5 py-4">
              <Text className="text-[22px] font-bold text-slate-900">{setItem.distance_m ? `${setItem.repetitions} × ${setItem.distance_m}m ${setItem.stroke}` : `Rest ${setItem.rest_seconds ?? 0}s`}</Text>
              {setItem.equipment?.length ? <Text className="mt-2 text-sm text-slate-500">{setItem.equipment.join(' · ')}</Text> : null}
              <Text className="mt-2 text-sm text-slate-500">{setItem.target_pace_per_100m ? `Target: ${setItem.target_pace_per_100m}/100m` : ''} {setItem.target_hr_zone ? `· HR ${setItem.target_hr_zone}` : ''} {setItem.intensity_rpe ? `· RPE ${setItem.intensity_rpe}` : ''}</Text>
              {setItem.description ? <Text className="mt-2 text-sm italic text-slate-500">{setItem.description}</Text> : null}
            </View>
          ))}
          <Text className="text-center text-base font-semibold text-slate-700">Total: {formatMeters(session?.total_distance_m)}</Text>
        </ScrollView>
      </View>
      <View className="absolute bottom-0 left-0 right-0 flex-row gap-3 border-t border-slate-200 bg-white px-5 py-4">
        <Button className="h-14 flex-1 rounded-2xl bg-emerald-500" onPress={() => bottomSheetRef.current?.present()}><Text className="text-lg text-white">Mark Done ✓</Text></Button>
        <Button variant="outline" className="h-14 w-28 rounded-2xl" onPress={() => Alert.alert('Skip this session?', undefined, [{ text: t('common.cancel') }, { text: t('session.skip_session'), style: 'destructive', onPress: () => submit('skipped') }])}><Text>{t('session.skip_session')}</Text></Button>
      </View>
      <BottomSheetModal ref={bottomSheetRef} snapPoints={['45%']}>
        <BottomSheetView style={{ flex: 1, padding: 20, gap: 16 }}>
          <Text className="text-lg font-bold text-slate-900">{t('session.how_did_it_feel')}</Text>
          <TextInput className="rounded-2xl bg-slate-100 px-4 py-4 text-center text-3xl font-bold text-slate-900" keyboardType="number-pad" value={rpe} onChangeText={setRpe} />
          <TextInput className="min-h-28 rounded-2xl bg-slate-100 px-4 py-4 text-base text-slate-900" multiline placeholder="Any notes about this session..." value={notes} onChangeText={setNotes} />
          <Button className="h-14 rounded-2xl bg-sky-500" onPress={() => submit('completed')}><Text className="text-white">{t('session.log_session')}</Text></Button>
        </BottomSheetView>
      </BottomSheetModal>
    </View>
  )
}
