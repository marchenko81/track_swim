import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Mail, MoreVertical, CheckCircle2, Loader2 } from 'lucide-react'
import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { api, ApiError } from '@/lib/api'

export const Route = createFileRoute('/_app/team')({
  component: TeamPage,
})

type Relationship = {
  id: string
  status: string
  invite_email: string | null
  invited_at: string | null
  accepted_at: string | null
  athlete_profile: {
    id: number
    first_name: string
    last_name: string
    email: string
    avatar_url: string | null
    fitness_level: string
    stroke_specialty: string
  } | null
}

const statusColors: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/20',
  pending: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
  paused: 'bg-muted/50 text-muted-foreground border-border',
  removed: 'bg-destructive/15 text-destructive border-destructive/20',
}

function TeamPage() {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [inviteOpen, setInviteOpen] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteStatus, setInviteStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle')
  const [inviteError, setInviteError] = useState('')

  const { data: athletes = [], isLoading } = useQuery({
    queryKey: ['team', 'athletes'],
    queryFn: () => api.get<Relationship[]>('/team/athletes/'),
    staleTime: 0,
  })

  const updateMutation = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      api.patch(`/team/athletes/${id}/`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['team', 'athletes'] })
    },
  })

  const sendInvite = async () => {
    if (!inviteEmail.trim()) return
    setInviteStatus('sending')
    setInviteError('')
    try {
      await api.post('/team/invite/', { email: inviteEmail.trim().toLowerCase() })
      setInviteStatus('success')
      queryClient.invalidateQueries({ queryKey: ['team', 'athletes'] })
      setTimeout(() => {
        setInviteOpen(false)
        setInviteEmail('')
        setInviteStatus('idle')
      }, 1800)
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as any)?.error || 'Failed to send invite.'
          : 'Failed to send invite.'
      setInviteError(msg)
      setInviteStatus('error')
    }
  }

  const getName = (rel: Relationship) => {
    if (rel.athlete_profile) {
      return `${rel.athlete_profile.first_name} ${rel.athlete_profile.last_name}`.trim()
    }
    return rel.invite_email ?? '—'
  }

  const active = athletes.filter((a) => a.status === 'active').length
  const pending = athletes.filter((a) => a.status === 'pending').length

  return (
    <div className="px-4 pb-6 pt-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">{t('team.team_overview')}</h1>
          {athletes.length > 0 && (
            <p className="text-sm text-muted-foreground">
              {active} {t('team.active_athlete').toLowerCase()} · {pending} {t('team.pending_invite').toLowerCase()}
            </p>
          )}
        </div>
        <Button size="sm" onClick={() => setInviteOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('team.invite_athlete')}
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : athletes.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border bg-card p-10 text-center">
          <p className="mb-1 font-medium text-foreground">{t('team.no_athletes_yet')}</p>
          <p className="mb-5 text-sm text-muted-foreground">{t('team.invite_athlete_description')}</p>
          <Button onClick={() => setInviteOpen(true)}>
            <Plus className="mr-1.5 h-4 w-4" />
            {t('team.invite_athlete')}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {athletes.map((rel) => {
            const name = getName(rel)
            const canPause = rel.status === 'active'
            const canResume = rel.status === 'paused'
            const canRemove = rel.status !== 'removed'
            return (
              <div
                key={rel.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3"
              >
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                  {name[0]?.toUpperCase() ?? '?'}
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{name}</p>
                  {rel.athlete_profile && (
                    <p className="truncate text-xs text-muted-foreground">
                      {rel.athlete_profile.email}
                    </p>
                  )}
                  {rel.status === 'pending' && rel.invite_email && (
                    <p className="truncate text-xs text-muted-foreground">{rel.invite_email}</p>
                  )}
                </div>

                <span
                  className={`rounded-full border px-2 py-0.5 text-xs font-medium ${statusColors[rel.status] ?? ''}`}
                >
                  {t(
                    rel.status === 'active'
                      ? 'team.active_athlete'
                      : rel.status === 'pending'
                      ? 'team.pending_invite'
                      : rel.status === 'paused'
                      ? 'team.paused_athlete'
                      : 'team.remove_athlete'
                  )}
                </span>

                {(canPause || canResume || canRemove) && (
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" aria-label="Athlete options">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {canPause && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: rel.id, status: 'paused' })}
                        >
                          {t('team.pause_athlete')}
                        </DropdownMenuItem>
                      )}
                      {canResume && (
                        <DropdownMenuItem
                          onClick={() => updateMutation.mutate({ id: rel.id, status: 'active' })}
                        >
                          {t('team.resume_athlete')}
                        </DropdownMenuItem>
                      )}
                      {canRemove && (
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          onClick={() => updateMutation.mutate({ id: rel.id, status: 'removed' })}
                        >
                          {t('team.remove_athlete')}
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Invite dialog */}
      <Dialog
        open={inviteOpen}
        onOpenChange={(o) => {
          setInviteOpen(o)
          if (!o) {
            setInviteEmail('')
            setInviteStatus('idle')
            setInviteError('')
          }
        }}
      >
        <DialogContent className="max-w-[90vw] sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('team.invite_athlete')}</DialogTitle>
          </DialogHeader>

          {inviteStatus === 'success' ? (
            <div className="flex flex-col items-center gap-2 py-4 text-center">
              <CheckCircle2 className="h-10 w-10 text-emerald-400" />
              <p className="font-medium">{t('team.invite_success')}</p>
              <p className="text-sm text-muted-foreground">{inviteEmail}</p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="team-invite-email">{t('auth.email')}</Label>
                <Input
                  id="team-invite-email"
                  name="team-invite-email"
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder={t('team.invite_email_placeholder')}
                  className="bg-background"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); sendInvite(); } }}
                />
              </div>
              {inviteError && <p className="text-sm text-destructive">{inviteError}</p>}
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
