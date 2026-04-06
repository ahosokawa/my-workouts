import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName, liftProgressionAmount, ProgramVariant, PhaseType, DeloadType, displayRound, toStorageLbs } from '../types'
import type { AccessoryExercise } from '../types'
import { evaluateCycle, suggestedTMs } from '../logic/cycleEvaluator'
import { getVariantConfig, suggestPhase } from '../logic/variants'
import AccessoryEditor from '../components/AccessoryEditor'

export default function CycleCompletionView() {
  const profile = useStore((s) => s.profile)
  const sessions = useStore((s) => s.sessions)
  const setLogs = useStore((s) => s.setLogs)
  const updateProfile = useStore((s) => s.updateProfile)
  const startNewCycle = useStore((s) => s.startNewCycle)
  const startDeload = useStore((s) => s.startDeload)
  const customAccessories = useStore((s) => s.customAccessories)
  const setCustomAccessories = useStore((s) => s.setCustomAccessories)

  if (!profile) return null

  const units = profile.units ?? 'lbs'
  const cycleResult = useMemo(
    () => evaluateCycle(sessions, setLogs, profile.cycleNumber),
    [sessions, setLogs, profile.cycleNumber],
  )

  const suggested = useMemo(
    () => suggestedTMs(profile, cycleResult),
    [profile, cycleResult],
  )

  const [editedTMs, setEditedTMs] = useState<Record<number, string>>(() => {
    const m: Record<number, string> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = String(displayRound(suggested[lift], units))
    }
    return m
  })

  const [selectedVariant, setSelectedVariant] = useState<ProgramVariant>(
    () => profile.currentVariant ?? 'fsl',
  )

  const [bodyWeight, setBodyWeight] = useState(() =>
    profile.bodyWeightLbs && profile.bodyWeightLbs > 0
      ? String(displayRound(profile.bodyWeightLbs, units))
      : '',
  )

  const suggestedPhase = suggestPhase(
    profile.leaderCycleCount ?? 0,
    profile.anchorCycleCount ?? 0,
  )

  // Per-day accessory state: initialise from last cycle's custom accessories or defaults
  const [dayAccessories, setDayAccessories] = useState<Record<number, AccessoryExercise[]>>(() => {
    const m: Record<number, AccessoryExercise[]> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = customAccessories?.[lift]
        ? customAccessories[lift].map((ex) => ({ ...ex }))
        : []
    }
    return m
  })

  const [deloadOption, setDeloadOption] = useState<'deload' | 'tm_test' | 'skip'>('deload')

  const tmMap: Record<number, number> = {
    [MainLift.Squat]: displayRound(profile.squatTM, units),
    [MainLift.BenchPress]: displayRound(profile.benchTM, units),
    [MainLift.Deadlift]: displayRound(profile.deadliftTM, units),
    [MainLift.ShoulderPress]: displayRound(profile.pressTM, units),
  }

  function applyTMsAndAccessories() {
    // User-edited TMs are in display units — convert to lbs for storage
    const sq = toStorageLbs(Number(editedTMs[MainLift.Squat]), units) || profile!.squatTM
    const bp = toStorageLbs(Number(editedTMs[MainLift.BenchPress]), units) || profile!.benchTM
    const dl = toStorageLbs(Number(editedTMs[MainLift.Deadlift]), units) || profile!.deadliftTM
    const sp = toStorageLbs(Number(editedTMs[MainLift.ShoulderPress]), units) || profile!.pressTM

    const bw = Number(bodyWeight)
    updateProfile({
      squatTM: sq,
      benchTM: bp,
      deadliftTM: dl,
      pressTM: sp,
      ...(bw > 0 ? { bodyWeightLbs: toStorageLbs(bw, units), bodyWeightLastUpdated: new Date().toISOString() } : {}),
    })
    setCustomAccessories(dayAccessories)
  }

  function handleStart() {
    applyTMsAndAccessories()

    if (deloadOption === 'skip') {
      startNewCycle(selectedVariant)
    } else {
      // Save the selected variant for after deload
      updateProfile({ currentVariant: selectedVariant })
      startDeload(deloadOption === 'tm_test' ? DeloadType.TMTest : DeloadType.Deload)
    }
  }

  return (
    <div className="min-h-full flex flex-col p-6">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold mb-1">Cycle {profile.cycleNumber} Complete</h1>
        <p className="text-sm text-[#8e8e93]">
          {cycleResult.isSuccessful
            ? 'All AMRAP targets met! Training maxes will increase.'
            : 'Some AMRAP targets were not met. Review and adjust your training maxes.'}
        </p>
      </div>

      {/* Lift-by-lift results */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Results</h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {MAIN_LIFTS.map((lift) => {
            const result = cycleResult.liftResults[lift]
            const amrapPassed = result && result.amrapMet
            return (
              <div key={lift} className="py-3">
                <div className="flex items-center gap-2">
                  <span className={`text-lg ${amrapPassed ? 'text-[var(--color-green)]' : 'text-[var(--color-orange)]'}`}>
                    {amrapPassed ? '✓' : '!'}
                  </span>
                  <span className="font-medium text-sm">{liftDisplayName(lift)}</span>
                </div>
                {result && (
                  <div className="ml-7 mt-1 text-xs text-[#8e8e93]">
                    {result.allMainSetsCompleted ? 'All sets completed' : 'Not all sets completed'}
                    {' · '}
                    {result.amrapMet ? 'AMRAP targets met' : 'AMRAP targets not met'}
                  </div>
                )}
                {result?.amrapDetails.map((d, i) => (
                  <div key={i} className="ml-7 text-[10px] text-[#8e8e93]">
                    Week {d.week}: {displayRound(d.weight, units)} {units} x {d.actualReps} (min: {d.targetReps})
                    {' '}
                    <span className={d.metMinimum ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}>
                      {d.metMinimum ? '✓' : '✗'}
                    </span>
                  </div>
                ))}
              </div>
            )
          })}
        </div>
      </div>

      {/* Body Weight */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Body Weight</h2>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Current Weight</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                inputMode="decimal"
                placeholder="Enter weight"
                value={bodyWeight}
                onChange={(e) => setBodyWeight(e.target.value)}
                className="w-20 text-right text-sm"
              />
              <span className="text-xs text-[#8e8e93]">{units}</span>
            </div>
          </div>
          {!bodyWeight && (
            <p className="text-xs text-[var(--color-orange)]">Please enter your body weight for accurate Wilks tracking.</p>
          )}
        </div>
      </div>

      {/* New Training Maxes */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">New Training Maxes</h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {MAIN_LIFTS.map((lift) => {
            const current = tmMap[lift]
            const val = editedTMs[lift]
            const num = Number(val)
            const delta = num - current
            return (
              <div key={lift} className="py-3">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="font-medium text-sm">{liftDisplayName(lift)}</div>
                    <div className="text-xs text-[#8e8e93]">
                      Current: {current} {units}
                      {cycleResult.liftResults[lift]?.amrapMet && (
                        <span className="text-[var(--color-green)]"> (+{liftProgressionAmount(lift, units)})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      inputMode="numeric"
                      value={val}
                      onChange={(e) => setEditedTMs((p) => ({ ...p, [lift]: e.target.value }))}
                      className="w-20 text-right text-sm"
                    />
                    <span className="text-xs text-[#8e8e93]">{units}</span>
                  </div>
                </div>
                {delta !== 0 && num > 0 && (
                  <div className={`text-xs mt-1 ${delta > 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
                    {delta > 0 ? '+' : ''}{delta} {units} from current
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Next Cycle Program Variant */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Next Cycle Program</h2>
        </div>
        <div className="px-4 pb-3">
          <div className="text-xs text-[var(--color-accent)] mb-3">
            {suggestedPhase === PhaseType.Anchor
              ? `Suggested: Switch to an Anchor — you've completed ${profile.leaderCycleCount ?? 0} Leader cycle${(profile.leaderCycleCount ?? 0) !== 1 ? 's' : ''}`
              : (profile.anchorCycleCount ?? 0) >= 1
                ? `Suggested: Switch to a Leader — you've completed ${profile.anchorCycleCount ?? 0} Anchor cycle${(profile.anchorCycleCount ?? 0) !== 1 ? 's' : ''}`
                : 'Suggested: Start with a Leader cycle'}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {(Object.values(ProgramVariant) as ProgramVariant[]).map((v) => {
              const config = getVariantConfig(v)
              const isSelected = selectedVariant === v
              const isSuggestedPhase = config.phase === suggestedPhase
              return (
                <button
                  key={v}
                  onClick={() => setSelectedVariant(v)}
                  className={`rounded-lg p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
                      : isSuggestedPhase
                        ? 'border border-[#48484a] bg-[#2c2c2e]'
                        : 'border border-[#38383a] bg-[#1c1c1e]'
                  }`}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{config.shortLabel}</span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                      config.phase === PhaseType.Leader ? 'bg-[#3a3a3c] text-[#8e8e93]' : 'bg-[#1c3a5e] text-[var(--color-accent)]'
                    }`}>
                      {config.phase === PhaseType.Leader ? 'Leader' : 'Anchor'}
                    </span>
                  </div>
                  <div className="text-xs text-[#8e8e93]">
                    {config.supplementalSets}×{config.supplementalReps}
                  </div>
                </button>
              )
            })}
          </div>
          {(() => {
            const config = getVariantConfig(selectedVariant)
            return (
              <div className="mt-3 text-xs text-[#8e8e93]">
                {config.label} — {config.description}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Day-by-Day Accessory Preview / Editor */}
      <div className="mb-4">
        <AccessoryEditor value={dayAccessories} onChange={setDayAccessories} />
      </div>

      {/* Deload Week Option */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">7th Week Protocol</h2>
        </div>
        <div className="px-4 pb-3">
          <p className="text-xs text-[#8e8e93] mb-3">
            Optional deload week before starting the next cycle.
          </p>
          <div className="space-y-2">
            {([
              { value: 'deload' as const, label: 'Deload', desc: 'Light sets at 40-60% TM (recommended)' },
              { value: 'tm_test' as const, label: 'TM Test', desc: 'Work up to TM for 1 rep per lift' },
              { value: 'skip' as const, label: 'Skip', desc: 'Go straight to next cycle' },
            ]).map((opt) => (
              <button
                key={opt.value}
                onClick={() => setDeloadOption(opt.value)}
                className={`w-full text-left rounded-lg p-3 transition-colors ${
                  deloadOption === opt.value
                    ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
                    : 'border border-[#38383a] bg-[#1c1c1e]'
                }`}
              >
                <div className="font-semibold text-sm">{opt.label}</div>
                <div className="text-xs text-[#8e8e93]">{opt.desc}</div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="flex-1" />

      {/* Start Next Cycle or Deload */}
      <button
        onClick={handleStart}
        className="w-full py-3 rounded-xl bg-[var(--color-accent)] font-semibold text-white text-center"
      >
        {deloadOption === 'skip'
          ? `Start Cycle ${profile.cycleNumber + 1}`
          : `Start ${deloadOption === 'tm_test' ? 'TM Test' : 'Deload'} Week`}
      </button>
    </div>
  )
}
