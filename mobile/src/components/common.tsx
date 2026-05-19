import type { ReactNode } from 'react'
import { View, Pressable } from 'react-native'
import { Card, CardContent } from '@/components/ui/card'
import { Text } from '@/components/ui/text'
import { getInitials } from '@/src/utils/format'

export function AvatarBadge({ firstName, lastName }: { firstName?: string | null; lastName?: string | null }) {
  return (
    <View className="h-12 w-12 items-center justify-center rounded-full bg-white/15">
      <Text className="text-base font-bold text-white">{getInitials(firstName, lastName)}</Text>
    </View>
  )
}

export function MetricCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <Card className="flex-1 rounded-[24px] border-0 bg-white px-0 py-0 shadow-sm shadow-slate-200">
      <CardContent className="gap-2 px-4 py-4">
        <Text className="text-xs uppercase tracking-[1.5px] text-slate-500">{label}</Text>
        <Text className="text-2xl font-bold text-slate-900">{value}</Text>
        {hint ? <Text className="text-xs text-slate-500">{hint}</Text> : null}
      </CardContent>
    </Card>
  )
}

export function SectionCard({ title, actionLabel, onPress, children }: { title?: string; actionLabel?: string; onPress?: () => void; children: ReactNode }) {
  return (
    <Card className="rounded-[28px] border-0 bg-white px-0 py-0 shadow-sm shadow-slate-200">
      <CardContent className="gap-4 px-5 py-5">
        {(title || actionLabel) && (
          <View className="flex-row items-center justify-between gap-3">
            {title ? <Text className="text-lg font-semibold text-slate-900">{title}</Text> : <View />}
            {actionLabel && onPress ? (
              <Pressable onPress={onPress}><Text className="text-sm font-semibold text-sky-600">{actionLabel}</Text></Pressable>
            ) : null}
          </View>
        )}
        {children}
      </CardContent>
    </Card>
  )
}
