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
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())

  if (!profile) return null
  const lift = liftFromDay(profile.currentDay)
  if (!lift) return null

  const tm = useStore.getState().getTrainingMax(lift)
  const sets = prescribedSets(tm, profile.currentWeek)
  const accessories = customAccessories?.[lift] ?? getAccessories(lift)
  const totalAccSets = accessories.reduce((n, ex) => n + ex.sets, 0)

  const completedMain = useMemo(() => new Set(aw.completedMain), [aw.completedMain])
  const completedAccessory = useMemo(() => new Set(aw.completedAccessory), [aw.completedAccessory])

  // Split main sets into warmup+working and supplemental
  const warmupWorkingIndices = sets.map((s, i) => ({ set: s, index: i })).filter(({ set }) => !set.isSupplemental)
  const supplementalIndices = sets.map((s, i) => ({ set: s, index: i })).filter(({ set }) => set.isSupplemental)

  // Reset collapsed state when workout identity changes (e.g. after finishing a workout)
  useEffect(() => {
    setCollapsedSections(new Set())
  }, [profile.currentDay, profile.currentWeek, profile.cycleNumber])

  // Auto-collapse completed sections
  useEffect(() => {
    if (!aw.isActive) return
    setCollapsedSections((prev) => {
      const next = new Set(prev)

      const allWarmupWorkingDone = warmupWorkingIndices.length > 0 && warmupWorkingIndices.every(({ index }) => completedMain.has(index))
      if (allWarmupWorkingDone && !prev.has('warmup-working')) next.add('warmup-working')

      const allSuppDone = supplementalIndices.length > 0 && supplementalIndices.every(({ index }) => completedMain.has(index))
      if (allSuppDone && !prev.has('supplemental')) next.add('supplemental')

      for (const ex of accessories) {
        const sectionId = `acc-${ex.name}`
        const allDone = Array.from({ length: ex.sets }, (_, i) => `${ex.name}-${i}`).every((k) => completedAccessory.has(k))
        if (allDone && !prev.has(sectionId)) next.add(sectionId)
      }

      if (next.size !== prev.size) return next
      return prev
    })
  }, [aw.completedMain, aw.completedAccessory, aw.isActive])

  // Elapsed timer
  useEffect(() => {
    if (!aw.isActive || !aw.startTime) return
    setElapsed(Math.floor((Date.now() - aw.startTime) / 1000))
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - aw.startTime!) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [aw.isActive, aw.startTime])

  // ---- Helpers ----

  function toggleSection(sectionId: string) {
    setCollapsedSections((prev) => {
      const next = new Set(prev)
      if (next.has(sectionId)) next.delete(sectionId)
      else next.add(sectionId)
      return next
    })
  }

  function effectiveMainWeight(index: number): number {
    const override = aw.mainWeights?.[index]
    if (override !== undefined && override !== '') {
      const n = Number(override)
      if (n > 0) return n
    }
    return sets[index].weight
  }

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
      if ((ex.weightType === AccessoryWeightType.Standard || ex.weightType === AccessoryWeightType.Barbell) && last) {
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
    setCollapsedSections(new Set())
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

  const warmupWorkingComplete = warmupWorkingIndices.every(({ index }) => completedMain.has(index))
  const supplementalComplete = supplementalIndices.every(({ index }) => completedMain.has(index))

  // ---- Render ----
  return (
    <div className="p-4 pb-2 space-y-4">
      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">Week {profile.currentWeek}: {liftDisplayName(lift)}</h1>
            <p className="text-sm text-[#8e8e93]">Cycle {profile.cycleNumber} · Day {profile.currentDay} of 4</p>
          </div>
          {aw.isActive && (
            <div className="text-right">
              <div className="text-xl font-medium tabular-nums">{fmtElapsed}</div>
              <div className="text-xs text-[#8e8e93]">Elapsed</div>
            </div>
          )}
        </div>
        {!aw.isActive && (
          <button
            onClick={startSession}
            className="w-full mt-3 py-3 rounded-xl bg-[var(--color-accent)] font-semibold text-white text-center text-base"
          >
            Start Workout
          </button>
        )}
      </div>

      {/* Rest Timer - sticky inline bar */}
      {aw.showRestTimer && aw.lastSetTime && (
        <RestTimer lastSetTime={aw.lastSetTime} onDismiss={() => updateAW({ showRestTimer: false })} />
      )}

      {/* Warmups + 5/3/1 Working Sets */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('warmup-working')}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm uppercase tracking-wider text-[#8e8e93]">Warmups + 5/3/1</h2>
            {aw.isActive && warmupWorkingComplete && (
              <span className="text-xs text-[var(--color-green)]">✓ {warmupWorkingIndices.length}/{warmupWorkingIndices.length}</span>
            )}
          </div>
          <span className={`text-[#8e8e93] text-sm transition-transform duration-200 ${collapsedSections.has('warmup-working') ? '' : 'rotate-90'}`}>
            ›
          </span>
        </button>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.has('warmup-working') ? '0fr' : '1fr',
            transition: 'grid-template-rows 300ms ease',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-3 divide-y divide-[#38383a]">
              {warmupWorkingIndices.map(({ set: s, index: i }) => (
                <MainSetCard
                  key={s.id}
                  set={s}
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
        </div>
      </div>

      {/* 5x5 Supplemental Sets */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <button
          onClick={() => toggleSection('supplemental')}
          className="w-full flex items-center justify-between px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <h2 className="text-sm uppercase tracking-wider text-[#8e8e93]">5x5 FSL – {liftDisplayName(lift)}</h2>
            {aw.isActive && supplementalComplete && (
              <span className="text-xs text-[var(--color-green)]">✓ {supplementalIndices.length}/{supplementalIndices.length}</span>
            )}
          </div>
          <span className={`text-[#8e8e93] text-sm transition-transform duration-200 ${collapsedSections.has('supplemental') ? '' : 'rotate-90'}`}>
            ›
          </span>
        </button>
        <div
          style={{
            display: 'grid',
            gridTemplateRows: collapsedSections.has('supplemental') ? '0fr' : '1fr',
            transition: 'grid-template-rows 300ms ease',
          }}
        >
          <div style={{ overflow: 'hidden' }}>
            <div className="px-4 pb-3 divide-y divide-[#38383a]">
              {supplementalIndices.map(({ set: s, index: i }) => (
                <MainSetCard
                  key={s.id}
                  set={s}
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
        </div>
      </div>

      {/* Accessories */}
      {accessories.map((ex) => {
        const sectionId = `acc-${ex.name}`
        const accKeys = Array.from({ length: ex.sets }, (_, i) => `${ex.name}-${i}`)
        const allAccDone = accKeys.every((k) => completedAccessory.has(k))
        return (
          <div key={ex.id} className="bg-[#1c1c1e] rounded-xl overflow-hidden">
            <button
              onClick={() => toggleSection(sectionId)}
              className="w-full flex items-center justify-between px-4 py-3 text-left"
            >
              <div className="flex items-center gap-2">
                <h2 className="text-sm uppercase tracking-wider text-[#8e8e93]">{ex.name}</h2>
                {aw.isActive && allAccDone && (
                  <span className="text-xs text-[var(--color-green)]">✓ {ex.sets}/{ex.sets}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-[#8e8e93]">{ex.sets}x{ex.reps}</span>
                <span className={`text-[#8e8e93] text-sm transition-transform duration-200 ${collapsedSections.has(sectionId) ? '' : 'rotate-90'}`}>
                  ›
                </span>
              </div>
            </button>
            <div
              style={{
                display: 'grid',
                gridTemplateRows: collapsedSections.has(sectionId) ? '0fr' : '1fr',
                transition: 'grid-template-rows 300ms ease',
              }}
            >
              <div style={{ overflow: 'hidden' }}>
                <div className="px-4 pb-3 divide-y divide-[#38383a]">
                  {Array.from({ length: ex.sets }, (_, si) => {
                    const key = `${ex.name}-${si}`
                    const completed = completedAccessory.has(key)
                    const accWeight = Number(aw.accWeights[key] || defaultWeight(ex)) || 0
                    return (
                      <div
                        key={key}
                        className={`py-4 ${completed ? 'opacity-50' : ''}`}
                      >
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() => toggleAccessory(key)}
                            className="flex items-center justify-center w-11 h-11 -ml-1 shrink-0"
                            aria-label={completed ? 'Mark incomplete' : 'Mark complete'}
                          >
                            <span className={`text-2xl ${completed ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                              {completed ? '✓' : '○'}
                            </span>
                          </button>
                          <span className="text-base">Set {si + 1}</span>
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
                                className="w-16 text-right text-base py-1 px-2"
                              />
                            ) : (
                              accWeight > 0 ? <span className="text-base text-[#8e8e93]">{Math.round(accWeight)} lbs</span> : null
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
                              className="w-14 text-center text-base py-1 px-1"
                            />
                          ) : (
                            <span className={`text-base ${completed ? 'text-[#8e8e93]' : ''}`}>
                              {aw.accReps[key] || ex.reps} reps
                            </span>
                          )}
                        </div>
                        {ex.weightType === AccessoryWeightType.Barbell && accWeight > BARBELL_WEIGHT && (
                          <div className="ml-10 mt-1">
                            <PlateBreakdown weight={accWeight} />
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )
      })}

      {/* Finish Button */}
      {aw.isActive && (
        <button
          onClick={() => setShowFinishAlert(true)}
          className="w-full py-3.5 rounded-xl font-semibold text-base text-[var(--color-green)] bg-[#1c1c1e] text-center"
        >
          Finish Workout
        </button>
      )}

      {/* Finish Alert */}
      {showFinishAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setShowFinishAlert(false)}>
          <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Finish Workout?</h3>
            <p className="text-base text-[#8e8e93] mb-5">This will save your workout and move to the next session.</p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishAlert(false)} className="flex-1 py-3 rounded-lg bg-[#38383a] text-base">Cancel</button>
              <button onClick={finishWorkout} className="flex-1 py-3 rounded-lg bg-[var(--color-green)] text-base font-semibold text-white">
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
  set, isActive, isCompleted, amrapReps, setAmrapReps, bestE1RM, minRepsToBeat,
  overrideWeight, overrideReps, onWeightChange, onRepsChange, onToggle,
}: {
  set: PrescribedSet
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
  const [editingField, setEditingField] = useState<'weight' | 'reps' | null>(null)
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)

  const displayWeight = (overrideWeight !== undefined && overrideWeight !== '')
    ? Number(overrideWeight) || set.weight
    : set.weight
  const displayReps = (overrideReps !== undefined && overrideReps !== '')
    ? Number(overrideReps) || set.targetReps
    : set.targetReps

  const prTarget = bestE1RM !== null ? minRepsToBeat(bestE1RM, displayWeight) : null

  const weightInputValue = overrideWeight !== undefined ? overrideWeight : String(set.weight)
  const repsInputValue = overrideReps !== undefined ? overrideReps : String(set.targetReps)

  function startEditWeight(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive || isCompleted) return
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
    <div className={`py-4 ${isCompleted && !set.isAMRAP ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-11 h-11 -ml-1 shrink-0"
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={`text-2xl ${isCompleted ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
            {isCompleted ? '✓' : '○'}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase ${set.isWarmup ? 'text-[#8e8e93]' : set.isSupplemental ? 'text-[var(--color-yellow)]' : 'text-[var(--color-accent)]'}`}>
              {set.isWarmup ? 'Warmup' : set.isSupplemental ? '5x5' : 'Working'}
            </span>
            <span className="text-xs text-[#8e8e93]">{Math.round(set.percentage * 100)}%</span>
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
                className="w-20 text-base font-semibold py-0.5 px-1"
              />
              <span className="text-sm text-[#8e8e93]">lbs</span>
            </div>
          ) : (
            <div
              className={`font-semibold text-base ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isWeightEdited ? 'text-[var(--color-orange)]' : ''}`}
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
              className="w-14 text-center text-base py-0.5 px-1"
            />
            <span className="text-sm text-[#8e8e93]">reps</span>
          </div>
        ) : !set.isAMRAP ? (
          <span
            className={`text-base ${isCompleted ? 'text-[#8e8e93]' : ''} ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isRepsEdited ? 'text-[var(--color-orange)]' : ''}`}
            onClick={startEditReps}
          >
            {displayReps} reps
          </span>
        ) : null}

        {set.isAMRAP && isCompleted && <span className="text-base font-bold text-[var(--color-green)]">{amrapReps} reps</span>}
        {set.isAMRAP && !isActive && !isCompleted && <span className="text-base">{set.targetReps}+ reps</span>}
      </div>

      {/* AMRAP stepper */}
      {set.isAMRAP && isActive && !isCompleted && (
        <div className="mt-3 ml-10 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8e8e93]">Reps:</span>
            <button
              onClick={() => setAmrapReps(Math.max(0, amrapReps - 1))}
              className="w-10 h-10 rounded-lg bg-[#38383a] text-center text-lg leading-10"
            >
              −
            </button>
            <span className="text-xl font-bold tabular-nums w-8 text-center">{amrapReps}</span>
            <button
              onClick={() => setAmrapReps(amrapReps + 1)}
              className="w-10 h-10 rounded-lg bg-[#38383a] text-center text-lg leading-10"
            >
              +
            </button>

            {prTarget !== null && (
              <span className="text-xs text-[#8e8e93] ml-2">
                {prTarget}+ to beat PR ({Math.round(bestE1RM!)} lbs)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
