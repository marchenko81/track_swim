import { Link, createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Users, Clock, Mail, Plus, Waves, CheckCircle2, Droplets, SkipForward, BarChart3 } from 'lucide-react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuth, type UserProfile } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { BottomNav } from '@/components/bottom-nav'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { api, ApiError } from '@/lib/api'
import { insightsApi, formatInsightRelativeTime } from '@/lib/insights-api'
import { plansApi, SET_TYPE_COLORS, SESSION_TYPE_COLORS, setLabel, formatDistance, type Session } from '@/lib/plans-api'
import { format } from 'date-fns'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function greeting(firstName: string, t: (k: string) => string) {
  const h = new Date().getHours()
  const key = h < 12 ? 'home.good_morning' : h < 18 ? 'home.good_afternoon' : 'home.good_evening'
  return `${t(key)}, ${firstName || 'Coach'}`
}

function initials(user: UserProfile) {
  return `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || '?'
}

// ─── Coach home ───────────────────────────────────────────────────────────────
function CoachHome({ user }: { user: UserProfile }) {
  const { t } = useLanguage()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')

  const { data: athletes = [], refetch: refetchAthletes } = useQuery({
    queryKey: ['team', 'athletes'],
    queryFn: () => api.get<{ id: string; status: string; invite_email: string | null; athlete_profile: { first_name: string; last_name: string; avatar_url: string | null } | null }[]>('/team/athletes/'),
  })

  const { data: digestData } = useQuery({
    queryKey: ['insights', 'coach-home-digest'],
    queryFn: () => insightsApi.list({ type: 'weekly_digest', limit: 1 }),
    staleTime: 0,
  })

  const total = athletes.length
  const active = athletes.filter((a) => a.status === 'active').length
  const pending = athletes.filter((a) => a.status === 'pending').length

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteStatus('sending')
    setInviteError('')
    try {
      await api.post('/team/invite/', { email: inviteEmail.trim().toLowerCase() })
      setInviteStatus('success')
      refetchAthletes()
      setTimeout(() => {
        setInviteOpen(false)
        setInviteEmail('')
        setInviteStatus('idle')
      }, 1800)
    } catch (err) {
      const msg = err instanceof ApiError ? (err.data as any)?.error || 'Failed to send invite.' : 'Failed to send invite.'
      setInviteError(msg)
      setInviteStatus('error')
    }
  }

  const statusColor: Record<string, string> = {
    active: 'bg-emerald-500/15 text-emerald-400',
    pending: 'bg-amber-500/15 text-amber-400',
    paused: 'bg-muted text-muted-foreground',
    removed: 'bg-destructive/15 text-destructive',
  }

  return (
    <div className="px-4 pb-6 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">SwimCoach</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting(user.first_name, t)}
          </h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initials(user)}
        </div>
      </div>

      {/* Stats */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        {[
          { label: t('home.total_athletes'), value: total, icon: Users },
          { label: t('home.active_this_week'), value: active, icon: CheckCircle2 },
          { label: t('home.pending_invites'), value: pending, icon: Clock },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-xl border border-border bg-card p-3 text-center">
            <Icon className="mx-auto mb-1 h-4 w-4 text-primary" />
            <p className="text-2xl font-bold text-foreground">{value}</p>
            <p className="text-[10px] text-muted-foreground leading-tight">{label}</p>
          </div>
        ))}
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('metrics.team_analytics')}</p>
            <p className="text-xs text-muted-foreground">{t('metrics.team_overview_copy')}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/metrics/team" search={{ range: '8w' }}>
              <BarChart3 className="mr-2 h-4 w-4" />
              {t('metrics.team_analytics')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Roster */}
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-base font-semibold text-foreground">{t('team.your_athletes')}</h2>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('team.invite_athlete')}
        </Button>
      </div>

      {athletes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
          <Waves className="mx-auto mb-3 h-10 w-10 text-primary/40" />
          <p className="mb-1 font-medium text-foreground">{t('team.no_athletes_yet')}</p>
          <p className="mb-4 text-sm text-muted-foreground">{t('team.invite_athlete_description')}</p>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1 h-4 w-4" />
            {t('team.invite_athlete')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {athletes.map((rel) => {
            const name = rel.athlete_profile
              ? `${rel.athlete_profile.first_name} ${rel.athlete_profile.last_name}`.trim()
              : rel.invite_email ?? '—'
            return (
              <div
                key={rel.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                  {name[0]?.toUpperCase() ?? '?'}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  {rel.invite_email && rel.status === 'pending' && (
                    <p className="truncate text-xs text-muted-foreground">{rel.invite_email}</p>
                  )}
                </div>
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColor[rel.status] ?? ''}`}>
                  {rel.status === 'active'
                    ? t('team.active_athlete')
                    : rel.status === 'pending'
                    ? t('team.pending_invite')
                    : rel.status === 'paused'
                    ? t('team.paused_athlete')
                    : rel.status}
                </span>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-6 rounded-2xl border border-border bg-card p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-foreground">{t('insights.coach_digest')}</p>
            <p className="text-xs text-muted-foreground">{digestData?.results?.[0]?.content?.slice(0, 90) ?? t('insights.generate_digest')}</p>
          </div>
          <Button variant="outline" asChild>
            <Link to="/insights/digest">{t('insights.view_full')}</Link>
          </Button>
        </div>
      </div>

      {/* Invite modal */}
      <Dialog open={inviteOpen} onOpenChange={(o) => { setInviteOpen(o); if (!o) { setInviteEmail(''); setInviteStatus('idle'); setInviteError(''); } }}>
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('team.invite_athlete')}</DialogTitle>
          </DialogHeader>

          {inviteStatus === 'success' ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="font-medium text-foreground">{t('team.invite_success')}</p>
              <p className="text-sm text-muted-foreground">{inviteEmail}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="invite-email">{t('auth.email')}</Label>
                <Input
                  id="invite-email"
                  name="invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('team.invite_email_placeholder')}
                  className="bg-background"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                />
              </div>
              {inviteError && (
                <p className="text-sm text-destructive">{inviteError}</p>
              )}
              <Button
                className="w-full"
                onClick={sendInvite}
                disabled={inviteStatus === 'sending' || !inviteEmail.trim()}
              >
                <Mail className="mr-2 h-4 w-4" />
                {inviteStatus === 'sending' ? t('common.loading') : t('team.send_invite')}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Today's Session (Athlete) ────────────────────────────────────────────────
function TodaySessionCard({ session, assignment }: {
  session: Session
  assignment: { plan_name: string; week_number: number; total_weeks: number; id: string }
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [logOpen, setLogOpen] = useState(false)
  const [skipOpen, setSkipOpen] = useState(false)
  const [rpe, setRpe] = useState('')
  const [notes, setNotes] = useState('')
  const today = format(new Date(), 'yyyy-MM-dd')

  const isAlreadyLogged = !!session.log_status

  const logMutation = useMutation({
    mutationFn: (status: 'completed' | 'skipped') =>
      plansApi.logWorkout({
        session_id: session.id,
        assignment_id: assignment.id,
        logged_date: today,
        status,
        perceived_effort_rpe: rpe ? Number(rpe) : undefined,
        athlete_notes: notes || undefined,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['today'] })
      queryClient.invalidateQueries({ queryKey: ['insights'] })
      setLogOpen(false)
      setSkipOpen(false)
      if (logMutation.variables === 'completed') {
        toast.success(t('workout.session_logged'))
      }
    },
  })

  const totalDist = session.sets.reduce(
    (acc, s) => acc + (s.repetitions || 0) * (s.distance_m || 0), 0
  )

  return (
    <div className="rounded-2xl border border-border bg-card overflow-hidden">
      {/* Session header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-border">
        <h3 className="font-bold text-foreground">{session.name}</h3>
        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${SESSION_TYPE_COLORS[session.session_type]}`}>
            {session.session_type.replace('_', ' ')}
          </span>
          <span>{t('session.week_of', { n: String(assignment.week_number), total: String(assignment.total_weeks) })}</span>
          {session.estimated_duration_min && (
            <span>{session.estimated_duration_min} min</span>
          )}
          {totalDist > 0 && <span>{formatDistance(totalDist)}</span>}
        </div>
      </div>

      {/* Coach notes */}
      {session.coach_notes && (
        <div className="border-b border-border bg-amber-500/5 px-4 py-2.5">
          <p className="text-xs font-semibold text-amber-400 mb-0.5">{t('session.coach_notes')}</p>
          <p className="text-xs text-muted-foreground">{session.coach_notes}</p>
        </div>
      )}

      {/* Sets list */}
      <div className="divide-y divide-border">
        {session.sets.map((s) => (
          <div
            key={s.id}
            className={`px-4 py-3 ${s.set_type === 'main' ? 'bg-blue-500/5' : ''}`}
          >
            <div className="flex items-start gap-2">
              <span className={`mt-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${SET_TYPE_COLORS[s.set_type]}`}>
                {s.set_type.replace('_', ' ').toUpperCase()}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">{setLabel(s)}</p>
                {s.equipment.length > 0 && (
                  <div className="mt-1 flex flex-wrap gap-1">
                    {s.equipment.map((eq) => (
                      <span key={eq} className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                        {eq.replace('_', ' ')}
                      </span>
                    ))}
                  </div>
                )}
                <div className="mt-1 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
                  {s.target_pace_per_100m && <span>⏱ {s.target_pace_per_100m}/100m</span>}
                  {s.target_hr_zone && <span>❤ Z{s.target_hr_zone}</span>}
                  {s.intensity_rpe && <span>RPE {s.intensity_rpe}</span>}
                  {s.send_off_interval && <span>→ {s.send_off_interval}</span>}
                  {s.rest_seconds && <span>rest {s.rest_seconds}s</span>}
                </div>
                {s.description && (
                  <p className="mt-1 text-[11px] italic text-muted-foreground">{s.description}</p>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Action bar */}
      <div className="sticky bottom-20 border-t border-border bg-card p-3 flex gap-2">
        {isAlreadyLogged ? (
          <div className="flex-1 rounded-xl bg-emerald-500/10 py-2.5 text-center text-sm font-semibold text-emerald-400">
            <CheckCircle2 className="inline mr-1.5 h-4 w-4" />
            {session.log_status === 'completed' ? t('workout.completed') : t('workout.skipped')}
          </div>
        ) : (
          <>
            <Button
              className="flex-1 bg-emerald-600 text-white hover:bg-emerald-700 h-11 text-sm font-semibold"
              onClick={() => setLogOpen(true)}
            >
              <CheckCircle2 className="mr-1.5 h-4 w-4" />
              {t('session.mark_done')}
            </Button>
            <Button
              variant="outline"
              className="h-11 px-4 text-sm"
              onClick={() => setSkipOpen(true)}
            >
              <SkipForward className="h-4 w-4" />
            </Button>
          </>
        )}
      </div>

      {/* Done dialog */}
      <Dialog open={logOpen} onOpenChange={setLogOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('session.how_did_it_feel')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label>RPE (1–10)</Label>
              <Select value={rpe} onValueChange={setRpe}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select effort level" />
                </SelectTrigger>
                <SelectContent>
                  {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                    <SelectItem key={n} value={String(n)}>
                      {n} — {n <= 3 ? '😌 Easy' : n <= 6 ? '😤 Moderate' : n <= 8 ? '😰 Hard' : '🥵 Max'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('session.notes')} ({t('common.optional')})</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="How did it go?"
              />
            </div>
            <Button
              className="w-full"
              disabled={logMutation.isPending}
              onClick={() => logMutation.mutate('completed')}
            >
              {logMutation.isPending ? t('common.loading') : t('session.log_session')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Skip dialog */}
      <Dialog open={skipOpen} onOpenChange={setSkipOpen}>
        <DialogContent className="max-w-[95vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('session.skip_session')}?</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 pt-2">
            <Button variant="outline" className="flex-1" onClick={() => setSkipOpen(false)}>
              {t('common.cancel')}
            </Button>
            <Button
              variant="destructive"
              className="flex-1"
              disabled={logMutation.isPending}
              onClick={() => logMutation.mutate('skipped')}
            >
              {t('session.skip_session')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ─── Athlete home ─────────────────────────────────────────────────────────────
function AthleteHome({ user }: { user: UserProfile }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: coachData } = useQuery({
    queryKey: ['team', 'coach'],
    queryFn: () => api.get<{ coaches: { id: string; coach_name: string; club_name: string; avatar_url: string | null }[] }>('/team/coach/'),
    networkMode: 'always',
  })

  const { data: todayData } = useQuery({
    queryKey: ['today'],
    queryFn: () => plansApi.getToday(),
    networkMode: 'always',
  })

  const { data: unreadInsightData } = useQuery({
    queryKey: ['insights', 'home-banner'],
    queryFn: () => insightsApi.list({ unread: true, limit: 1 }),
    refetchInterval: (query) => (query.state.data?.results?.length ? false : 10000),
    staleTime: 0,
  })

  const coaches = coachData?.coaches ?? []
  const unreadInsight = unreadInsightData?.results?.[0]

  const dismissInsight = async (id: string) => {
    await insightsApi.detail(id)
    queryClient.invalidateQueries({ queryKey: ['insights'] })
  }

  return (
    <div className="px-4 pb-6 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <p className="text-xs font-medium uppercase tracking-widest text-primary">SwimCoach</p>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {greeting(user.first_name, t)}
          </h1>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
          {initials(user)}
        </div>
      </div>

      {/* Coach section */}
      <div className="mb-5">
        <h2 className="mb-2 text-base font-semibold text-foreground">{t('home.your_coach')}</h2>
        {coaches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-primary/30 bg-primary/5 px-4 py-4">
            <p className="text-sm text-muted-foreground">{t('home.waiting_for_coach')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {coaches.map((c) => (
              <div key={c.id} className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                  {c.coach_name[0]?.toUpperCase() ?? '?'}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{c.coach_name}</p>
                  {c.club_name && (
                    <p className="text-xs text-muted-foreground">{c.club_name}</p>
                  )}
                </div>
                <Badge variant="outline" className="ml-auto text-xs text-emerald-400 border-emerald-400/30">
                  Active
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Today's session */}
      <div>
        {unreadInsight && (
          <div className="mb-4 rounded-2xl border border-primary/20 bg-primary/5 p-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">✨</div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{t('insights.insight_ready')}</p>
                    <p className="text-xs text-muted-foreground">{formatInsightRelativeTime(unreadInsight.created_at, t('insights.just_now'))}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-10 w-10" onClick={() => dismissInsight(unreadInsight.id)}>
                    ×
                  </Button>
                </div>
                <p className="mt-2 text-sm text-muted-foreground">{unreadInsight.preview}...</p>
                <Button variant="link" className="mt-1 h-auto px-0" asChild>
                  <Link to="/insights/$id" params={{ id: unreadInsight.id }}>{t('insights.view_full')} →</Link>
                </Button>
              </div>
            </div>
          </div>
        )}
        <h2 className="mb-3 text-base font-semibold text-foreground">{t('home.today_session')}</h2>

        {!todayData ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center">
            <Waves className="mx-auto mb-2 h-8 w-8 text-primary/30" />
            <p className="text-sm text-muted-foreground">{t('home.no_session_yet')}</p>
          </div>
        ) : !todayData.assignment ? (
          <div className="rounded-xl border border-dashed border-border bg-card px-4 py-6 text-center">
            <Droplets className="mx-auto mb-2 h-8 w-8 text-primary/30" />
            <p className="text-sm text-muted-foreground">{t('plan.no_plan_yet')}</p>
          </div>
        ) : todayData.plan_completed ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-6 text-center">
            <CheckCircle2 className="mx-auto mb-2 h-8 w-8 text-emerald-400" />
            <p className="font-semibold text-emerald-400">{t('plan.plan_completed')}</p>
            <p className="mt-1 text-sm text-muted-foreground">{todayData.assignment.plan_name}</p>
          </div>
        ) : !todayData.session ? (
          <div className="rounded-xl border border-border bg-card px-4 py-5">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-500/10 text-blue-400">
                <Waves className="h-5 w-5" />
              </div>
              <div>
                <p className="font-medium text-foreground">{t('session.rest_today')}</p>
                <p className="text-xs text-muted-foreground">
                  {t('session.week_of', { n: String(todayData.assignment.week_number), total: String(todayData.assignment.total_weeks) })} · {todayData.assignment.plan_name}
                </p>
              </div>
            </div>
          </div>
        ) : (
          <TodaySessionCard
            session={todayData.session}
            assignment={todayData.assignment}
          />
        )}
      </div>
    </div>
  )
}

// ─── Home page (auth-guarded) ─────────────────────────────────────────────────
function HomePage() {
  const { user, isLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate({ to: '/login', replace: true })
    } else if (!user.onboarding_completed) {
      navigate({ to: '/onboarding', replace: true })
    }
  }, [user, isLoading, navigate])

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-background">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  if (!user || !user.onboarding_completed) return null

  return (
    <div className="bg-background">
      {user.role === 'coach' ? <CoachHome user={user} /> : <AthleteHome user={user} />}
      <BottomNav role={user.role} />
    </div>
  )
}
