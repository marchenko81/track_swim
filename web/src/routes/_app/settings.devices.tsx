import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useRef, useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, CheckCircle2, AlertCircle, Clock, RefreshCw,
  Loader2, Activity, ChevronRight,
} from 'lucide-react'
import { api, ApiError } from '@/lib/api'
import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { toast } from 'sonner'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'

export const Route = createFileRoute('/_app/settings/devices')({
  component: ConnectedDevicesPage,
})

const STRAVA_ORANGE = '#fc4c02'

interface StravaStatus {
  connected: boolean
  strava_athlete_id?: number
  last_synced_at?: string
  sync_status?: 'idle' | 'syncing' | 'error'
  last_error?: string | null
  activity_count?: number
}

interface StravaActivity {
  id: string
  strava_activity_id: number | null
  logged_date: string
  actual_distance_m: number | null
  actual_duration_min: number | null
  pool_length_m: number | null
  avg_hr_bpm: number | null
  swolf_avg: number | null
  session_name: string | null
  is_matched: boolean
  source: string
}

function formatRelativeTime(isoString: string): string {
  const diff = Date.now() - new Date(isoString).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  return `${Math.floor(hours / 24)}d ago`
}

function formatDuration(min: number | null): string {
  if (!min) return ''
  if (min < 60) return `${min} min`
  return `${Math.floor(min / 60)}h ${min % 60}m`
}

