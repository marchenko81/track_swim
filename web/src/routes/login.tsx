import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Waves } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

const schema = z.object({
  email: z.string().min(1, 'Required').email('Invalid email'),
  password: z.string().min(1, 'Required'),
})
type FormData = z.infer<typeof schema>

function LoginPage() {
  const { user, isLoading, login } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  // Read invite token from URL search params
  const search = new URLSearchParams(window.location.search)
  const inviteToken = search.get('invite') ?? undefined

  // Don't use beforeLoad — use effect to avoid the isauthenticated-bypass gotcha
  useEffect(() => {
    if (isLoading) return
    if (user) {
      navigate({ to: user.onboarding_completed ? '/' : '/onboarding', replace: true })
    }
  }, [user, isLoading, navigate])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({ resolver: zodResolver(schema) })

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      const userData = await login(data.email, data.password, inviteToken)
      navigate({ to: userData.onboarding_completed ? '/' : '/onboarding', replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || 'Login failed. Please try again.'
        setServerError(msg)
      } else {
        setServerError('Login failed. Please try again.')
      }
    }
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Waves className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">SwimCoach</span>
          </div>
          <p className="text-sm text-muted-foreground">Train smarter. Swim faster.</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          <h1 className="mb-6 text-xl font-semibold text-foreground">{t('auth.sign_in')}</h1>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-sm font-medium text-foreground">
                {t('auth.email')}
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                autoComplete="email"
                {...register('email')}
                className="bg-background"
              />
              {errors.email && (
                <p className="text-xs text-destructive">{errors.email.message}</p>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="password" className="text-sm font-medium text-foreground">
                {t('auth.password')}
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                autoComplete="current-password"
                {...register('password')}
                className="bg-background"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('auth.sign_in')}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('auth.no_account')}{' '}
            <Link
              to="/register"
              search={inviteToken ? { invite: inviteToken } : undefined}
              className="font-medium text-primary hover:underline"
            >
              {t('auth.create_account')}
            </Link>
          </p>
        </div>

        <div className="mt-6 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  )
}
