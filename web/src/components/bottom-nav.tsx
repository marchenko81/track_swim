import { Link, useRouterState } from '@tanstack/react-router'
import { useQuery } from '@tanstack/react-query'
import { LayoutDashboard, Users, Calendar, Settings, BarChart2, Sparkles } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { useLanguage } from '@/contexts/language-context'
import { insightsApi } from '@/lib/insights-api'

type Role = 'coach' | 'athlete' | ''

interface BottomNavProps {
  role: Role
}

const coachItems = [
  { to: '/', label: 'nav.home', icon: LayoutDashboard },
  { to: '/team', label: 'nav.team', icon: Users },
  { to: '/plans', label: 'nav.plans', icon: Calendar },
  { to: '/metrics/team', label: 'metrics.team_analytics', icon: BarChart2 },
  { to: '/insights', label: 'nav.insights', icon: Sparkles },
  { to: '/settings', label: 'nav.settings', icon: Settings },
] as const

const athleteItems = [
  { to: '/', label: 'nav.home', icon: LayoutDashboard },
  { to: '/plan', label: 'nav.plan', icon: Calendar },
  { to: '/metrics', label: 'nav.metrics', icon: BarChart2 },
  { to: '/insights', label: 'nav.insights', icon: Sparkles },
  { to: '/settings', label: 'nav.settings', icon: Settings },
] as const

export function BottomNav({ role }: BottomNavProps) {
  const { t } = useLanguage()
  const { location } = useRouterState()
  const items = role === 'coach' ? coachItems : athleteItems
  const { data } = useQuery({
    queryKey: ['insights', 'unread-count', role],
    queryFn: () => insightsApi.unreadCount(),
    refetchInterval: 30000,
  })
  const unreadCount = data?.count ?? 0

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm">
      <div className="flex items-stretch">
        {items.map(({ to, label, icon: Icon }) => {
          const isActive = to === '/metrics/team'
            ? location.pathname.startsWith('/metrics')
            : to === '/'
              ? location.pathname === '/'
              : location.pathname.startsWith(to)
          const showBadge = to === '/insights' && unreadCount > 0
          return (
            <Link
              key={to}
              to={to}
              className="relative flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 transition-colors"
            >
              <Icon
                className={`h-5 w-5 transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              />
              {showBadge && (
                <Badge className="absolute right-[16%] top-1 h-5 min-w-5 rounded-full px-1.5 text-[10px]">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </Badge>
              )}
              <span
                className={`text-[10px] font-medium transition-colors ${
                  isActive ? 'text-primary' : 'text-muted-foreground'
                }`}
              >
                {t(label)}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
