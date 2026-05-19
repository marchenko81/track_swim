import { useState } from 'react'
import { Alert, Pressable, View } from 'react-native'

import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { SectionCard } from '@/src/components/common'
import { useTeamRoster } from '@/src/hooks/use-swimcoach'
import { api } from '@/src/api/client'

export default function CoachTeamScreen() {
  const roster = useTeamRoster()
  const [search, setSearch] = useState('')
  const rows = (roster.data ?? []).filter((item) => `${item.athlete_profile?.first_name ?? ''} ${item.athlete_profile?.last_name ?? ''} ${item.invite_email ?? ''}`.toLowerCase().includes(search.toLowerCase()))

  async function updateStatus(id: string, status: 'paused' | 'removed') {
    await api.patch(`/team/athletes/${id}/`, { status })
    roster.refetch()
  }

  return (
    <AppScreen title="Team">
      <Input placeholder="Search" value={search} onChangeText={setSearch} />
      <SectionCard>
        {rows.map((row) => (
          <View key={row.id} className="mb-3 rounded-2xl bg-slate-50 px-4 py-4">
            <View className="flex-row items-center justify-between"><View><Text className="font-semibold text-slate-900">{row.athlete_profile ? `${row.athlete_profile.first_name} ${row.athlete_profile.last_name}` : row.invite_email}</Text><Text className="text-sm text-slate-500">{row.status}</Text></View>{row.athlete_profile ? <View className="flex-row gap-2"><Pressable onPress={() => Alert.alert('Pause athlete?', undefined, [{ text: 'Cancel' }, { text: 'Pause', onPress: () => updateStatus(row.id, 'paused') }])}><Text className="text-amber-600">Pause</Text></Pressable><Pressable onPress={() => Alert.alert('Remove athlete?', undefined, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: () => updateStatus(row.id, 'removed') }])}><Text className="text-red-600">Remove</Text></Pressable></View> : null}</View>
          </View>
        ))}
      </SectionCard>
    </AppScreen>
  )
}
