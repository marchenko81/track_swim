import { Link, useLocalSearchParams } from 'expo-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { api } from '@/src/api/client'

export default function InviteScreen() {
  const { t } = useTranslation()
  const { token } = useLocalSearchParams<{ token: string }>()
  const { data } = useQuery({ queryKey: ['invite', token], queryFn: async () => (await api.get(`/team/invite/${token}/`)).data })

  return (
    <AppScreen title="SwimCoach" subtitle={data ? t('invite.invited_by', { name: data.coach_name }) : undefined}>
      <View className="gap-4 rounded-[28px] bg-white p-5">
        <Text className="text-sm text-slate-600">{data?.club_name || ''}</Text>
        <Link href={{ pathname: '/(auth)/register', params: { token } }} asChild><Button className="rounded-2xl bg-sky-500"><Text className="text-white">{t('invite.create_account_and_join')}</Text></Button></Link>
        <Link href={{ pathname: '/(auth)/login', params: { token } }} asChild><Button variant="outline" className="rounded-2xl"><Text>{t('invite.already_have_account_join')}</Text></Button></Link>
      </View>
    </AppScreen>
  )
}
