import { useState, useMemo, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName, liftProgressionAmount, ProgramVariant, PhaseType, ProgramType, DeloadType, displayRound, toStorageLbs, toDisplayWeight } from '../types'
import type { ProgramType as ProgramTypeT, AccessoryExercise, SupplementalOverride } from '../types'
import { evaluateCycle, suggestedTMs } from '../logic/cycleEvaluator'
import { getVariantConfig, suggestPhase } from '../logic/variants'
import { mainLiftForDay } from '../logic/hypertrophyCalculator'
import { getAccessories, getHypertrophyAccessories } from '../logic/accessories'
import { roundWeight } from '../logic/calculator'
import WorkoutPlanEditor from '../components/WorkoutPlanEditor'

export default function CycleCompletionView() {
  const profile = useStore((s) => s.profile)
  const sessions = useStore((s) => s.sessions)
  const setLogs = useStore((s) => s.setLogs)
  const updateProfile = useStore((s) => s.updateProfile)
  const startNewCycle = useStore((s) => s.startNewCycle)
  const startDeload = useStore((s) => s.startDeload)
  const switchProgram = useStore((s) => s.switchProgram)
  const customAccessories = useStore((s) => s.customAccessories)
  const setCustomAccessories = useStore((s) => s.setCustomAccessories)
  const customSupplemental = useStore((s) => s.customSupplemental)
  const setCustomSupplemental = useStore((s) => s.setCustomSupplemental)
  const programAccessoryArchive = useStore((s) => s.programAccessoryArchive)
  const programSupplementalArchive = useStore((s) => s.programSupplementalArchive)

  if (!profile) return null

  const units = profile.units ?? 'lbs'
  const programType = profile.programType ?? ProgramType.FiveThreeOne
  const isHypertrophy = programType === ProgramType.Hypertrophy
  const cycleResult = useMemo(
    () => evaluateCycle(sessions, setLogs, profile.cycleNumber),
    [sessions, setLogs, profile.cycleNumber],
  )

  const suggested = useMemo(
    () => suggestedTMs(profile, cycleResult),
    [profile, cycleResult],
  )

  // Hypertrophy: per-lift top-set delta over the just-completed cycle. Compares the first
  // top-set entry of the cycle with the latest, for each main lift that has a top set.
  const topSetDelta = (() => {
    if (!isHypertrophy) return null
    const m: Partial<Record<MainLift, { first: number; last: number }>> = {}
    for (const lift of MAIN_LIFTS) {
      if (!mainLiftForDay(programType, lift)) continue  // skip Friday (no main)
      const cycleLogs = setLogs
        .filter(
          (l) => l.exerciseName === liftDisplayName(lift) && l.isMainLift && l.isAMRAP && l.isCompleted && l.actualReps != null,
        )
        .sort((a, b) => (a.completedAt ?? '').localeCompare(b.completedAt ?? ''))
        .filter((l) => sessions.find((s) => s.id === l.sessionId)?.cycleNumber === profile.cycleNumber)
      if (cycleLogs.length === 0) continue
      m[lift] = { first: cycleLogs[0].weight, last: cycleLogs[cycleLogs.length - 1].weight }
    }
    return m
  })()

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

  const [selectedProgramType, setSelectedProgramType] = useState<ProgramTypeT>(programType)
  const selectedIsHypertrophy = selectedProgramType === ProgramType.Hypertrophy

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

  // Per-day supplemental override state — carry forward from last cycle if any
  const [daySupplemental, setDaySupplemental] = useState<Record<number, SupplementalOverride>>(() => {
    if (!customSupplemental) return {}
    const m: Record<number, SupplementalOverride> = {}
    for (const k of Object.keys(customSupplemental)) {
      const lift = Number(k)
      const existing = customSupplemental[lift]
      if (existing) m[lift] = { ...existing, exercise: { ...existing.exercise } }
    }
    return m
  })

  const [deloadOption, setDeloadOption] = useState<'deload' | 'tm_test' | 'skip'>('deload')

  // When the user picks a different program for the next cycle, reload TMs, accessories, and
  // supplemental from the right source. Per-program memory: for the original program, restore
  // the persisted state (customAccessories, customSupplemental, suggested TMs); for the other
  // program, use its archive if present, else hard-coded defaults.
  // Note: in-flight edits made while toggled are not preserved across toggles — decide on the
  // program first, then edit the plan.
  const prevSelectedRef = useRef(selectedProgramType)
  useEffect(() => {
    const prev = prevSelectedRef.current
    if (prev === selectedProgramType) return
    prevSelectedRef.current = selectedProgramType

    if (selectedProgramType === programType) {
      // Toggled back to the original program — restore the suggested TMs (with progression bonus).
      setEditedTMs({
        [MainLift.Squat]: String(displayRound(suggested[MainLift.Squat], units)),
        [MainLift.BenchPress]: String(displayRound(suggested[MainLift.BenchPress], units)),
        [MainLift.Deadlift]: String(displayRound(suggested[MainLift.Deadlift], units)),
        [MainLift.ShoulderPress]: String(displayRound(suggested[MainLift.ShoulderPress], units)),
      })
    } else {
      // Different program — recompute TMs from 1RM × new program's TM percentage.
      const pct = selectedProgramType === ProgramType.Hypertrophy ? 85 : (profile!.tmPercentage ?? 90)
      const tmFor = (rmLbs: number) => roundWeight(toDisplayWeight(rmLbs, units) * (pct / 100), units)
      setEditedTMs({
        [MainLift.Squat]: String(tmFor(profile!.squatOneRepMax)),
        [MainLift.BenchPress]: String(tmFor(profile!.benchOneRepMax)),
        [MainLift.Deadlift]: String(tmFor(profile!.deadliftOneRepMax)),
        [MainLift.ShoulderPress]: String(tmFor(profile!.pressOneRepMax)),
      })
    }

    const accessories: Record<number, AccessoryExercise[]> = {}
    const source =
      selectedProgramType === programType
        ? customAccessories
        : programAccessoryArchive[selectedProgramType]
    for (const lift of MAIN_LIFTS) {
      if (source?.[lift]) {
        accessories[lift] = source[lift].map((ex) => ({ ...ex }))
      } else {
        const defaults = selectedProgramType === ProgramType.Hypertrophy
          ? getHypertrophyAccessories(lift)
          : getAccessories(lift)
        accessories[lift] = defaults.map((ex) => ({ ...ex }))
      }
    }
    setDayAccessories(accessories)

    // Supplemental overrides only apply to 5/3/1.
    if (selectedProgramType === ProgramType.Hypertrophy) {
      setDaySupplemental({})
    } else {
      const suppSource =
        selectedProgramType === programType
          ? customSupplemental
          : programSupplementalArchive[selectedProgramType]
      const m: Record<number, SupplementalOverride> = {}
      if (suppSource) {
        for (const k of Object.keys(suppSource)) {
          const lift = Number(k)
          const existing = suppSource[lift]
          if (existing) m[lift] = { ...existing, exercise: { ...existing.exercise } }
        }
      }
      setDaySupplemental(m)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProgramType])

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
    setCustomSupplemental(Object.keys(daySupplemental).length > 0 ? daySupplemental : null)
  }

  function handleStart() {
    // If the user picked a different program for the next cycle, flip the program first.
    // switchProgram resets cycle position and seeds new defaults — applyTMsAndAccessories then
    // overrides those defaults with the user's edits.
    if (selectedProgramType !== programType) {
      switchProgram(selectedProgramType)
    }
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
          {isHypertrophy
            ? 'Review top-set progress, adjust TMs, and decide on a deload before the next block.'
            : cycleResult.isSuccessful
              ? 'All AMRAP targets met! Training maxes will increase.'
              : 'Some AMRAP targets were not met. Review and adjust your training maxes.'}
        </p>
      </div>

      {/* Lift-by-lift results */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">
            {isHypertrophy ? 'Top-Set Progress' : 'Results'}
          </h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {isHypertrophy
            ? MAIN_LIFTS.map((lift) => {
                const data = topSetDelta?.[lift]
                if (!data) return null
                const delta = data.last - data.first
                const positive = delta > 0
                return (
                  <div key={lift} className="py-3">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">{liftDisplayName(lift)}</span>
                      <span className={`text-sm tabular-nums ${positive ? 'text-[var(--color-green)]' : delta < 0 ? 'text-[var(--color-red)]' : 'text-[#8e8e93]'}`}>
                        {displayRound(data.first, units)} → {displayRound(data.last, units)} {units}
                        {delta !== 0 && (
                          <span className="ml-1">({positive ? '+' : ''}{displayRound(delta, units)})</span>
                        )}
                      </span>
                    </div>
                  </div>
                )
              })
            : MAIN_LIFTS.map((lift) => {
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

      {/* Next Cycle Program */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden mb-4">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Next Cycle Program</h2>
        </div>
        <div className="px-4 pb-3">
          <div className="grid grid-cols-2 gap-2 mb-3">
            {([ProgramType.FiveThreeOne, ProgramType.Hypertrophy] as ProgramTypeT[]).map((p) => {
              const isSelected = selectedProgramType === p
              return (
                <button
                  key={p}
                  onClick={() => setSelectedProgramType(p)}
                  className={`rounded-lg p-3 text-left transition-colors ${
                    isSelected
                      ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
                      : 'border border-[#38383a] bg-[#1c1c1e]'
                  }`}
                >
                  <div className="font-semibold text-sm">
                    {p === ProgramType.FiveThreeOne ? '5/3/1' : '4-Day Hypertrophy'}
                  </div>
                  <div className="text-xs text-[#8e8e93] mt-1">
                    {p === ProgramType.FiveThreeOne
                      ? 'Top-set AMRAP percentages over 3-week cycles'
                      : 'RPE-8 top sets + double progression, 7-week cycles'}
                  </div>
                </button>
              )
            })}
          </div>
          {!selectedIsHypertrophy && (
            <>
              <div className="text-xs text-[var(--color-accent)] mb-2">
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
            </>
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

      {/* Day-by-Day Workout Plan: supplemental override + accessories per day */}
      <div className="mb-4">
        <WorkoutPlanEditor
          accessories={dayAccessories}
          onAccessoriesChange={setDayAccessories}
          supplemental={daySupplemental}
          onSupplementalChange={setDaySupplemental}
          variantConfig={getVariantConfig(selectedVariant)}
          units={units}
          programType={selectedProgramType}
        />
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
