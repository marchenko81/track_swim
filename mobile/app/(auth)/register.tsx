import { useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { useAuthStore } from '@/src/stores/auth-store'

export default function RegisterScreen() {
  const { t } = useTranslation()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const router = useRouter()
  const register = useAuthStore((state) => state.register)
  const [role, setRole] = useState<'coach' | 'athlete'>('athlete')
  const [form, setForm] = useState({ email: '', password: '', first_name: '', last_name: '' })

  async function handleRegister() {
    try {
      const user = await register({ ...form, role, invite_token: token })
      router.replace(user.onboarding_completed ? (user.role === 'coach' ? '/(coach)' : '/(athlete)') : '/(auth)/onboarding')
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.response?.data?.error ?? 'Unable to create account.')
    }
  }

  return (
    <AppScreen title="SwimCoach" subtitle={t('auth.sign_up')}>
      <View className="gap-4 rounded-[28px] bg-white p-5">
        <View className="flex-row gap-3">
          <Button className={`flex-1 rounded-2xl ${role === 'athlete' ? 'bg-sky-500' : 'bg-slate-100'}`} onPress={() => setRole('athlete')}><Text className={role === 'athlete' ? 'text-white' : 'text-slate-900'}>{t('auth.role_athlete')}</Text></Button>
          <Button className={`flex-1 rounded-2xl ${role === 'coach' ? 'bg-sky-500' : 'bg-slate-100'}`} onPress={() => setRole('coach')}><Text className={role === 'coach' ? 'text-white' : 'text-slate-900'}>{t('auth.role_coach')}</Text></Button>
        </View>
        <Input placeholder={t('auth.first_name')} value={form.first_name} onChangeText={(value) => setForm((current) => ({ ...current, first_name: value }))} />
        <Input placeholder={t('auth.last_name')} value={form.last_name} onChangeText={(value) => setForm((current) => ({ ...current, last_name: value }))} />
        <Input placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" value={form.email} onChangeText={(value) => setForm((current) => ({ ...current, email: value }))} />
        <Input placeholder={t('auth.password')} secureTextEntry value={form.password} onChangeText={(value) => setForm((current) => ({ ...current, password: value }))} />
        <Button className="h-14 rounded-2xl bg-sky-500" onPress={handleRegister}><Text className="text-white">{t('auth.create_account')}</Text></Button>
      </View>
    </AppScreen>
  )
}
