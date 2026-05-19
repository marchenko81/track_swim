import { useTranslation } from 'react-i18next'
import { View } from 'react-native'
import { Text } from '@/components/ui/text'
import { useOfflineStore } from '@/src/stores/offline-store'

export function OfflineBanner() {
  const { t } = useTranslation()
  const isOffline = useOfflineStore((state) => state.isOffline)
  if (!isOffline) return null
  return (
    <View className="bg-amber-500 px-4 py-2">
      <Text className="text-center text-sm font-medium text-white">{t('mobile.offline_banner')}</Text>
    </View>
  )
}
