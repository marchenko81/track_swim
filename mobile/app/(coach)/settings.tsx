import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Text } from '@/components/ui/text'
import { AppScreen } from '@/src/components/app-shell'
import { AvatarBadge, SectionCard } from '@/src/components/common'
import { useAuthStore } from '@/src/stores/auth-store'

export default function CoachSettingsScreen() {
  const { t } = useTranslation()
  const user = useAuthStore((state) => state.user)
  const logout = useAuthStore((state) => state.logout)
  return (
    <AppScreen title={t('settings.settings')} right={<AvatarBadge firstName={user?.first_name} lastName={user?.last_name} />}>
      <SectionCard title={t('profile.edit_profile')}><Text>{user?.first_name} {user?.last_name}</Text><Text>{user?.email}</Text><Text>{user?.club_name}</Text></SectionCard>
      <Button variant="destructive" className="rounded-2xl" onPress={() => logout()}><Text className="text-white">{t('mobile.log_out')}</Text></Button>
    </AppScreen>
  )
}
