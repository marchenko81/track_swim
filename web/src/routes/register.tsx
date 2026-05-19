import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Waves, ClipboardList, Zap } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/register')({
  component: RegisterPage,
})

const schema = z
  .object({
    first_name: z.string().min(1, 'Required'),
    last_name: z.string().min(1, 'Required'),
    email: z.string().min(1, 'Required').email('Invalid email'),
    password: z.string().min(8, 'Minimum 8 characters'),
    confirm_password: z.string().min(1, 'Required'),
    role: z.enum(['coach', 'athlete']),
  })
  .refine((d) => d.password === d.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

type FormData = z.infer<typeof schema>

function RegisterPage() {
  const { user, isLoading, register: authRegister } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [serverError, setServerError] = useState('')
  const search = new URLSearchParams(window.location.search)
  const inviteToken = search.get('invite') ?? undefined

  useEffect(() => {
    if (isLoading) return
    if (user) {
      navigate({ to: user.onboarding_completed ? '/' : '/onboarding', replace: true })
    }
  }, [user, isLoading, navigate])

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: 'athlete' },
  })

  const selectedRole = watch('role')

  const onSubmit = async (data: FormData) => {
    setServerError('')
    try {
      await authRegister({
        email: data.email,
        password: data.password,
        first_name: data.first_name,
        last_name: data.last_name,
        role: data.role,
        invite_token: inviteToken,
      })
      navigate({ to: '/onboarding', replace: true })
    } catch (err) {
      if (err instanceof ApiError) {
        const msg = (err.data as any)?.error || 'Registration failed. Please try again.'
        setServerError(msg)
      } else {
        setServerError('Registration failed. Please try again.')
      }
    }
  }

  if (isLoading) return null

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4 py-8">
      <div className="w-full max-w-sm">
        {/* Logo */}
        <div className="mb-6 flex flex-col items-center gap-2">
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary">
              <Waves className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-bold tracking-tight text-foreground">SwimCoach</span>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-card p-6 shadow-xl">
          <h1 className="mb-2 text-xl font-semibold text-foreground">{t('auth.create_account')}</h1>
          <p className="mb-5 text-sm text-muted-foreground">{t('auth.choose_role')}</p>

          {/* Role selector */}
          <div className="mb-5 grid grid-cols-2 gap-3">
            {(
              [
                { value: 'coach', label: t('auth.role_coach'), icon: ClipboardList },
                { value: 'athlete', label: t('auth.role_athlete'), icon: Zap },
              ] as const
            ).map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => setValue('role', value)}
                className={cn(
                  'flex flex-col items-center gap-2 rounded-xl border-2 p-4 transition-all',
                  selectedRole === value
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-border bg-background text-muted-foreground hover:border-primary/50'
                )}
              >
                <Icon className="h-6 w-6" />
                <span className="text-sm font-medium">{label}</span>
              </button>
            ))}
          </div>
          {errors.role && <p className="mb-3 text-xs text-destructive">{errors.role.message}</p>}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-3" noValidate>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('auth.first_name')}</Label>
                <Input
                  placeholder="Alex"
                  autoComplete="given-name"
                  {...register('first_name')}
                  className="bg-background"
                />
                {errors.first_name && (
                  <p className="text-xs text-destructive">{errors.first_name.message}</p>
                )}
              </div>
              <div className="space-y-1">
                <Label className="text-xs font-medium">{t('auth.last_name')}</Label>
                <Input
                  placeholder="Smith"
                  autoComplete="family-name"
                  {...register('last_name')}
                  className="bg-background"
                />
                {errors.last_name && (
                  <p className="text-xs text-destructive">{errors.last_name.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('auth.email')}</Label>
              <Input
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

            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('auth.password')}</Label>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('password')}
                className="bg-background"
              />
              {errors.password && (
                <p className="text-xs text-destructive">{errors.password.message}</p>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-medium">{t('auth.confirm_password')}</Label>
              <Input
                type="password"
                placeholder="••••••••"
                autoComplete="new-password"
                {...register('confirm_password')}
                className="bg-background"
              />
              {errors.confirm_password && (
                <p className="text-xs text-destructive">{errors.confirm_password.message}</p>
              )}
            </div>

            {serverError && (
              <div className="rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {serverError}
              </div>
            )}

            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting ? t('common.loading') : t('auth.create_account')}
            </Button>
          </form>

          <p className="mt-4 text-center text-sm text-muted-foreground">
            {t('auth.already_have_account')}{' '}
            <Link
              to="/login"
              search={inviteToken ? { invite: inviteToken } : undefined}
              className="font-medium text-primary hover:underline"
            >
              {t('auth.sign_in')}
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
