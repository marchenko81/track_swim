import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Copy, Archive, ChevronDown, ChevronUp, Calendar, Layers } from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { plansApi, DIFFICULTY_COLORS, type Difficulty, type Sport, type TrainingPlan } from '@/lib/plans-api'

export const Route = createFileRoute('/_app/plans/')({
  component: PlansIndexPage,
})


// ─── New Plan Modal ───────────────────────────────────────────────────────────

function NewPlanModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [durationWeeks, setDurationWeeks] = useState(4)
  const [difficulty, setDifficulty] = useState<Difficulty>('moderate')
  const [sport, setSport] = useState<Sport>('swimming')
  const [isTemplate, setIsTemplate] = useState(false)

  const mutation = useMutation({
    mutationFn: () =>
      plansApi.create({ name, description, duration_weeks: durationWeeks, difficulty, sport, is_template: isTemplate }),
    onSuccess: (plan) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      onClose()
      resetForm()
      navigate({ to: '/plans/$id', params: { id: plan.id } })
    },
    onError: () => toast.error(t('common.error')),
  })

  const resetForm = () => {
    setName('')
    setDescription('')
    setDurationWeeks(4)
    setDifficulty('moderate')
    setSport('swimming')
    setIsTemplate(false)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); resetForm() } }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('plan.new_plan')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>{t('plan.plan_name')} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. 4-Week Base Build"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('plan.duration_weeks')}</Label>
              <Input
                type="number"
                min={1}
                max={52}
                value={durationWeeks}
                onChange={(e) => setDurationWeeks(Math.max(1, Math.min(52, +e.target.value)))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('plan.difficulty')}</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as Difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="easy">{t('plan.easy')}</SelectItem>
                  <SelectItem value="moderate">{t('plan.moderate')}</SelectItem>
                  <SelectItem value="hard">{t('plan.hard')}</SelectItem>
                  <SelectItem value="race_pace">{t('plan.race_pace')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{t('plan.sport')}</Label>
            <Select value={sport} onValueChange={(v) => setSport(v as Sport)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="swimming">{t('plan.swimming')}</SelectItem>
                <SelectItem value="triathlon">{t('plan.triathlon')}</SelectItem>
                <SelectItem value="open_water">{t('plan.open_water')}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>{t('plan.description')} <span className="text-muted-foreground text-xs">({t('common.optional')})</span></Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              placeholder="Optional description..."
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={isTemplate}
              onChange={(e) => setIsTemplate(e.target.checked)}
              className="h-4 w-4 rounded border-border"
            />
            <span className="text-sm text-foreground">{t('plan.save_as_template')}</span>
          </label>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={() => { onClose(); resetForm() }}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={!name.trim() || mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t('common.loading') : t('common.save')}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  onClone,
  onArchive,
}: {
  plan: TrainingPlan
  onClone: (id: string) => void
  onArchive: (id: string) => void
}) {
  const { t } = useLanguage()
  const navigate = useNavigate()

  return (
    <div
      className="group relative cursor-pointer rounded-2xl border border-border bg-card p-4 transition-all hover:border-primary/40 hover:shadow-md"
      onClick={() => navigate({ to: '/plans/$id', params: { id: plan.id } })}
    >
      <div className="mb-2 flex items-start justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground leading-tight line-clamp-2 flex-1">{plan.name}</h3>
        <Badge
          variant="outline"
          className={`shrink-0 text-[10px] px-1.5 py-0.5 ${DIFFICULTY_COLORS[plan.difficulty]}`}
        >
          {t(`plan.${plan.difficulty}`)}
        </Badge>
      </div>

      <p className="mb-3 text-xs text-muted-foreground">
        {plan.duration_weeks} {t('plan.weeks')} ·{' '}
        {plan.sport.replace('_', ' ')}
      </p>

      <div className="mb-3 flex items-center gap-3 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <Calendar className="h-3 w-3" />
          {plan.session_count} {t('plan.sessions')}
        </span>
        {plan.total_distance_m > 0 && (
          <span>{plan.total_distance_m.toLocaleString()}m {t('plan.total_distance')}</span>
        )}
      </div>

      {plan.tags.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-1">
          {plan.tags.slice(0, 3).map((tag) => (
            <span key={tag} className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] text-primary">
              {tag}
            </span>
          ))}
        </div>
      )}

      <div
        className="flex gap-1"
        onClick={(e) => e.stopPropagation()}
      >
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
          onClick={() => onClone(plan.id)}
        >
          <Copy className="h-3 w-3" />
          {t('plan.clone')}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-destructive"
          onClick={() => onArchive(plan.id)}
        >
          <Archive className="h-3 w-3" />
          {t('plan.archive')}
        </Button>
      </div>
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

