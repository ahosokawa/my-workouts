import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useStore } from '../store'
import { liftDisplayName, liftFromDay, AccessoryWeightType } from '../types'
import type { PrescribedSet, AccessoryExercise } from '../types'
import { prescribedSets, amrapMinimum } from '../logic/calculator'
import { getAccessories } from '../logic/accessories'
import { estimated1RM } from '../logic/brzycki'
import { calculateWilks } from '../logic/wilks'
import { BARBELL_WEIGHT } from '../logic/plates'
import PlateBreakdown from '../components/PlateBreakdown'
import RestTimer from '../components/RestTimer'

export default function WorkoutView() {
  const profile = useStore((s) => s.profile)
  const setLogs = useStore((s) => s.setLogs)
  const saveWorkout = useStore((s) => s.saveWorkout)
  const advanceDay = useStore((s) => s.advanceDay)
  const addWilksEntry = useStore((s) => s.addWilksEntry)
  const aw = useStore((s) => s.activeWorkout)
  const updateAW = useStore((s) => s.updateActiveWorkout)
  const clearAW = useStore((s) => s.clearActiveWorkout)
  const customAccessories = useStore((s) => s.customAccessories)

  const [elapsed, setElapsed] = useState(0)
  const [showFinishAlert, setShowFinishAlert] = useState(false)

  if (!profile) return null
  const lift = liftFromDay(profile.currentDay)
  if (!lift) return null

  const tm = useStore.getState().getTrainingMax(lift)
  const sets = prescribedSets(tm, profile.currentWeek)
  const accessories = customAccessories?.[lift] ?? getAccessories(lift)
  const totalAccSets = accessories.reduce((n, ex) => n + ex.sets, 0)

  // Derived sets from stored arrays
  const completedMain = useMemo(() => new Set(aw.completedMain), [aw.completedMain])
  const completedAccessory = useMemo(() => new Set(aw.completedAccessory), [aw.completedAccessory])

  // Elapsed timer
  useEffect(() => {
    if (!aw.isActive || !aw.startTime) return
    setElapsed(Math.floor((Date.now() - aw.startTime) / 1000))
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - aw.startTime!) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [aw.isActive, aw.startTime])

  // ---- Helpers ----

  /** Resolve effective weight for a main set (override or prescribed) */
  function effectiveMainWeight(index: number): number {
    const override = aw.mainWeights?.[index]
    if (override !== undefined && override !== '') {
      const n = Number(override)
      if (n > 0) return n
    }
    return sets[index].weight
  }

  /** Resolve effective reps for a main set (override or prescribed) */
  function effectiveMainReps(index: number): number {
    const override = aw.mainReps?.[index]
    if (override !== undefined && override !== '') {
      const n = Number(override)
      if (n > 0) return n
    }
    return sets[index].targetReps
  }

  const defaultWeight = useCallback(
    (ex: AccessoryExercise): string => {
      const last = setLogs
        .filter((l) => l.exerciseName === ex.name && !l.isMainLift && l.isCompleted && l.weight > 0)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        [0]

      if (ex.weightType === AccessoryWeightType.Bodyweight) {
        if (profile?.bodyWeightLbs && profile.bodyWeightLbs > 0) return String(Math.round(profile.bodyWeightLbs))
        if (last) return String(Math.round(last.weight))
      }
      if (ex.weightType === AccessoryWeightType.Standard && last) {
        return String(Math.round(last.weight))
      }
      return ''
    },
    [setLogs, profile],
  )

  const defaultReps = useCallback(
    (ex: AccessoryExercise): string => {
      const last = setLogs
        .filter((l) => l.exerciseName === ex.name && !l.isMainLift && l.isCompleted)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        [0]
      return last ? String(last.targetReps) : String(ex.reps)
    },
    [setLogs],
  )

  function currentBestE1RM(): number | null {
    const logs = setLogs.filter(
      (l) => l.exerciseName === liftDisplayName(lift!) && l.isAMRAP && l.isMainLift && l.isCompleted && l.actualReps != null,
    )
    let best: number | null = null
    for (const l of logs) {
      const e = estimated1RM(l.weight, l.actualReps!)
      if (e !== null && (best === null || e > best)) best = e
    }
    return best
  }

  function minRepsToBeat(target: number, weight: number): number | null {
    if (target <= 0 || weight <= 0) return null
    const exact = 37 - (weight * 36) / target
    const minR = Math.ceil(exact)
    const needed = exact === minR ? minR + 1 : minR
    if (needed < 1 || needed >= 37) return null
    return needed
  }

  // ---- Actions ----

  function startSession() {
    const w: Record<string, string> = {}
    const r: Record<string, string> = {}
    for (const ex of accessories) {
      const dw = defaultWeight(ex)
      const dr = defaultReps(ex)
      for (let i = 0; i < ex.sets; i++) {
        const key = `${ex.name}-${i}`
        if (ex.weightType !== AccessoryWeightType.NoWeight) w[key] = dw
        r[key] = dr
      }
    }
    updateAW({
      isActive: true,
      startTime: Date.now(),
      amrapReps: amrapMinimum(profile!.currentWeek),
      completedMain: [],
      completedAccessory: [],
      accWeights: w,
      accReps: r,
      mainWeights: {},
      mainReps: {},
      lastSetTime: null,
      showRestTimer: false,
    })
  }

  function toggleMain(index: number) {
    if (!aw.isActive) return
    const next = new Set(completedMain)
    if (next.has(index)) {
      next.delete(index)
    } else {
      next.add(index)
      const allMainDone = next.size === sets.length
      const allAccDone = completedAccessory.size === totalAccSets
      if (!(allMainDone && allAccDone)) {
        updateAW({ lastSetTime: Date.now(), showRestTimer: true })
      } else {
        updateAW({ showRestTimer: false })
      }
    }
    updateAW({ completedMain: Array.from(next) })
  }

  function toggleAccessory(key: string) {
    if (!aw.isActive) return
    const next = new Set(completedAccessory)
    if (next.has(key)) {
      next.delete(key)
    } else {
      next.add(key)
      const allAccDone = next.size === totalAccSets
      const allMainDone = completedMain.size === sets.length
      if (!(allMainDone && allAccDone)) {
        updateAW({ lastSetTime: Date.now(), showRestTimer: true })
      } else {
        updateAW({ showRestTimer: false })
      }
    }
    updateAW({ completedAccessory: Array.from(next) })
  }

  function updateMainWeight(index: number, value: string) {
    updateAW({ mainWeights: { ...(aw.mainWeights ?? {}), [index]: value } })
  }

  function updateMainReps(index: number, value: string) {
    updateAW({ mainReps: { ...(aw.mainReps ?? {}), [index]: value } })
  }

  function updateAccWeight(exercise: AccessoryExercise, setIndex: number, value: string) {
    const next = { ...aw.accWeights }
    const key = `${exercise.name}-${setIndex}`
    next[key] = value
    for (let i = 0; i < exercise.sets; i++) {
      const k = `${exercise.name}-${i}`
      if (k !== key && !completedAccessory.has(k)) next[k] = value
    }
    updateAW({ accWeights: next })
  }

  function updateAccRep(exercise: AccessoryExercise, setIndex: number, value: string) {
    const next = { ...aw.accReps }
    const key = `${exercise.name}-${setIndex}`
    next[key] = value
    for (let i = 0; i < exercise.sets; i++) {
      const k = `${exercise.name}-${i}`
      if (k !== key && !completedAccessory.has(k)) next[k] = value
    }
    updateAW({ accReps: next })
  }

  function finishWorkout() {
    if (!profile || !lift) return
    const duration = aw.startTime ? Math.floor((Date.now() - aw.startTime) / 1000) : 0

    const logEntries: Parameters<typeof saveWorkout>[1] = []

    let curAmrapWeight = 0
    let curAmrapReps = 0
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i]
      const completed = completedMain.has(i)
      const weight = effectiveMainWeight(i)
      const reps = effectiveMainReps(i)
      logEntries.push({
        exerciseName: liftDisplayName(lift),
        isMainLift: true,
        setIndex: i,
        weight,
        targetReps: reps,
        actualReps: s.isAMRAP ? aw.amrapReps : null,
        isAMRAP: s.isAMRAP,
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null,
      })
      if (s.isAMRAP && completed) {
        curAmrapWeight = weight
        curAmrapReps = aw.amrapReps
      }
    }

    for (const ex of accessories) {
      for (let i = 0; i < ex.sets; i++) {
        const key = `${ex.name}-${i}`
        const completed = completedAccessory.has(key)
        logEntries.push({
          exerciseName: ex.name,
          isMainLift: false,
          setIndex: i,
          weight: Number(aw.accWeights[key] || '0') || 0,
          targetReps: Number(aw.accReps[key] || String(ex.reps)) || ex.reps,
          actualReps: null,
          isAMRAP: false,
          isCompleted: completed,
          completedAt: completed ? new Date().toISOString() : null,
        })
      }
    }

    saveWorkout(
      { date: new Date().toISOString(), liftRawValue: lift, week: profile.currentWeek, cycleNumber: profile.cycleNumber, durationSeconds: duration },
      logEntries,
    )

    // Wilks
    if (profile.bodyWeightLbs && profile.bodyWeightLbs > 0) {
      const allLogs = useStore.getState().setLogs
      const bestFor = (name: string) => {
        let best = 0
        for (const l of allLogs) {
          if (l.exerciseName === name && l.isAMRAP && l.isMainLift && l.isCompleted && l.actualReps != null) {
            const e = estimated1RM(l.weight, l.actualReps)
            if (e !== null && e > best) best = e
          }
        }
        if (name === liftDisplayName(lift!) && curAmrapReps > 0) {
          const e = estimated1RM(curAmrapWeight, curAmrapReps)
          if (e !== null && e > best) best = e
        }
        return best
      }
      const sq = bestFor('Squat')
      const bp = bestFor('Bench Press')
      const dl = bestFor('Deadlift')
      if (sq > 0 || bp > 0 || dl > 0) {
        const w = calculateWilks(profile.bodyWeightLbs, sq, bp, dl)
        if (w !== null) {
          addWilksEntry({
            date: new Date().toISOString(),
            bodyWeightLbs: profile.bodyWeightLbs,
            squatE1RM: sq,
            benchE1RM: bp,
            deadliftE1RM: dl,
            total: sq + bp + dl,
            wilksScore: w,
          })
        }
      }
    }

    advanceDay()
    clearAW()
    setShowFinishAlert(false)
  }

  const fmtElapsed = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`
  const bestE1RM = currentBestE1RM()

  // ---- Render ----
  return (
    <div className="p-4 pb-2 space-y-4">
      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-lg font-bold">Week {profile.currentWeek}: {liftDisplayName(lift)}</h1>
            <p className="text-xs text-[#8e8e93]">Cycle {profile.cycleNumber} · Day {profile.currentDay} of 4</p>
          </div>
          {aw.isActive && (
            <div className="text-right">
              <div className="text-lg font-medium tabular-nums">{fmtElapsed}</div>
              <div className="text-[10px] text-[#8e8e93]">Elapsed</div>
            </div>
          )}
        </div>
        {!aw.isActive && (
          <button
            onClick={startSession}
            className="w-full mt-3 py-2.5 rounded-xl bg-[var(--color-accent)] font-semibold text-white text-center"
          >
            Start Workout
          </button>
        )}
      </div>

      {/* Main Lift Sets */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">{liftDisplayName(lift)}</h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {sets.map((s, i) => (
            <MainSetCard
              key={s.id}
              set={s}
              index={i}
              isActive={aw.isActive}
              isCompleted={completedMain.has(i)}
              amrapReps={aw.amrapReps}
              setAmrapReps={(v) => updateAW({ amrapReps: v })}
              bestE1RM={bestE1RM}
              minRepsToBeat={minRepsToBeat}
              overrideWeight={aw.mainWeights?.[i]}
              overrideReps={aw.mainReps?.[i]}
              onWeightChange={(v) => updateMainWeight(i, v)}
              onRepsChange={(v) => updateMainReps(i, v)}
              onToggle={() => toggleMain(i)}
            />
          ))}
        </div>
      </div>

      {/* Accessories */}
      {accessories.map((ex) => (
        <div key={ex.id} className="bg-[#1c1c1e] rounded-xl overflow-hidden">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">{ex.name}</h2>
            <span className="text-xs text-[#8e8e93]">{ex.sets}x{ex.reps}</span>
          </div>
          <div className="px-4 pb-3 divide-y divide-[#38383a]">
            {Array.from({ length: ex.sets }, (_, si) => {
              const key = `${ex.name}-${si}`
              const completed = completedAccessory.has(key)
              return (
                <div
                  key={key}
                  className={`flex items-center gap-3 py-2.5 ${completed ? 'opacity-50' : ''}`}
                  onClick={() => toggleAccessory(key)}
                >
                  <span className={`text-xl ${completed ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                    {completed ? '✓' : '○'}
                  </span>
                  <span className="text-sm">Set {si + 1}</span>
                  <div className="flex-1" />

                  {/* Weight */}
                  {ex.weightType !== AccessoryWeightType.NoWeight && (
                    aw.isActive && !completed ? (
                      <input
                        type="number"
                        inputMode="decimal"
                        placeholder="lbs"
                        value={aw.accWeights[key] ?? ''}
                        onChange={(e) => { e.stopPropagation(); updateAccWeight(ex, si, e.target.value) }}
                        onClick={(e) => e.stopPropagation()}
                        className="w-16 text-right text-sm py-1 px-2"
                      />
                    ) : (
                      (() => {
                        const w = aw.accWeights[key] || defaultWeight(ex)
                        const n = Number(w)
                        return n > 0 ? <span className="text-sm text-[#8e8e93]">{Math.round(n)} lbs</span> : null
                      })()
                    )
                  )}

                  {/* Reps */}
                  {aw.isActive && !completed ? (
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="reps"
                      value={aw.accReps[key] ?? String(ex.reps)}
                      onChange={(e) => { e.stopPropagation(); updateAccRep(ex, si, e.target.value) }}
                      onClick={(e) => e.stopPropagation()}
                      className="w-12 text-center text-sm py-1 px-1"
                    />
                  ) : (
                    <span className={`text-sm ${completed ? 'text-[#8e8e93]' : ''}`}>
                      {aw.accReps[key] || ex.reps} reps
                    </span>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      ))}

      {/* Finish Button */}
      {aw.isActive && (
        <button
          onClick={() => setShowFinishAlert(true)}
          className="w-full py-3 rounded-xl font-semibold text-[var(--color-green)] bg-[#1c1c1e] text-center"
        >
          Finish Workout
        </button>
      )}

      {/* Rest Timer */}
      {aw.showRestTimer && aw.lastSetTime && (
        <div className="fixed bottom-14 left-0 right-0 z-40">
          <RestTimer lastSetTime={aw.lastSetTime} onDismiss={() => updateAW({ showRestTimer: false })} />
        </div>
      )}

      {/* Finish Alert */}
      {showFinishAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setShowFinishAlert(false)}>
          <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold mb-2">Finish Workout?</h3>
            <p className="text-sm text-[#8e8e93] mb-5">This will save your workout and move to the next session.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishAlert(false)} className="flex-1 py-2 rounded-lg bg-[#38383a] text-sm">Cancel</button>
              <button onClick={finishWorkout} className="flex-1 py-2 rounded-lg bg-[var(--color-green)] text-sm font-semibold text-white">
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================
// Main Set Card
// ============================================================

