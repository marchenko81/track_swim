import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { Waves, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { api, ApiError } from '@/lib/api'

export const Route = createFileRoute('/invite/$token')({
  component: InvitePage,
})

type InviteDetails = {
  coach_name: string
  club_name: string
  invite_email: string
}

function InvitePage() {
  const { token } = Route.useParams()
  const { user, isLoading: authLoading } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [accepted, setAccepted] = useState(false)

  const { data: invite, isLoading: inviteLoading, error: inviteError } = useQuery({
    queryKey: ['invite', token],
    queryFn: () => api.get<InviteDetails>(`/team/invite/${token}/`),
    retry: false,
  })

  const acceptMutation = useMutation({
    mutationFn: () => api.post<void>(`/team/invite/${token}/accept/`, {}),
    onSuccess: () => {
      setAccepted(true)
      setTimeout(() => navigate({ to: '/' }), 2000)
    },
  })

  if (inviteLoading || authLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (inviteError || !invite) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-destructive" />
          <h1 className="mb-2 text-xl font-semibold text-foreground">{t('invite.invitation_invalid')}</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            {inviteError instanceof ApiError && inviteError.status === 410
              ? 'This invitation has expired.'
              : t('invite.invitation_invalid')}
          </p>
          <Link to="/register">
            <Button variant="outline" className="w-full">Go to Register</Button>
          </Link>
        </div>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
        <div className="w-full max-w-sm text-center">
          <CheckCircle2 className="mx-auto mb-4 h-12 w-12 text-emerald-400" />
          <h1 className="mb-2 text-xl font-semibold text-foreground">{t('invite.accepted')}</h1>
          <p className="text-sm text-muted-foreground">Redirecting to your dashboard…</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Waves className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">SwimCoach</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 text-center shadow-xl">
          {/* Coach avatar */}
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-2xl font-bold text-primary">
            {invite.coach_name[0]?.toUpperCase() ?? '?'}
          </div>

          <h1 className="mb-1 text-lg font-semibold text-foreground">
            {t('invite.invited_by', { name: invite.coach_name })}
          </h1>
          {invite.club_name && (
            <p className="mb-4 text-sm text-muted-foreground">{invite.club_name}</p>
          )}

          {/* Auth state determines actions */}
          {!user ? (
            <div className="mt-5 space-y-3">
              <Link to="/register" search={{ invite: token }}>
                <Button className="w-full">
                  {t('invite.create_account_and_join')}
                </Button>
              </Link>
              <Link to="/login" search={{ invite: token }}>
                <Button variant="outline" className="w-full">
                  {t('invite.already_have_account_join')}
                </Button>
              </Link>
            </div>
          ) : user.role === 'coach' ? (
            <div className="mt-5 rounded-lg bg-destructive/10 p-3">
              <p className="text-sm text-destructive">{t('invite.invite_for_athletes')}</p>
            </div>
          ) : (
            <div className="mt-5">
              {acceptMutation.error && (
                <p className="mb-3 text-sm text-destructive">
                  {acceptMutation.error instanceof ApiError
                    ? (acceptMutation.error.data as any)?.error || 'Failed to accept.'
                    : 'Failed to accept.'}
                </p>
              )}
              <Button
                className="w-full"
                onClick={() => acceptMutation.mutate()}
                disabled={acceptMutation.isPending}
              >
                {acceptMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('invite.accepting')}
                  </>
                ) : (
                  t('invite.accept_invitation')
                )}
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
