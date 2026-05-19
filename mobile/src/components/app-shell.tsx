import type { PropsWithChildren, ReactNode } from 'react'
import { RefreshControl, ScrollView, View } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'

import { Text } from '@/components/ui/text'

export function AppScreen({ title, subtitle, right, children, refreshing, onRefresh }: PropsWithChildren<{ title?: string; subtitle?: string; right?: ReactNode; refreshing?: boolean; onRefresh?: () => void }>) {
  return (
    <SafeAreaView className="flex-1 bg-[#f4f7fb]">
      <ScrollView className="flex-1" contentContainerStyle={{ padding: 20, gap: 16 }} refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}>
        {(title || subtitle || right) && (
          <View className="flex-row items-start justify-between gap-4 rounded-[28px] bg-[#18181b] px-5 py-5">
            <View className="flex-1 gap-1">
              {title ? <Text className="text-3xl font-bold text-white">{title}</Text> : null}
              {subtitle ? <Text className="text-sm text-white/70">{subtitle}</Text> : null}
            </View>
            {right}
          </View>
        )}
        {children}
      </ScrollView>
    </SafeAreaView>
  )
}