function formatDistance(m: number | null): string {
  if (!m) return ''
  return m >= 1000 ? `${(m / 1000).toFixed(1)}km` : `${m}m`
}

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${String(s).padStart(2, '0')}`
}

function ConnectedDevicesPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [cooldownSecs, setCooldownSecs] = useState(0)
  const [autoSync, setAutoSync] = useState(true)
  const [matchToPlan, setMatchToPlan] = useState(true)
  const popupRef = useRef<Window | null>(null)

  const { data: status, refetch: refetchStatus } = useQuery<StravaStatus>({
    queryKey: ['strava', 'status'],
    queryFn: () => api.get<StravaStatus>('/strava/status/'),
    staleTime: 30_000,
    networkMode: 'always',
  })

  const { data: activitiesData } = useQuery<{ results: StravaActivity[]; count: number }>({
    queryKey: ['strava', 'activities'],
    queryFn: () => api.get<{ results: StravaActivity[]; count: number }>('/strava/activities/?page_size=8'),
    enabled: status?.connected === true,
    staleTime: 60_000,
    networkMode: 'always',
  })

  // Countdown timer for sync cooldown
  useEffect(() => {
    if (cooldownSecs <= 0) return
    const timer = setInterval(() => setCooldownSecs((s) => Math.max(0, s - 1)), 1000)
    return () => clearInterval(timer)
  }, [cooldownSecs])

  // Listen for OAuth popup messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'strava_connected') {
        refetchStatus()
        queryClient.invalidateQueries({ queryKey: ['strava'] })
        queryClient.invalidateQueries({ queryKey: ['metrics'] })
        queryClient.invalidateQueries({ queryKey: ['metrics', 'team'] })
        toast.success(t('strava.connected'))
      } else if (e.data?.type === 'strava_error') {
        toast.error(e.data.message || t('strava.sync_error'))
      }
    }
    window.addEventListener('message', handler)
    return () => window.removeEventListener('message', handler)
  }, [refetchStatus, queryClient, t])

  // Re-fetch on tab focus (handles popup-closed scenario)
  useEffect(() => {
    const handler = () => {
      if (document.visibilityState === 'visible') {
        refetchStatus()
      }
    }
    document.addEventListener('visibilitychange', handler)
    return () => document.removeEventListener('visibilitychange', handler)
  }, [refetchStatus])

  const syncMutation = useMutation({
    mutationFn: () => api.post('/strava/sync/', {}),
    onSuccess: () => {
      setCooldownSecs(900)
      queryClient.invalidateQueries({ queryKey: ['strava', 'status'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['metrics', 'team'] })
      toast.success(t('strava.syncing'))
    },
    onError: (err) => {
      if (err instanceof ApiError && err.status === 429) {
        const secs = (err.data as any)?.seconds_remaining ?? 900
        setCooldownSecs(secs)
      } else {
        toast.error(t('strava.sync_error'))
      }
    },
  })

  const disconnectMutation = useMutation({
    mutationFn: () => api.delete('/strava/disconnect/'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['strava'] })
      queryClient.invalidateQueries({ queryKey: ['metrics'] })
      queryClient.invalidateQueries({ queryKey: ['metrics', 'team'] })
      toast.success(t('strava.disconnected_success'))
    },
    onError: () => toast.error(t('common.error')),
  })

  const handleConnect = async () => {
    try {
      const { auth_url } = await api.get<{ auth_url: string }>('/strava/auth-url/')
      popupRef.current = window.open(auth_url, 'strava_oauth', 'width=600,height=700,menubar=no,toolbar=no')
    } catch (err) {
      if (err instanceof ApiError && err.status === 503) {
        toast.error('Strava integration not configured')
      } else {
        toast.error(t('strava.sync_error'))
      }
    }
  }

  const isAthlete = user?.role === 'athlete'

  return (
    <div className="bg-background">
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b border-border bg-background/95 px-4 py-3 backdrop-blur">
        <button onClick={() => navigate({ to: '/settings' })} className="rounded-full p-1 text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <h1 className="text-base font-semibold text-foreground">{t('strava.connected_devices')}</h1>
      </div>

      <div className="px-4 pb-10 pt-4 space-y-4">

        {/* Strava Card */}
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          {/* Card header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl" style={{ background: STRAVA_ORANGE }}>
              <Activity className="h-5 w-5 text-white" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-foreground">Strava</p>
              {status?.connected && (
                <p className="text-xs text-muted-foreground">
                  {t('strava.last_synced')}: {status.last_synced_at ? formatRelativeTime(status.last_synced_at) : '—'}
                </p>
              )}
            </div>
            {status?.connected ? (
              <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {t('strava.connected')}
              </Badge>
            ) : null}
          </div>

          <div className="px-4 py-4">
            {!status?.connected ? (
              /* Disconnected state */
              <div className="space-y-4">
                <p className="text-sm text-muted-foreground">{t('strava.connect_description')}</p>
                <div className="rounded-xl bg-muted/40 p-3 space-y-1.5">
                  <p className="text-xs font-medium text-muted-foreground">{t('strava.what_gets_synced')}</p>
                  {['Swim sessions & lap data', 'SWOLF score', 'Heart rate', 'Pace & stroke count'].map((item) => (
                    <div key={item} className="flex items-center gap-2 text-xs text-muted-foreground">
                      <div className="h-1 w-1 rounded-full bg-primary" />
                      {item}
                    </div>
                  ))}
                </div>
                {isAthlete ? (
                  <button
                    onClick={handleConnect}
                    className="w-full rounded-xl py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90 active:opacity-80"
                    style={{ background: STRAVA_ORANGE }}
                  >
                    {t('strava.connect')}
                  </button>
                ) : (
                  <p className="text-center text-xs text-muted-foreground">Only athletes can connect Strava</p>
                )}
              </div>
            ) : (
              /* Connected state */
              <div className="space-y-4">
                {/* Athlete info */}
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Strava Athlete #{status.strava_athlete_id}</span>
                  {status.sync_status === 'syncing' ? (
                    <Badge className="bg-blue-500/15 text-blue-600 border-blue-500/30">
                      <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                      {t('strava.syncing')}
                    </Badge>
                  ) : status.sync_status === 'error' ? (
                    <Badge variant="destructive" className="bg-destructive/15 text-destructive border-destructive/30">
                      <AlertCircle className="mr-1 h-3 w-3" />
                      Error
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-muted-foreground">
                      <Clock className="mr-1 h-3 w-3" />
                      Idle
                    </Badge>
                  )}
                </div>

                {/* Activity count */}
                <p className="text-xs text-muted-foreground">
                  {t('strava.activity_count', { count: status.activity_count ?? 0 })}
                </p>

                {/* Sync now button */}
                <Button
                  variant="outline"
                  className="w-full border-[#fc4c02] text-[#fc4c02] hover:bg-[#fc4c02]/10"
                  onClick={() => syncMutation.mutate()}
                  disabled={syncMutation.isPending || cooldownSecs > 0}
                >
                  {syncMutation.isPending ? (
                    <><Loader2 className="mr-2 h-4 w-4 animate-spin" />{t('strava.syncing')}</>
                  ) : cooldownSecs > 0 ? (
                    <><Clock className="mr-2 h-4 w-4" />{t('strava.sync_cooldown')} {formatCountdown(cooldownSecs)}</>
                  ) : (
                    <><RefreshCw className="mr-2 h-4 w-4" />{t('strava.sync_now')}</>
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        {status?.connected && activitiesData && activitiesData.results.length > 0 && (
          <div className="rounded-2xl border border-border bg-card overflow-hidden">
            <div className="border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-foreground">{t('strava.recent_activities')}</h2>
            </div>
            <div className="divide-y divide-border">
              {activitiesData.results.map((activity) => (
                <Link key={activity.id} to="/activities/$workoutLogId" params={{ workoutLogId: activity.id }}>
                  <div className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-base">
                      🏊
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-foreground">
                          {new Date(activity.logged_date).toLocaleDateString()}
                        </span>
                        {activity.is_matched ? (
                          <Badge className="h-4 px-1.5 text-[10px] bg-emerald-500/15 text-emerald-600 border-emerald-500/30">
                            ✓ {t('strava.matched_to_plan')}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="h-4 px-1.5 text-[10px] text-muted-foreground">
                            {t('strava.unplanned')}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-xs text-muted-foreground">{formatDistance(activity.actual_distance_m)}</span>
                        {activity.actual_duration_min && (
                          <><span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs text-muted-foreground">{formatDuration(activity.actual_duration_min)}</span></>
                        )}
                        {activity.swolf_avg && (
                          <><span className="text-xs text-muted-foreground">·</span>
                          <span className="text-xs font-medium text-primary">SWOLF {activity.swolf_avg.toFixed(1)}</span></>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sync Settings */}
        {status?.connected && (
          <div className="rounded-2xl border border-border bg-card px-4 py-4 space-y-4">
            <h2 className="text-sm font-semibold text-foreground">Sync Settings</h2>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">{t('strava.auto_sync')}</p>
              </div>
              <Switch checked={autoSync} onCheckedChange={setAutoSync} />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-foreground">{t('strava.match_to_plan')}</p>
              </div>
              <Switch checked={matchToPlan} onCheckedChange={setMatchToPlan} />
            </div>
          </div>
        )}

        {/* Coming Soon */}
        <div className="rounded-2xl border border-border bg-card divide-y divide-border overflow-hidden">
          {[
            { name: 'Garmin Connect', icon: '⌚' },
            { name: 'Apple Health', icon: '🍎' },
          ].map((device) => (
            <div key={device.name} className="flex items-center gap-3 px-4 py-3 opacity-60">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-muted text-base">
                {device.icon}
              </div>
              <p className="flex-1 text-sm font-medium text-foreground">{device.name}</p>
              <Badge variant="outline" className="text-xs text-muted-foreground">
                {t('strava.coming_soon')}
              </Badge>
            </div>
          ))}
        </div>

        {/* Disconnect */}
        {status?.connected && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="w-full border-destructive/50 text-destructive hover:bg-destructive/10">
                {t('strava.disconnect')}
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t('strava.disconnect')}</AlertDialogTitle>
                <AlertDialogDescription>{t('strava.disconnect_confirm')}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>{t('common.cancel')}</AlertDialogCancel>
                <AlertDialogAction
                  onClick={() => disconnectMutation.mutate()}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  {disconnectMutation.isPending ? t('common.loading') : t('common.confirm')}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>
    </div>
  )
}
