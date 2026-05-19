import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Waves, ChevronRight } from 'lucide-react'
import { useAuth } from '@/contexts/auth-context'
import { useLanguage } from '@/contexts/language-context'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { DatePicker } from '@/components/date-picker'
import { api, ApiError } from '@/lib/api'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/onboarding')({
  component: OnboardingPage,
})

type RadioOption = { value: string; label: string }

function RadioGroup({
  label,
  options,
  value,
  onChange,
}: {
  label: string
  options: RadioOption[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div className="space-y-2">
      <Label className="text-sm font-medium text-foreground">{label}</Label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-all',
              value === opt.value
                ? 'border-primary bg-primary/15 text-primary'
                : 'border-border bg-background text-muted-foreground hover:border-primary/40'
            )}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
}

function OnboardingPage() {
  const { user, isLoading, refetchUser } = useAuth()
  const { t } = useLanguage()
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Coach fields
  const [clubName, setClubName] = useState('')
  const [sport, setSport] = useState('swimming')

  // Athlete step 1
  const [dob, setDob] = useState<string | undefined>()
  const [fitnessLevel, setFitnessLevel] = useState('beginner')

  // Athlete step 2
  const [strokeSpecialty, setStrokeSpecialty] = useState('none')
  const [athleteClub, setAthleteClub] = useState('')

  useEffect(() => {
    if (isLoading) return
    if (!user) {
      navigate({ to: '/login', replace: true })
      return
    }
    if (user.onboarding_completed) {
      navigate({ to: '/', replace: true })
    }
  }, [user, isLoading, navigate])

  if (isLoading || !user) return null

  const isCoach = user.role === 'coach'
  const totalSteps = 2

  const sportOptions = [
    { value: 'swimming', label: t('onboarding.swimming') },
    { value: 'triathlon', label: t('onboarding.triathlon') },
    { value: 'open_water', label: t('onboarding.open_water') },
  ]

  const fitnessOptions = [
    { value: 'beginner', label: t('onboarding.beginner') },
    { value: 'intermediate', label: t('onboarding.intermediate') },
    { value: 'advanced', label: t('onboarding.advanced') },
    { value: 'elite', label: t('onboarding.elite') },
  ]

  const strokeOptions = [
    { value: 'freestyle', label: t('onboarding.freestyle') },
    { value: 'backstroke', label: t('onboarding.backstroke') },
    { value: 'breaststroke', label: t('onboarding.breaststroke') },
    { value: 'butterfly', label: t('onboarding.butterfly') },
    { value: 'im', label: t('onboarding.individual_medley') },
    { value: 'none', label: t('onboarding.no_specialty') },
  ]

  const handleFinish = async () => {
    setSaving(true)
    setError('')
    try {
      const payload: Record<string, unknown> = { onboarding_completed: true }
      if (isCoach) {
        if (clubName.trim()) payload.club_name = clubName.trim()
        payload.sport = sport
      } else {
        if (dob) payload.date_of_birth = dob
        payload.fitness_level = fitnessLevel
        payload.stroke_specialty = strokeSpecialty
        if (athleteClub.trim()) payload.club_name = athleteClub.trim()
      }
      await api.patch('/users/profile/', payload)
      await refetchUser()
      navigate({ to: '/', replace: true })
    } catch (err) {
      setError(err instanceof ApiError ? JSON.stringify(err.data) : 'Failed to save. Try again.')
      setSaving(false)
    }
  }

  const handleNext = () => setStep((s) => s + 1)

  return (
    <div className="flex min-h-dvh flex-col bg-background px-4 py-8">
      <div className="mx-auto w-full max-w-sm flex-1">
        {/* Header */}
        <div className="mb-8 flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary">
            <Waves className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight">SwimCoach</span>
        </div>

        {/* Progress */}
        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{t('onboarding.onboarding_title')}</span>
            <span>
              {t('onboarding.step_of', { step: String(step), total: String(totalSteps) })}
            </span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-border overflow-hidden">
            <div
              className="h-1.5 rounded-full bg-primary origin-left transition-transform duration-300"
              style={{ transform: `scaleX(${step / totalSteps})` }}
            />
          </div>
        </div>

        {/* Step content */}
        <div className="rounded-2xl border border-border bg-card p-6">
          {isCoach ? (
            <>
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold">Club & Sport</h2>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('onboarding.club_name')}</Label>
                    <Input
                      value={clubName}
                      onChange={(e) => setClubName(e.target.value)}
                      placeholder={t('onboarding.optional_placeholder')}
                      className="bg-background"
                    />
                  </div>

                  <RadioGroup
                    label={t('onboarding.sport')}
                    options={sportOptions}
                    value={sport}
                    onChange={setSport}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-4 text-center">
                  <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/15">
                    <Waves className="h-8 w-8 text-primary" />
                  </div>
                  <h2 className="text-lg font-semibold">{t('onboarding.coach_ready_message')}</h2>
                  <p className="text-sm text-muted-foreground">
                    Head to your dashboard and invite your first athlete.
                  </p>
                </div>
              )}
            </>
          ) : (
            <>
              {step === 1 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold">About You</h2>

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('onboarding.date_of_birth')}</Label>
                    <DatePicker
                      value={dob}
                      onChange={setDob}
                      placeholder={t('onboarding.optional_placeholder')}
                    />
                  </div>

                  <RadioGroup
                    label={t('onboarding.fitness_level')}
                    options={fitnessOptions}
                    value={fitnessLevel}
                    onChange={setFitnessLevel}
                  />
                </div>
              )}

              {step === 2 && (
                <div className="space-y-5">
                  <h2 className="text-lg font-semibold">Your Swimming</h2>

                  <RadioGroup
                    label={t('onboarding.stroke_specialty')}
                    options={strokeOptions}
                    value={strokeSpecialty}
                    onChange={setStrokeSpecialty}
                  />

                  <div className="space-y-1.5">
                    <Label className="text-sm font-medium">{t('onboarding.club_name')}</Label>
                    <Input
                      value={athleteClub}
                      onChange={(e) => setAthleteClub(e.target.value)}
                      placeholder={t('onboarding.optional_placeholder')}
                      className="bg-background"
                    />
                  </div>
                </div>
              )}

              {step === 2 && !saving && (
                <div className="mt-4 rounded-lg bg-primary/10 p-3 text-center text-sm text-primary">
                  {t('onboarding.athlete_ready_message')}
                </div>
              )}
            </>
          )}

          {error && (
            <p className="mt-3 text-xs text-destructive">{error}</p>
          )}
        </div>

        {/* Actions */}
        <div className="mt-5 flex gap-3">
          {step > 1 && (
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => setStep((s) => s - 1)}
              disabled={saving}
            >
              {t('common.back')}
            </Button>
          )}
          {step < totalSteps ? (
            <Button className="flex-1" onClick={handleNext}>
              {t('onboarding.continue')}
              <ChevronRight className="ml-1 h-4 w-4" />
            </Button>
          ) : (
            <Button className="flex-1" onClick={handleFinish} disabled={saving}>
              {saving ? t('common.loading') : t('onboarding.finish_setup')}
            </Button>
          )}
        </div>
      </div>
    </div>
  )
}