function MainSetCard({
  set, index, isActive, isCompleted, amrapReps, setAmrapReps, bestE1RM, minRepsToBeat,
  overrideWeight, overrideReps, onWeightChange, onRepsChange, onToggle,
}: {
  set: PrescribedSet
  index: number
  isActive: boolean
  isCompleted: boolean
  amrapReps: number
  setAmrapReps: (v: number) => void
  bestE1RM: number | null
  minRepsToBeat: (target: number, weight: number) => number | null
  overrideWeight: string | undefined
  overrideReps: string | undefined
  onWeightChange: (value: string) => void
  onRepsChange: (value: string) => void
  onToggle: () => void
}) {
  // Tap-to-edit: track which field is being edited
  const [editingField, setEditingField] = useState<'weight' | 'reps' | null>(null)
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)

  // Effective values for display / PR calculation
  const displayWeight = (overrideWeight !== undefined && overrideWeight !== '')
    ? Number(overrideWeight) || set.weight
    : set.weight
  const displayReps = (overrideReps !== undefined && overrideReps !== '')
    ? Number(overrideReps) || set.targetReps
    : set.targetReps

  const prTarget = bestE1RM !== null ? minRepsToBeat(bestE1RM, displayWeight) : null

  const weightInputValue = overrideWeight !== undefined ? overrideWeight : String(set.weight)
  const repsInputValue = overrideReps !== undefined ? overrideReps : String(set.targetReps)

  // Auto-select input text when entering edit mode
  function startEditWeight(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive || isCompleted) return
    // Seed the override with the prescribed value if not already overridden
    if (overrideWeight === undefined) onWeightChange(String(set.weight))
    setEditingField('weight')
    setTimeout(() => weightRef.current?.select(), 0)
  }

  function startEditReps(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive || isCompleted) return
    if (overrideReps === undefined) onRepsChange(String(set.targetReps))
    setEditingField('reps')
    setTimeout(() => repsRef.current?.select(), 0)
  }

  const isWeightEdited = overrideWeight !== undefined && overrideWeight !== '' && Number(overrideWeight) !== set.weight
  const isRepsEdited = overrideReps !== undefined && overrideReps !== '' && Number(overrideReps) !== set.targetReps

  return (
    <div
      className={`py-3 ${isCompleted && !set.isAMRAP ? 'opacity-50' : ''} ${isActive ? 'cursor-pointer' : ''}`}
      onClick={onToggle}
    >
      <div className="flex items-center gap-3">
        <span className={`text-xl ${isCompleted ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
          {isCompleted ? '✓' : '○'}
        </span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-[10px] font-semibold uppercase ${set.isWarmup ? 'text-[#8e8e93]' : set.isSupplemental ? 'text-[var(--color-yellow)]' : 'text-[var(--color-accent)]'}`}>
              {set.isWarmup ? 'Warmup' : set.isSupplemental ? '5x5' : 'Working'}
            </span>
            <span className="text-[10px] text-[#8e8e93]">{Math.round(set.percentage * 100)}%</span>
          </div>

          {/* Weight: tap text to edit, blur to close */}
          {editingField === 'weight' ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={weightRef}
                type="number"
                inputMode="decimal"
                value={weightInputValue}
                onChange={(e) => onWeightChange(e.target.value)}
                onBlur={() => setEditingField(null)}
                autoFocus
                className="w-16 text-sm font-semibold py-0.5 px-1"
              />
              <span className="text-xs text-[#8e8e93]">lbs</span>
            </div>
          ) : (
            <div
              className={`font-semibold text-sm ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isWeightEdited ? 'text-[var(--color-orange)]' : ''}`}
              onClick={startEditWeight}
            >
              {displayWeight > 0 ? `${displayWeight} lbs` : 'Bar'}
            </div>
          )}
          {displayWeight > BARBELL_WEIGHT && <PlateBreakdown weight={displayWeight} />}
        </div>

        {/* Reps display: tap to edit */}
        {!set.isAMRAP && editingField === 'reps' ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={repsRef}
              type="number"
              inputMode="numeric"
              value={repsInputValue}
              onChange={(e) => onRepsChange(e.target.value)}
              onBlur={() => setEditingField(null)}
              autoFocus
              className="w-12 text-center text-sm py-0.5 px-1"
            />
            <span className="text-xs text-[#8e8e93]">reps</span>
          </div>
        ) : !set.isAMRAP ? (
          <span
            className={`text-sm ${isCompleted ? 'text-[#8e8e93]' : ''} ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isRepsEdited ? 'text-[var(--color-orange)]' : ''}`}
            onClick={startEditReps}
          >
            {displayReps} reps
          </span>
        ) : null}

        {set.isAMRAP && isCompleted && <span className="text-sm font-bold text-[var(--color-green)]">{amrapReps} reps</span>}
        {set.isAMRAP && !isActive && !isCompleted && <span className="text-sm">{set.targetReps}+ reps</span>}
      </div>

      {/* AMRAP stepper + optional weight edit */}
      {set.isAMRAP && isActive && !isCompleted && (
        <div className="mt-2 ml-8 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <span className="text-xs text-[#8e8e93]">Reps:</span>
            <button
              onClick={() => setAmrapReps(Math.max(0, amrapReps - 1))}
              className="w-8 h-8 rounded-lg bg-[#38383a] text-center text-lg leading-8"
            >
              −
            </button>
            <span className="text-lg font-bold tabular-nums w-8 text-center">{amrapReps}</span>
            <button
              onClick={() => setAmrapReps(amrapReps + 1)}
              className="w-8 h-8 rounded-lg bg-[#38383a] text-center text-lg leading-8"
            >
              +
            </button>

            {/* PR hint */}
            {prTarget !== null && (
              <span className="text-[10px] text-[#8e8e93] ml-2">
                {prTarget}+ to beat PR ({Math.round(bestE1RM!)} lbs)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