function PlansIndexPage() {
  const { t } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [newPlanOpen, setNewPlanOpen] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)

  const { data: plans = [], isPending: isLoading } = useQuery({
    queryKey: ['plans', 'active'],
    queryFn: () => plansApi.list(false),
    enabled: user?.role === 'coach',
    networkMode: 'always',
  })

  const { data: templates = [] } = useQuery({
    queryKey: ['plans', 'templates'],
    queryFn: () => plansApi.list(true),
    enabled: user?.role === 'coach' && showTemplates,
    networkMode: 'always',
  })

  const cloneMutation = useMutation({
    mutationFn: (id: string) => plansApi.clone(id),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      toast.success(t('common.success'))
      navigate({ to: '/plans/$id', params: { id: result.id } })
    },
    onError: () => toast.error(t('common.error')),
  })

  const archiveMutation = useMutation({
    mutationFn: (id: string) => plansApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      toast.success(t('plan.archive'))
    },
    onError: () => toast.error(t('common.error')),
  })

  // Athlete: show their assigned plans
  const { data: athletePlans = [] } = useQuery({
    queryKey: ['plans', 'athlete'],
    queryFn: () => plansApi.list(false),
    enabled: user?.role === 'athlete',
  })

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  // Athlete view
  if (user?.role === 'athlete') {
    return (
      <div className="px-4 pb-6 pt-5">
        <h1 className="mb-4 text-xl font-bold text-foreground">{t('nav.plans')}</h1>
        {athletePlans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">{t('plan.no_plan_yet')}</p>
          </div>
        ) : (
          <div className="space-y-3">
            {athletePlans.map((plan) => (
              <div
                key={plan.id}
                className="cursor-pointer rounded-2xl border border-border bg-card p-4"
                onClick={() => navigate({ to: '/plans/$id', params: { id: plan.id } })}
              >
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-foreground">{plan.name}</h3>
                  <Badge variant="outline" className={`text-xs ${DIFFICULTY_COLORS[plan.difficulty]}`}>
                    {t(`plan.${plan.difficulty}`)}
                  </Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {plan.duration_weeks} {t('plan.weeks')} · {plan.session_count} {t('plan.sessions')}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    )
  }

  // Coach view
  return (
    <div className="px-4 pb-6 pt-5">
      {/* Header */}
      <div className="mb-5 flex items-center justify-between">
        <h1 className="text-xl font-bold text-foreground">{t('nav.plans')}</h1>
        <Button size="sm" onClick={() => setNewPlanOpen(true)}>
          <Plus className="mr-1 h-3.5 w-3.5" />
          {t('plan.new_plan')}
        </Button>
      </div>

      {/* Active plans */}
      <section className="mb-6">
        <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          {t('plan.active_plans')}
        </h2>
        {plans.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <Layers className="mx-auto mb-3 h-10 w-10 text-muted-foreground/40" />
            <p className="mb-1 text-sm font-medium text-foreground">{t('plan.no_plans_yet')}</p>
            <Button size="sm" className="mt-3" onClick={() => setNewPlanOpen(true)}>
              <Plus className="mr-1 h-3.5 w-3.5" />
              {t('plan.new_plan')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {plans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                onClone={(id) => cloneMutation.mutate(id)}
                onArchive={(id) => archiveMutation.mutate(id)}
              />
            ))}
          </div>
        )}
      </section>

      {/* Templates section */}
      <section>
        <button
          className="mb-3 flex w-full items-center justify-between text-sm font-semibold uppercase tracking-wider text-muted-foreground"
          onClick={() => setShowTemplates(!showTemplates)}
        >
          {t('plan.templates')}
          {showTemplates ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showTemplates && (
          templates.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t('plan.no_plans_yet')}</p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {templates.map((plan) => (
                <div key={plan.id} className="relative">
                  <PlanCard
                    plan={plan}
                    onClone={(id) => cloneMutation.mutate(id)}
                    onArchive={(id) => archiveMutation.mutate(id)}
                  />
                  <div className="absolute right-2 top-2">
                    <Badge className="text-[10px] bg-primary/20 text-primary border-primary/30">
                      Template
                    </Badge>
                  </div>
                  <div
                    className="mt-1 px-4 pb-1"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-xs"
                      onClick={() => cloneMutation.mutate(plan.id)}
                    >
                      {t('plan.use_template')}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </section>

      <NewPlanModal open={newPlanOpen} onClose={() => setNewPlanOpen(false)} />
    </div>
  )
}
