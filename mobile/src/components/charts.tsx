import Svg, { Circle, Polyline } from 'react-native-svg'
import { Pressable, View } from 'react-native'
import { Text } from '@/components/ui/text'

export function SimpleLineChart({ values }: { values: Array<number | null | undefined> }) {
  const clean = values.map((value, index) => ({ value: value ?? 0, index }))
  const max = Math.max(...clean.map((item) => item.value), 1)
  const min = Math.min(...clean.map((item) => item.value), 0)
  const width = 300
  const height = 140
  const points = clean.map(({ value, index }) => `${(index / Math.max(clean.length - 1, 1)) * width},${height - ((value - min) / Math.max(max - min, 1)) * (height - 20) - 10}`).join(' ')
  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Polyline points={points} fill="none" stroke="#0ea5e9" strokeWidth="3" />
      {clean.map(({ value, index }) => (
        <Circle key={index} cx={(index / Math.max(clean.length - 1, 1)) * width} cy={height - ((value - min) / Math.max(max - min, 1)) * (height - 20) - 10} r="4" fill="#ffffff" stroke="#0ea5e9" strokeWidth="2" />
      ))}
    </Svg>
  )
}

export function Heatmap({ items, selected, onSelect }: { items: Array<{ date: string; count: number }>; selected?: string; onSelect: (date: string) => void }) {
  return (
    <View className="flex-row flex-wrap gap-1">
      {items.map((item) => {
        const opacity = item.count === 0 ? 0.15 : Math.min(0.25 + item.count * 0.18, 1)
        return (
          <Pressable key={item.date} onPress={() => onSelect(item.date)}>
            <View style={{ width: 10, height: 10, borderRadius: 2, backgroundColor: `rgba(14,165,233,${opacity})` }} />
          </Pressable>
        )
      })}
      {selected ? <Text className="mt-2 w-full text-xs text-slate-500">{selected}</Text> : null}
    </View>
  )
}
