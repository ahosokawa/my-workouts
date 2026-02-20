import { useState, useMemo } from 'react'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName, liftProgressionAmount } from '../types'
import type { AccessoryExercise } from '../types'
import { evaluateCycle, suggestedTMs } from '../logic/cycleEvaluator'
import { getAccessories } from '../logic/accessories'
import AccessoryEditor from '../components/AccessoryEditor'

export default function CycleCompletionView() {
  const profile = useStore((s) => s.profile)
  const sessions = useStore((s) => s.sessions)
  const setLogs = useStore((s) => s.setLogs)
  const updateProfile = useStore((s) => s.updateProfile)
  const startNewCycle = useStore((s) => s.startNewCycle)
  const customAccessories = useStore((s) => s.customAccessories)
  const setCustomAccessories = useStore((s) => s.setCustomAccessories)

  if (!profile) return null

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
      m[lift] = String(suggested[lift])
    }
    return m
  })

  const [bodyWeight, setBodyWeight] = useState(() =>
    profile.bodyWeightLbs && profile.bodyWeightLbs > 0
      ? String(Math.round(profile.bodyWeightLbs))
      : '',
  )

  // Per-day accessory state: initialise from last cycle's custom accessories or defaults
  const [dayAccessories, setDayAccessories] = useState<Record<number, AccessoryExercise[]>>(() => {
    const m: Record<number, AccessoryExercise[]> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = customAccessories?.[lift]
        ? customAccessories[lift].map((ex) => ({ ...ex }))
        : getAccessories(lift).map((ex) => ({ ...ex, id: ex.id }))
    }
    return m
  })

  const tmMap: Record<number, number> = {
    [MainLift.Squat]: profile.squatTM,
    [MainLift.BenchPress]: profile.benchTM,
    [MainLift.Deadlift]: profile.deadliftTM,
    [MainLift.ShoulderPress]: profile.pressTM,
  }

  function handleStart() {
    const sq = Number(editedTMs[MainLift.Squat]) || profile!.squatTM
    const bp = Number(editedTMs[MainLift.BenchPress]) || profile!.benchTM
    const dl = Number(editedTMs[MainLift.Deadlift]) || profile!.deadliftTM
    const sp = Number(editedTMs[MainLift.ShoulderPress]) || profile!.pressTM

    const bw = Number(bodyWeight)
    updateProfile({
      squatTM: sq,
      benchTM: bp,
      deadliftTM: dl,
      pressTM: sp,
      ...(bw > 0 ? { bodyWeightLbs: bw, bodyWeightLastUpdated: new Date().toISOString() } : {}),
    })

    // Save custom accessories
    setCustomAccessories(dayAccessories)

    startNewCycle()
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
                    Week {d.week}: {Math.round(d.weight)} lbs x {d.actualReps} (min: {d.targetReps})
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
              <span className="text-xs text-[#8e8e93]">lbs</span>
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
                      Current: {current} lbs
                      {cycleResult.liftResults[lift]?.amrapMet && (
                        <span className="text-[var(--color-green)]"> (+{liftProgressionAmount(lift)})</span>
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
                    <span className="text-xs text-[#8e8e93]">lbs</span>
                  </div>
                </div>
                {delta !== 0 && num > 0 && (
                  <div className={`text-xs mt-1 ${delta > 0 ? 'text-[var(--color-green)]' : 'text-[var(--color-red)]'}`}>
                    {delta > 0 ? '+' : ''}{delta} lbs from current
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Day-by-Day Accessory Preview / Editor */}
      <div className="mb-6">
        <AccessoryEditor value={dayAccessories} onChange={setDayAccessories} />
      </div>

      <div className="flex-1" />

      {/* Start Next Cycle */}
      <button
        onClick={handleStart}
        className="w-full py-3 rounded-xl bg-[var(--color-accent)] font-semibold text-white text-center"
      >
        Start Cycle {profile.cycleNumber + 1}
      </button>
    </div>
  )
}
