import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useState, useMemo } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft, Plus, Copy, Archive, ChevronUp, ChevronDown,
  Pencil, Trash2, Users, Check,
} from 'lucide-react'
import { toast } from 'sonner'
import { format } from 'date-fns'
import { useLanguage } from '@/contexts/language-context'
import { useAuth } from '@/contexts/auth-context'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Checkbox } from '@/components/ui/checkbox'
import { Calendar } from '@/components/ui/calendar'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  plansApi, DIFFICULTY_COLORS, SESSION_TYPE_COLORS, SET_TYPE_COLORS,
  DAY_NAMES, setLabel, sessionDistance, formatDistance,
  type Session, type SessionSet, type SessionType, type SetType,
  type Stroke, type TrainingPlanDetail,
} from '@/lib/plans-api'

export const Route = createFileRoute('/_app/plans/$id')({
  component: PlanBuilderPage,
})

// ─── Assign Modal ─────────────────────────────────────────────────────────────

function AssignModal({ plan, open, onClose }: { plan: TrainingPlanDetail; open: boolean; onClose: () => void }) {
  const { t } = useLanguage()
  const [mode, setMode] = useState<'individual' | 'team'>('individual')
  const [selectedAthletes, setSelectedAthletes] = useState<number[]>([])
  const [startDate, setStartDate] = useState<Date>(new Date())
  const [calOpen, setCalOpen] = useState(false)
  const [notes, setNotes] = useState('')
  const [result, setResult] = useState<{ assigned: number; warnings: { athlete_id: string; message: string }[] } | null>(null)

  const { data: athletes = [] } = useQuery({
    queryKey: ['team', 'athletes'],
    queryFn: () => api.get<{ id: string; status: string; athlete: number | null; invite_email: string | null; athlete_profile: { id: number; first_name: string; last_name: string } | null }[]>('/team/athletes/'),
    enabled: open && mode === 'individual',
  })

  const activeAthletes = athletes.filter((a) => a.status === 'active' && a.athlete_profile)

  const mutation = useMutation({
    mutationFn: () =>
      plansApi.assign(plan.id, {
        athlete_ids: mode === 'individual' ? selectedAthletes : undefined,
        assign_full_team: mode === 'team',
        start_date: format(startDate, 'yyyy-MM-dd'),
        custom_notes: notes || undefined,
      }),
    onSuccess: (data) => setResult(data),
    onError: () => toast.error(t('common.error')),
  })

  const toggleAthlete = (id: number) => {
    setSelectedAthletes((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    )
  }

  const endDate = new Date(startDate)
  endDate.setDate(endDate.getDate() + plan.duration_weeks * 7)

  const reset = () => {
    setSelectedAthletes([])
    setNotes('')
    setResult(null)
    setMode('individual')
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) { onClose(); reset() } }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('plan.assign')} — {plan.name}</DialogTitle>
        </DialogHeader>

        {result ? (
          <div className="space-y-3 py-2">
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 p-3 text-emerald-400">
              <Check className="h-5 w-5 shrink-0" />
              <p className="text-sm font-medium">
                {t('plan.assigned_successfully', { n: String(result.assigned), date: format(startDate, 'MMM d, yyyy') })}
              </p>
            </div>
            {result.warnings.map((w) => (
              <p key={w.athlete_id} className="text-xs text-amber-400">
                ⚠ {w.message}
              </p>
            ))}
            <Button className="w-full" onClick={() => { onClose(); reset() }}>
              {t('common.done')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4 pt-1">
            {/* Plan summary */}
            <div className="rounded-xl bg-muted/50 p-3 text-sm text-muted-foreground">
              {plan.duration_weeks} {t('plan.weeks')} · {plan.sessions.length} {t('plan.sessions')}
            </div>

            {/* Mode toggle */}
            <div className="flex gap-2">
              {(['individual', 'team'] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => setMode(m)}
                  className={`flex-1 rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
                    mode === m
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-border text-muted-foreground hover:border-border/80'
                  }`}
                >
                  {m === 'individual' ? t('plan.assign_individual') : t('plan.assign_full_team')}
                </button>
              ))}
            </div>

            {/* Individual athlete picker */}
            {mode === 'individual' && (
              <div className="max-h-40 overflow-y-auto rounded-xl border border-border">
                {activeAthletes.length === 0 ? (
                  <p className="p-4 text-center text-xs text-muted-foreground">{t('team.no_athletes_yet')}</p>
                ) : (
                  activeAthletes.map((rel) => {
                    const profile = rel.athlete_profile!
                    const name = `${profile.first_name} ${profile.last_name}`.trim()
                    const checked = selectedAthletes.includes(profile.id)
                    return (
                      <label
                        key={rel.id}
                        className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-muted/50"
                      >
                        <Checkbox
                          checked={checked}
                          onCheckedChange={() => toggleAthlete(profile.id)}
                        />
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
                          {name[0]?.toUpperCase()}
                        </div>
                        <span className="text-sm text-foreground">{name}</span>
                      </label>
                    )
                  })
                )}
              </div>
            )}

            {/* Start date */}
            <div className="space-y-1.5">
              <Label>{t('plan.start_date')}</Label>
              <Popover open={calOpen} onOpenChange={setCalOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start text-left font-normal">
                    {format(startDate, 'MMM d, yyyy')}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={(d) => { if (d) { setStartDate(d); setCalOpen(false) } }}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground">
                {t('plan.end_date')}: {format(endDate, 'MMM d, yyyy')}
              </p>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label>{t('common.optional')} {t('session.notes')}</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Custom notes for athletes..."
              />
            </div>

            <Button
              className="w-full"
              disabled={
                mutation.isPending ||
                (mode === 'individual' && selectedAthletes.length === 0)
              }
              onClick={() => mutation.mutate()}
            >
              {mutation.isPending ? t('common.loading') : t('plan.assign')}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Set Editor ───────────────────────────────────────────────────────────────

const EQUIPMENT_OPTIONS = ['fins', 'paddles', 'pull_buoy', 'band', 'snorkel'] as const

interface SetEditorProps {
  open: boolean
  onClose: () => void
  sessionId: string
  editSet?: SessionSet | null
  onSaved: () => void
}

function SetEditor({ open, onClose, sessionId, editSet, onSaved }: SetEditorProps) {
  const { t } = useLanguage()
  const isEdit = !!editSet

  const [setType, setSetType] = useState<SetType>(editSet?.set_type ?? 'main')
  const [reps, setReps] = useState(editSet?.repetitions ?? 1)
  const [distM, setDistM] = useState(editSet?.distance_m ?? 100)
  const [stroke, setStroke] = useState<Stroke>(editSet?.stroke ?? 'freestyle')
  const [equipment, setEquipment] = useState<string[]>(editSet?.equipment ?? [])
  const [restType, setRestType] = useState<'send_off' | 'seconds'>(
    editSet?.send_off_interval ? 'send_off' : 'seconds'
  )
  const [restSeconds, setRestSeconds] = useState(editSet?.rest_seconds ?? '')
  const [sendOff, setSendOff] = useState(editSet?.send_off_interval ?? '')
  const [pace, setPace] = useState(editSet?.target_pace_per_100m ?? '')
  const [hrZone, setHrZone] = useState(editSet?.target_hr_zone ?? '')
  const [rpe, setRpe] = useState(editSet?.intensity_rpe ?? '')
  const [notes, setNotes] = useState(editSet?.description ?? '')
  const [showTargets, setShowTargets] = useState(false)
  const [saveToLib, setSaveToLib] = useState(false)
  const [libName, setLibName] = useState('')

  const queryClient = useQueryClient()

  const totalDist = reps * (distM || 0)

  const mutation = useMutation({
    mutationFn: async () => {
      const payload: Partial<SessionSet> = {
        set_type: setType,
        repetitions: reps,
        distance_m: distM || undefined,
        stroke,
        equipment,
        rest_seconds: restType === 'seconds' && restSeconds ? Number(restSeconds) : undefined,
        send_off_interval: restType === 'send_off' && sendOff ? sendOff : undefined,
        target_pace_per_100m: pace || undefined,
        target_hr_zone: hrZone ? Number(hrZone) : undefined,
        intensity_rpe: rpe ? Number(rpe) : undefined,
        description: notes || undefined,
      }

      let savedSet: SessionSet
      if (isEdit) {
        savedSet = await plansApi.updateSet(editSet!.id, payload)
      } else {
        savedSet = await plansApi.createSet(sessionId, payload)
      }

      if (saveToLib && libName.trim()) {
        await plansApi.saveSetToLibrary(savedSet.id, libName.trim())
      }
      return savedSet
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      onSaved()
      onClose()
    },
    onError: () => toast.error(t('common.error')),
  })

  const toggleEquip = (eq: string) => {
    setEquipment((prev) =>
      prev.includes(eq) ? prev.filter((x) => x !== eq) : [...prev, eq]
    )
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-h-[90vh] max-w-[95vw] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEdit ? t('set.edit_set') : t('set.add_set')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-1">
          {/* Preview */}
          <div className="rounded-xl bg-primary/10 px-4 py-3 text-center text-sm font-semibold text-primary">
            {reps} × {distM || 0}m {stroke} = {totalDist}m
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('set.set_type')}</Label>
              <Select value={setType} onValueChange={(v) => setSetType(v as SetType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['warm_up','main','drill','kick','pull','cool_down','rest'] as SetType[]).map((s) => (
                    <SelectItem key={s} value={s}>{t(`set.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('set.stroke')}</Label>
              <Select value={stroke} onValueChange={(v) => setStroke(v as Stroke)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['freestyle','backstroke','breaststroke','butterfly','im','choice'] as Stroke[]).map((s) => (
                    <SelectItem key={s} value={s}>{t(`set.${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('set.repetitions')}</Label>
              <Input
                type="number"
                min={1}
                value={reps}
                onChange={(e) => setReps(Math.max(1, +e.target.value))}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('set.distance_m')}</Label>
              <Input
                type="number"
                min={0}
                value={distM}
                onChange={(e) => setDistM(+e.target.value)}
              />
            </div>
          </div>

          {/* Rest section */}
          <div className="space-y-2">
            <div className="flex gap-3">
              {(['seconds', 'send_off'] as const).map((rt) => (
                <label key={rt} className="flex cursor-pointer items-center gap-1.5 text-sm">
                  <input
                    type="radio"
                    checked={restType === rt}
                    onChange={() => setRestType(rt)}
                    className="h-3.5 w-3.5"
                  />
                  {rt === 'seconds' ? t('set.rest_seconds') : t('set.send_off')}
                </label>
              ))}
            </div>
            {restType === 'seconds' ? (
              <Input
                type="number"
                min={0}
                placeholder="e.g. 30"
                value={restSeconds}
                onChange={(e) => setRestSeconds(e.target.value)}
              />
            ) : (
              <Input
                placeholder='e.g. 1:30'
                value={sendOff}
                onChange={(e) => setSendOff(e.target.value)}
              />
            )}
          </div>

          {/* Equipment */}
          <div className="space-y-2">
            <Label>{t('set.equipment')}</Label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT_OPTIONS.map((eq) => (
                <button
                  key={eq}
                  type="button"
                  onClick={() => toggleEquip(eq)}
                  className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                    equipment.includes(eq)
                      ? 'border-primary bg-primary/20 text-primary'
                      : 'border-border text-muted-foreground hover:border-primary/40'
                  }`}
                >
                  {t(`set.${eq}`)}
                </button>
              ))}
            </div>
          </div>

          {/* Performance targets (collapsible) */}
          <div>
            <button
              type="button"
              className="flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              onClick={() => setShowTargets(!showTargets)}
            >
              {showTargets ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
              {t('set.performance_targets')}
            </button>
            {showTargets && (
              <div className="mt-3 grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('set.target_pace')}</Label>
                  <Input placeholder="1:28" value={pace} onChange={(e) => setPace(e.target.value)} className="h-8 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('set.target_hr_zone')}</Label>
                  <Select value={String(hrZone)} onValueChange={setHrZone}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {[1,2,3,4,5].map((z) => (
                        <SelectItem key={z} value={String(z)}>Z{z}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{t('set.target_rpe')}</Label>
                  <Select value={String(rpe)} onValueChange={setRpe}>
                    <SelectTrigger className="h-8 text-sm"><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="">—</SelectItem>
                      {[1,2,3,4,5,6,7,8,9,10].map((n) => (
                        <SelectItem key={n} value={String(n)}>{n}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>{t('set.notes')} <span className="text-muted-foreground text-xs">({t('common.optional')})</span></Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              placeholder="Drill instructions..."
            />
          </div>

          {/* Save to library */}
          <div className="space-y-2">
            <label className="flex cursor-pointer items-center gap-2">
              <Checkbox checked={saveToLib} onCheckedChange={(c) => setSaveToLib(!!c)} />
              <span className="text-sm">{t('set.save_to_library')}</span>
            </label>
            {saveToLib && (
              <Input
                placeholder={t('set.library_name')}
                value={libName}
                onChange={(e) => setLibName(e.target.value)}
              />
            )}
          </div>

          <div className="flex gap-2 pt-1">
            <Button variant="outline" className="flex-1" onClick={onClose}>
              {t('common.cancel')}
            </Button>
            <Button
              className="flex-1"
              disabled={mutation.isPending}
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

// ─── Set Library Picker ───────────────────────────────────────────────────────

function SetLibraryPicker({ open, onClose, sessionId, onSaved }: {
  open: boolean; onClose: () => void; sessionId: string; onSaved: () => void
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()

  const { data: items = [] } = useQuery({
    queryKey: ['set-library'],
    queryFn: plansApi.getLibrary,
    enabled: open,
  })

  const mutation = useMutation({
    mutationFn: (itemId: string) => plansApi.addSetFromLibrary(sessionId, itemId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan'] })
      onSaved()
      onClose()
    },
    onError: () => toast.error(t('common.error')),
  })

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <DialogContent className="max-w-[95vw] sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{t('set.set_library')}</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Library is empty. Save sets using the "Save to Library" option in the Set Editor.
          </p>
        ) : (
          <div className="max-h-80 space-y-2 overflow-y-auto">
            {items.map((item) => (
              <div
                key={item.id}
                className="flex cursor-pointer items-center justify-between rounded-xl border border-border p-3 hover:bg-muted/50"
                onClick={() => mutation.mutate(item.id)}
              >
                <div>
                  <p className="text-sm font-medium text-foreground">{item.name}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.repetitions} × {item.distance_m || 0}m {item.stroke}
                  </p>
                </div>
                <Plus className="h-4 w-4 text-muted-foreground" />
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

// ─── Session Panel (Sheet) ────────────────────────────────────────────────────

interface SessionPanelProps {
  open: boolean
  onClose: () => void
  planId: string
  weekNumber: number
  dayOfWeek: number
  editSession?: Session | null
  onSaved: () => void
  isCoach: boolean
}

function SessionPanel({ open, onClose, planId, weekNumber, dayOfWeek, editSession, onSaved, isCoach }: SessionPanelProps) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const isEdit = !!editSession

  const [name, setName] = useState(editSession?.name ?? '')
  const [sessionType, setSessionType] = useState<SessionType>(editSession?.session_type ?? 'intervals')
  const [duration, setDuration] = useState(editSession?.estimated_duration_min ?? '')
  const [coachNotes, setCoachNotes] = useState(editSession?.coach_notes ?? '')

  const [setEditorOpen, setSetEditorOpen] = useState(false)
  const [editSet, setEditSet] = useState<SessionSet | null>(null)
  const [libPickerOpen, setLibPickerOpen] = useState(false)

  // Current session's sets — refreshed after plan query invalidation
  const sets = useMemo(() => editSession?.sets ?? [], [editSession])

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (isEdit) {
        return plansApi.updateSession(editSession!.id, {
          name, session_type: sessionType,
          estimated_duration_min: duration ? Number(duration) : undefined,
          coach_notes: coachNotes || undefined,
        })
      } else {
        return plansApi.createSession(planId, {
          name, week_number: weekNumber, day_of_week: dayOfWeek,
          session_type: sessionType,
          estimated_duration_min: duration ? Number(duration) : undefined,
          coach_notes: coachNotes || undefined,
        })
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plan', planId] })
      onSaved()
      if (!isEdit) onClose()
    },
    onError: () => toast.error(t('common.error')),
  })

  const deleteMutation = useMutation({
    mutationFn: (setId: string) => plansApi.deleteSet(setId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: () => toast.error(t('common.error')),
  })

  const reorderMutation = useMutation({
    mutationFn: (order: { id: string; order: number }[]) =>
      plansApi.reorderSets(editSession!.id, order),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
  })

  const moveSet = (idx: number, dir: -1 | 1) => {
    if (!editSession) return
    const newSets = [...sets]
    const swapIdx = idx + dir
    if (swapIdx < 0 || swapIdx >= newSets.length) return
    const order = newSets.map((s, i) => ({ id: s.id, order: i }))
    // Swap orders
    const tmp = order[idx].order
    order[idx].order = order[swapIdx].order
    order[swapIdx].order = tmp
    reorderMutation.mutate(order)
  }

  const totalDist = sets.reduce((acc, s) => acc + (s.repetitions || 0) * (s.distance_m || 0), 0)

  return (
    <Sheet open={open} onOpenChange={(o) => { if (!o) onClose() }}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? t('session.edit_session') : t('session.add_session')}
          </SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Basic fields */}
          <div className="space-y-1.5">
            <Label>{t('session.session_name')} *</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Threshold Set"
              autoFocus={!isEdit}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>{t('session.session_type')}</Label>
              <Select value={sessionType} onValueChange={(v) => setSessionType(v as SessionType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(['warm_up','drill','threshold','intervals','race_pace','recovery','open_water'] as SessionType[]).map((s) => (
                    <SelectItem key={s} value={s}>{t(`plan.session_type_${s}`)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{t('session.estimated_duration')} (min)</Label>
              <Input
                type="number"
                min={0}
                placeholder="60"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          {isCoach && (
            <div className="space-y-1.5">
              <Label>{t('session.coach_notes')}</Label>
              <Textarea
                value={coachNotes}
                onChange={(e) => setCoachNotes(e.target.value)}
                rows={2}
                placeholder="Notes for your athlete..."
              />
            </div>
          )}

          {/* Save session button (top) */}
          <Button
            className="w-full"
            disabled={!name.trim() || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? t('common.loading') : t('session.save_session')}
          </Button>

          {/* Sets section — only shown when editing */}
          {isEdit && (
            <>
              <div className="border-t border-border pt-4">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-foreground">
                    {t('session.sets')} · {totalDist > 0 && <span className="text-muted-foreground font-normal">{formatDistance(totalDist)}</span>}
                  </h3>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => setLibPickerOpen(true)}
                    >
                      {t('set.from_library')}
                    </Button>
                    <Button
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => { setEditSet(null); setSetEditorOpen(true) }}
                    >
                      <Plus className="mr-1 h-3 w-3" />
                      {t('set.add_set')}
                    </Button>
                  </div>
                </div>

                {sets.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                    No sets yet. Add a set to build this session.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {sets.map((s, idx) => (
                      <div
                        key={s.id}
                        className="flex items-center gap-2 rounded-xl border border-border bg-card p-3"
                      >
                        <div className="flex flex-col gap-0.5">
                          <button
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveSet(idx, -1)}
                            disabled={idx === 0}
                          >
                            <ChevronUp className="h-3.5 w-3.5" />
                          </button>
                          <button
                            className="text-muted-foreground hover:text-foreground disabled:opacity-30"
                            onClick={() => moveSet(idx, 1)}
                            disabled={idx === sets.length - 1}
                          >
                            <ChevronDown className="h-3.5 w-3.5" />
                          </button>
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span
                              className={`rounded-full px-1.5 py-0.5 text-[10px] font-medium ${SET_TYPE_COLORS[s.set_type]}`}
                            >
                              {t(`set.${s.set_type}`)}
                            </span>
                            <span className="text-xs text-foreground">{setLabel(s)}</span>
                          </div>
                          {s.equipment.length > 0 && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {s.equipment.map((e) => t(`set.${e}`)).join(', ')}
                            </p>
                          )}
                        </div>

                        <button
                          onClick={() => { setEditSet(s); setSetEditorOpen(true) }}
                          className="text-muted-foreground hover:text-foreground"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => deleteMutation.mutate(s.id)}
                          className="text-muted-foreground hover:text-destructive"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {/* Set editor */}
        {setEditorOpen && (
          <SetEditor
            open={setEditorOpen}
            onClose={() => { setSetEditorOpen(false); setEditSet(null) }}
            sessionId={editSession?.id ?? ''}
            editSet={editSet}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['plan', planId] })
            }}
          />
        )}

        {/* Library picker */}
        {libPickerOpen && editSession && (
          <SetLibraryPicker
            open={libPickerOpen}
            onClose={() => setLibPickerOpen(false)}
            sessionId={editSession.id}
            onSaved={() => {
              queryClient.invalidateQueries({ queryKey: ['plan', planId] })
            }}
          />
        )}
      </SheetContent>
    </Sheet>
  )
}

// ─── Week Grid ────────────────────────────────────────────────────────────────

function WeekGrid({
  sessions,
  weekNumber,
  planId,
  isCoach,
  onEditSession,
}: {
  sessions: Session[]
  weekNumber: number
  planId: string
  isCoach: boolean
  onEditSession: (session: Session) => void
}) {
  const { t } = useLanguage()
  const queryClient = useQueryClient()
  const [panelOpen, setPanelOpen] = useState(false)
  const [selectedDay, setSelectedDay] = useState(0)

  const deleteMutation = useMutation({
    mutationFn: (id: string) => plansApi.deleteSession(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: () => toast.error(t('common.error')),
  })

  const duplicateMutation = useMutation({
    mutationFn: ({ id, day }: { id: string; day: number }) =>
      plansApi.duplicateSession(id, { week_number: weekNumber, day_of_week: day }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', planId] }),
    onError: () => toast.error(t('common.error')),
  })

  const sessionsForDay = (day: number) =>
    sessions.filter((s) => s.week_number === weekNumber && s.day_of_week === day)

  return (
    <>
      <div className="overflow-x-auto">
        <div className="min-w-[560px] grid grid-cols-7 gap-1.5 pb-2">
          {DAY_NAMES.map((day, dayIdx) => {
            const daySessions = sessionsForDay(dayIdx)
            return (
              <div key={day} className="flex flex-col gap-1.5">
                {/* Day header */}
                <div className="py-1 text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {day}
                </div>

                {/* Sessions */}
                {daySessions.map((session) => {
                  const dist = sessionDistance(session)
                  return (
                    <div
                      key={session.id}
                      className="group relative cursor-pointer rounded-xl border border-border bg-card p-2 hover:border-primary/40"
                      onClick={() => isCoach && onEditSession(session)}
                    >
                      <p className="text-[11px] font-semibold text-foreground leading-tight line-clamp-2">
                        {session.name}
                      </p>
                      <div
                        className={`mt-1 inline-block rounded-full px-1.5 py-0.5 text-[9px] font-medium ${SESSION_TYPE_COLORS[session.session_type]}`}
                      >
                        {t(`plan.session_type_${session.session_type}`)}
                      </div>
                      {dist > 0 && (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {formatDistance(dist)}
                        </p>
                      )}
                      {isCoach && (
                        <div
                          className="absolute right-1 top-1 hidden gap-0.5 group-hover:flex"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            className="rounded p-0.5 text-muted-foreground hover:text-blue-400"
                            title="Duplicate"
                            onClick={() => duplicateMutation.mutate({ id: session.id, day: dayIdx })}
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                          <button
                            className="rounded p-0.5 text-muted-foreground hover:text-destructive"
                            title="Delete"
                            onClick={() => deleteMutation.mutate(session.id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      )}
                    </div>
                  )
                })}

                {/* Add session button */}
                {isCoach && (
                  <button
                    className="flex items-center justify-center rounded-xl border border-dashed border-border py-2 text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                    onClick={() => { setSelectedDay(dayIdx); setPanelOpen(true) }}
                  >
                    <Plus className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {panelOpen && (
        <SessionPanel
          open={panelOpen}
          onClose={() => setPanelOpen(false)}
          planId={planId}
          weekNumber={weekNumber}
          dayOfWeek={selectedDay}
          editSession={null}
          onSaved={() => setPanelOpen(false)}
          isCoach={isCoach}
        />
      )}
    </>
  )
}

// ─── Plan Builder Page ────────────────────────────────────────────────────────

function PlanBuilderPage() {
  const { id } = Route.useParams()
  const { t } = useLanguage()
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const isCoach = user?.role === 'coach'

  const [activeWeek, setActiveWeek] = useState(1)
  const [editingName, setEditingName] = useState(false)
  const [nameInput, setNameInput] = useState('')
  const [assignOpen, setAssignOpen] = useState(false)
  const [editSession, setEditSession] = useState<Session | null>(null)
  const [sessionPanelOpen, setSessionPanelOpen] = useState(false)

  const { data: plan, isPending: isLoading } = useQuery({
    queryKey: ['plan', id],
    queryFn: () => plansApi.get(id),
    select: (data) => {
      // Sort sessions so we have stable reference
      return { ...data, sessions: [...data.sessions].sort((a, b) =>
        a.week_number !== b.week_number ? a.week_number - b.week_number :
        a.day_of_week !== b.day_of_week ? a.day_of_week - b.day_of_week :
        a.order_in_day - b.order_in_day
      )}
    },
  })

  const renameMutation = useMutation({
    mutationFn: (name: string) => plansApi.update(id, { name }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plan', id] }),
    onError: () => toast.error(t('common.error')),
  })

  const cloneMutation = useMutation({
    mutationFn: () => plansApi.clone(id),
    onSuccess: (r) => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      navigate({ to: '/plans/$id', params: { id: r.id } })
    },
    onError: () => toast.error(t('common.error')),
  })

  const archiveMutation = useMutation({
    mutationFn: () => plansApi.archive(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plans'] })
      navigate({ to: '/plans' })
    },
    onError: () => toast.error(t('common.error')),
  })

  if (isLoading || !plan) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-primary" />
      </div>
    )
  }

  const totalDist = plan.sessions.reduce(
    (acc, s) => acc + s.sets.reduce((a, set) => a + (set.repetitions || 0) * (set.distance_m || 0), 0),
    0
  )

  const weekSessionCounts = Array.from({ length: plan.duration_weeks }, (_, i) =>
    plan.sessions.filter((s) => s.week_number === i + 1).length
  )

  const handleEditSession = (session: Session) => {
    setEditSession(session)
    setSessionPanelOpen(true)
  }

  return (
    <div className="flex flex-col bg-background">
      {/* Header */}
      <div className="sticky top-0 z-20 border-b border-border bg-background/95 backdrop-blur-sm px-4 py-3">
        <div className="flex items-start gap-3">
          <button
            className="mt-0.5 shrink-0 text-muted-foreground hover:text-foreground"
            onClick={() => navigate({ to: '/plans' })}
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex-1 min-w-0">
            {editingName ? (
              <input
                autoFocus
                className="w-full bg-transparent text-lg font-bold text-foreground outline-none border-b border-primary pb-0.5"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value)}
                onBlur={() => {
                  setEditingName(false)
                  if (nameInput.trim() && nameInput !== plan.name) {
                    renameMutation.mutate(nameInput.trim())
                  }
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') { setEditingName(false) }
                }}
              />
            ) : (
              <h1
                className={`text-lg font-bold text-foreground leading-tight ${isCoach ? 'cursor-pointer hover:text-primary' : ''}`}
                onClick={() => {
                  if (!isCoach) return
                  setNameInput(plan.name)
                  setEditingName(true)
                }}
              >
                {plan.name}
              </h1>
            )}

            <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <Badge
                variant="outline"
                className={`text-[10px] ${DIFFICULTY_COLORS[plan.difficulty]}`}
              >
                {t(`plan.${plan.difficulty}`)}
              </Badge>
              <span>{plan.duration_weeks} {t('plan.weeks')}</span>
              <span>·</span>
              <span>{plan.sessions.length} {t('plan.sessions')}</span>
              {totalDist > 0 && (
                <>
                  <span>·</span>
                  <span>{formatDistance(totalDist)}</span>
                </>
              )}
            </div>
          </div>

          {isCoach && (
            <div className="flex shrink-0 items-center gap-1">
              <Button
                size="sm"
                className="h-8 px-3 text-xs"
                onClick={() => setAssignOpen(true)}
              >
                <Users className="mr-1.5 h-3.5 w-3.5" />
                {t('plan.assign')}
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground"
                onClick={() => cloneMutation.mutate()}
                title={t('plan.clone')}
              >
                <Copy className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="ghost"
                className="h-8 w-8 p-0 text-muted-foreground hover:text-destructive"
                onClick={() => archiveMutation.mutate()}
                title={t('plan.archive')}
              >
                <Archive className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Week tabs */}
      <div className="overflow-x-auto border-b border-border">
        <div className="flex min-w-max px-4">
          {Array.from({ length: plan.duration_weeks }, (_, i) => i + 1).map((week) => (
            <button
              key={week}
              onClick={() => setActiveWeek(week)}
              className={`relative flex flex-col items-center px-4 py-2.5 text-sm font-medium transition-colors ${
                activeWeek === week
                  ? 'text-primary border-b-2 border-primary -mb-px'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('plan.week')} {week}
              {weekSessionCounts[week - 1] > 0 && (
                <span className={`mt-0.5 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
                  activeWeek === week ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                }`}>
                  {weekSessionCounts[week - 1]}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Week grid */}
      <div className="flex-1 p-4">
        <WeekGrid
          sessions={plan.sessions}
          weekNumber={activeWeek}
          planId={id}
          isCoach={isCoach}
          onEditSession={handleEditSession}
        />
      </div>

      {/* Assign modal */}
      {assignOpen && (
        <AssignModal
          plan={plan}
          open={assignOpen}
          onClose={() => setAssignOpen(false)}
        />
      )}

      {/* Session panel for edit */}
      {sessionPanelOpen && editSession && (
        <SessionPanel
          open={sessionPanelOpen}
          onClose={() => { setSessionPanelOpen(false); setEditSession(null) }}
          planId={id}
          weekNumber={editSession.week_number}
          dayOfWeek={editSession.day_of_week}
          editSession={editSession}
          onSaved={() => {
            queryClient.invalidateQueries({ queryKey: ['plan', id] })
            setEditSession(
              (prev) => {
                if (!prev || !plan) return null
                return plan.sessions.find((s) => s.id === prev.id) ?? null
              }
            )
          }}
          isCoach={isCoach}
        />
      )}
    </div>
  )
}
