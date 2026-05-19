import { Link, useLocalSearchParams, useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Alert, View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { useAuthStore } from '@/src/stores/auth-store'

export default function LoginScreen() {
  const { t } = useTranslation()
  const { token } = useLocalSearchParams<{ token?: string }>()
  const router = useRouter()
  const login = useAuthStore((state) => state.login)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit() {
    try {
      setSubmitting(true)
      const user = await login(email, password, token)
      router.replace(user.onboarding_completed ? (user.role === 'coach' ? '/(coach)' : '/(athlete)') : '/(auth)/onboarding')
    } catch (error: any) {
      Alert.alert(t('common.error'), error?.response?.data?.error ?? 'Unable to sign in.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AppScreen title="SwimCoach" subtitle={t('auth.sign_in')}>
      <View className="gap-4 rounded-[28px] bg-white p-5">
        <Input placeholder={t('auth.email')} autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} />
        <Input placeholder={t('auth.password')} secureTextEntry value={password} onChangeText={setPassword} />
        <Button className="h-14 rounded-2xl bg-sky-500" onPress={handleSubmit} disabled={submitting}>
          <Text className="text-base font-semibold text-white">{t('auth.sign_in')}</Text>
        </Button>
        <Link href={{ pathname: '/(auth)/register', params: token ? { token } : undefined }} asChild>
          <Button variant="ghost"><Text>{t('auth.sign_up')}</Text></Button>
        </Link>
      </View>
    </AppScreen>
  )
}
