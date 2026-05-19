import { useRouter } from 'expo-router'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { View } from 'react-native'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { useAuthStore } from '@/src/stores/auth-store'

export default function OnboardingScreen() {
  const { t } = useTranslation()
  const router = useRouter()
  const user = useAuthStore((state) => state.user)
  const updateProfile = useAuthStore((state) => state.updateProfile)
  const [form, setForm] = useState({ club_name: user?.club_name ?? '', sport: user?.sport ?? 'swimming', date_of_birth: user?.date_of_birth ?? '', stroke_specialty: user?.stroke_specialty ?? 'none', fitness_level: user?.fitness_level ?? 'beginner' })

  async function handleFinish() {
    const next = await updateProfile({
      ...form,
      date_of_birth: form.date_of_birth || null,
      onboarding_completed: true,
    })
    router.replace(next.role === 'coach' ? '/(coach)' : '/(athlete)')
  }

  const isCoach = user?.role === 'coach'

  return (
    <AppScreen title={t('onboarding.setup_profile')}>
      <View className="gap-4 rounded-[28px] bg-white p-5">
        <Input placeholder={t('onboarding.club_name')} value={form.club_name} onChangeText={(value) => setForm((current) => ({ ...current, club_name: value }))} />
        {isCoach ? (
          <Input placeholder={t('onboarding.sport')} value={form.sport} onChangeText={(value) => setForm((current) => ({ ...current, sport: value }))} />
        ) : (
          <>
            <Input placeholder={t('onboarding.date_of_birth')} value={form.date_of_birth} onChangeText={(value) => setForm((current) => ({ ...current, date_of_birth: value }))} />
            <Input placeholder={t('onboarding.stroke_specialty')} value={form.stroke_specialty} onChangeText={(value) => setForm((current) => ({ ...current, stroke_specialty: value }))} />
            <Input placeholder={t('onboarding.fitness_level')} value={form.fitness_level} onChangeText={(value) => setForm((current) => ({ ...current, fitness_level: value }))} />
          </>
        )}
        <Button className="h-14 rounded-2xl bg-sky-500" onPress={handleFinish}><Text className="text-white">{t('onboarding.finish_setup')}</Text></Button>
      </View>
    </AppScreen>
  )
}
