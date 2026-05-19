import { formatDistanceToNowStrict, format, parseISO } from 'date-fns'

export function formatMeters(value?: number | null) {
  if (!value) return '—'
  return value >= 1000 ? `${(value / 1000).toFixed(1)} km` : `${value}m`
}

export function formatDuration(value?: number | null) {
  return value ? `${value} min` : '—'
}

export function formatPace(seconds?: number | null) {
  if (seconds == null) return '—'
  const mins = Math.floor(seconds / 60)
  const secs = Math.round(seconds % 60)
  return `${mins}:${String(secs).padStart(2, '0')}/100m`
}

export function formatRelative(dateString?: string | null) {
  if (!dateString) return '—'
  return formatDistanceToNowStrict(parseISO(dateString), { addSuffix: true })
}

export function formatShortDate(dateString?: string | null) {
  if (!dateString) return '—'
  return format(parseISO(dateString), 'MMM d')
}

export function getInitials(first?: string | null, last?: string | null) {
  return `${first?.[0] ?? ''}${last?.[0] ?? ''}`.trim() || 'S'
}

export function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'good_morning'
  if (hour < 18) return 'good_afternoon'
  return 'good_evening'
}
