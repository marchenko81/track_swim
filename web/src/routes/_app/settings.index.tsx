import { createFileRoute, Link } from '@tanstack/react-router'
import { useState, type ReactNode } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { LogOut, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { LanguageSwitcher } from '@/components/language-switcher'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { api, ApiError } from '@/lib/api'
import { toast } from 'sonner'

export const Route = createFileRoute('/_app/settings/')({
  component: SettingsPage,
})

function SettingsPage() {
  const { user, logout, refetchUser } = useAuth()
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const [firstName, setFirstName] = useState(user?.first_name ?? '')
  const [lastName, setLastName] = useState(user?.last_name ?? '')
  const [clubName, setClubName] = useState(user?.club_name ?? '')
  const [fitnessLevel, setFitnessLevel] = useState(user?.fitness_level ?? 'beginner')
  const [strokeSpecialty, setStrokeSpecialty] = useState(user?.stroke_specialty ?? 'none')
  const [savingProfile, setSavingProfile] = useState(false)

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [savingPw, setSavingPw] = useState(false)
  const [pwError, setPwError] = useState('')

  if (!user) return null

  const initials = `${user.first_name?.[0] ?? ''}${user.last_name?.[0] ?? ''}`.toUpperCase() || '?'
  const fitnessOptions = ['beginner', 'intermediate', 'advanced', 'elite']
  const strokeOptions = ['freestyle', 'backstroke', 'breaststroke', 'butterfly', 'im', 'none']

  const handleSaveProfile = async () => {
    setSavingProfile(true)
    try {
      const payload: Record<string, string> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
      }
      if (user.role === 'coach') {
        payload.club_name = clubName.trim()
      } else {
        payload.fitness_level = fitnessLevel
        payload.stroke_specialty = strokeSpecialty
        payload.club_name = clubName.trim()
      }
      await api.patch('/users/profile/', payload)
      await refetchUser()
      queryClient.invalidateQueries({ queryKey: ['auth', 'user'] })
      toast.success(t('profile.changes_saved'))
    } catch {
      toast.error(t('common.error'))
    } finally {
      setSavingProfile(false)
    }
  }

  const handleChangePassword = async () => {
    setPwError('')
    if (!currentPw || !newPw || !confirmPw) {
      setPwError('All fields are required.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError(t('auth.passwords_no_match'))
      return
    }
    if (newPw.length < 8) {
      setPwError(t('auth.password_min'))
      return
    }
    setSavingPw(true)
    try {
      await api.post('/users/auth/password/change/', {
        old_password: currentPw,
        new_password: newPw,
      })
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
      toast.success(t('profile.changes_saved'))
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? (err.data as any)?.error || t('common.error')
          : t('common.error')
      setPwError(msg)
    } finally {
      setSavingPw(false)
    }
  }

  return (
    <div className="px-4 pb-6 pt-6">
      <h1 className="mb-6 text-2xl font-bold tracking-tight text-foreground">{t('settings.settings')}</h1>

      <div className="mb-6 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-xl font-bold text-primary-foreground">
          {initials}
        </div>
        <div>
          <p className="font-medium text-foreground">{user.first_name} {user.last_name}</p>
          <p className="text-sm text-muted-foreground">{user.email}</p>
          <p className="mt-0.5 text-xs text-primary capitalize">{user.role}</p>
        </div>
      </div>

      <Section title={t('profile.personal_info')}>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('auth.first_name')}</Label>
            <Input name="first_name" value={firstName} onChange={(e) => setFirstName(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('auth.last_name')}</Label>
            <Input name="last_name" value={lastName} onChange={(e) => setLastName(e.target.value)} className="bg-background" />
          </div>
        </div>

        {user.role === 'coach' && (
          <div className="mt-3 space-y-1">
            <Label className="text-xs">{t('onboarding.club_name')}</Label>
            <Input name="club_name" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder={t('onboarding.optional_placeholder')} className="bg-background" />
          </div>
        )}

        {user.role === 'athlete' && (
          <>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">{t('onboarding.fitness_level')}</Label>
              <div className="flex flex-wrap gap-2">
                {fitnessOptions.map((opt) => (
                  <button key={opt} type="button" onClick={() => setFitnessLevel(opt)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all capitalize ${fitnessLevel === opt ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                    {t(`onboarding.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-1.5">
              <Label className="text-xs">{t('onboarding.stroke_specialty')}</Label>
              <div className="flex flex-wrap gap-2">
                {strokeOptions.map((opt) => (
                  <button key={opt} type="button" onClick={() => setStrokeSpecialty(opt)}
                    className={`rounded-lg border px-3 py-1 text-xs font-medium transition-all ${strokeSpecialty === opt ? 'border-primary bg-primary/15 text-primary' : 'border-border bg-background text-muted-foreground'}`}>
                    {opt === 'im' ? t('onboarding.individual_medley') : opt === 'none' ? t('onboarding.no_specialty') : t(`onboarding.${opt}`)}
                  </button>
                ))}
              </div>
            </div>
            <div className="mt-3 space-y-1">
              <Label className="text-xs">{t('onboarding.club_name')}</Label>
              <Input name="club_name" value={clubName} onChange={(e) => setClubName(e.target.value)} placeholder={t('onboarding.optional_placeholder')} className="bg-background" />
            </div>
          </>
        )}

        <Button className="mt-4 w-full" onClick={handleSaveProfile} disabled={savingProfile}>
          {savingProfile ? t('common.loading') : t('profile.save_changes')}
        </Button>
      </Section>

      <Section title={t('profile.change_password')}>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.current_password')}</Label>
            <Input name="current_password" type="password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.new_password')}</Label>
            <Input name="new_password" type="password" value={newPw} onChange={(e) => setNewPw(e.target.value)} className="bg-background" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs">{t('profile.confirm_new_password')}</Label>
            <Input name="confirm_new_password" type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} className="bg-background" />
          </div>
          {pwError && <p className="text-xs text-destructive">{pwError}</p>}
          <Button variant="outline" className="w-full" onClick={handleChangePassword} disabled={savingPw}>
            {savingPw ? t('common.loading') : t('profile.change_password')}
          </Button>
        </div>
      </Section>

      <Section title={t('settings.language')}>
        <LanguageSwitcher />
      </Section>

      {/* Connected Devices — links to /settings/devices */}
      <Link to="/settings/devices">
        <div className="mb-5 flex items-center justify-between rounded-2xl border border-border bg-card p-4">
          <div>
            <h2 className="text-sm font-semibold text-foreground">{t('strava.connected_devices')}</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">{t('strava.connect_description')}</p>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </Link>

      <Separator className="my-6" />

      <Button variant="ghost" className="w-full text-destructive hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
        <LogOut className="mr-2 h-4 w-4" />
        {t('settings.logout')}
      </Button>
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mb-5 rounded-2xl border border-border bg-card p-4">
      <h2 className="mb-3 text-sm font-semibold text-foreground">{title}</h2>
      {children}
    </div>
  )
}
