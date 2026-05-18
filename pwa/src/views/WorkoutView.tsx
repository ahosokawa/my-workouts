import { useState, useEffect, useCallback, useMemo } from 'react'
import { useStore } from '../store'
import { liftDisplayName, AccessoryWeightType, ProgramType, ProgressionType, liftProgressionAmount, toDisplayWeight, toStorageLbs, displayRound } from '../types'
import type { AccessoryExercise } from '../types'
import { prescribedSets, amrapMinimum } from '../logic/calculator'
import { getVariantConfig } from '../logic/variants'
import { hypertrophyMainSets, mainLiftForDay, topSetRepRange, hypertrophyDayLabel } from '../logic/hypertrophyCalculator'
import {
  nextTopSetRpe, nextDoubleProgression, nextRepsThenLoad,
  recentMainLiftTopSets, lastAccessorySession,
} from '../logic/progression'
import { estimated1RM } from '../logic/brzycki'
import { calculateWilks } from '../logic/wilks'
import { barbellWeight } from '../logic/plates'
import PlateBreakdown from '../components/PlateBreakdown'
import RestTimer from '../components/RestTimer'
import { requestNotificationPermission } from '../notifications'
import MainSetCard from '../components/MainSetCard'
import CollapsibleSection from '../components/CollapsibleSection'
import { useElapsedTimer } from '../hooks/useElapsedTimer'

export default function WorkoutView() {
  const profile = useStore((s) => s.profile)
  const setLogs = useStore((s) => s.setLogs)
  const saveWorkout = useStore((s) => s.saveWorkout)
  const advanceDay = useStore((s) => s.advanceDay)
  const updateProfile = useStore((s) => s.updateProfile)
  const addWilksEntry = useStore((s) => s.addWilksEntry)
  const aw = useStore((s) => s.activeWorkout)
  const updateAW = useStore((s) => s.updateActiveWorkout)
  const clearAW = useStore((s) => s.clearActiveWorkout)
  const customAccessories = useStore((s) => s.customAccessories)
  const customSupplemental = useStore((s) => s.customSupplemental)

  const elapsed = useElapsedTimer(aw.isActive, aw.startTime)
  const [showFinishAlert, setShowFinishAlert] = useState(false)
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set())
  // Optional RIR self-report for the hypertrophy top set. 0/1/2/3+ or null.
  const [topSetRir, setTopSetRir] = useState<number | null>(null)

  if (!profile) return null
  const programType = profile.programType ?? ProgramType.FiveThreeOne
  const isHypertrophy = programType === ProgramType.Hypertrophy
  const lift = mainLiftForDay(programType, profile.currentDay, profile.dayOrder)

  // Hypertrophy day 4 (Pull Focus) has no top-set main lift — we render only accessories.
  // For 5/3/1, lift is always non-null; for hypertrophy day 4 we accept null.
  // The accessories list is keyed by the MainLift slot — Day 4 uses MainLift.ShoulderPress as the slot.
  const accessoriesSlot = lift ?? 4

  if (!lift && !isHypertrophy) return null  // 5/3/1 always needs a lift

  const units = profile.units ?? 'lbs'
  const tm = lift ? useStore.getState().getTrainingMax(lift) : 0
  const currentVariant = profile.currentVariant ?? 'fsl'
  const variantConfig = getVariantConfig(currentVariant)
  const suppOverride = (!isHypertrophy && lift) ? (customSupplemental?.[lift] ?? null) : null

  // Build the main-lift prescription. For hypertrophy with a top-set main, use the stored
  // top-set weight; the algorithm computes warmups off of it. For day 4 (no main), empty.
  const sets = (() => {
    if (!lift) return []
    if (isHypertrophy) {
      const topSetLbs = profile.hypertrophyTopSets?.[lift]
      if (!topSetLbs || topSetLbs <= 0) return []
      const range = topSetRepRange(lift)
      return hypertrophyMainSets(topSetLbs, range.min, range.max)
    }
    return prescribedSets(tm, profile.currentWeek, currentVariant, suppOverride?.trainingMaxLbs)
  })()

  const suppShowPlates = (suppOverride?.exercise.weightType ?? AccessoryWeightType.Barbell) === AccessoryWeightType.Barbell
  const suppDisplayName = suppOverride?.exercise.name ?? (lift ? liftDisplayName(lift) : '')
  const accessories = customAccessories?.[accessoriesSlot] ?? []
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
      if (n > 0) return n  // override is in display units
    }
    return displayRound(sets[index].weight, units)  // prescribed lbs → display units
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
      // Hypertrophy: prefer the progression algorithm's suggestion when it exists.
      if (isHypertrophy) {
        const s = accessorySuggestion(ex)
        if (s && s.weight > 0) return String(s.weight)
      }
      const last = setLogs
        .filter((l) => l.exerciseName === ex.name && !l.isMainLift && l.isCompleted && l.weight > 0)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        [0]

      if (ex.weightType === AccessoryWeightType.Bodyweight) {
        if (profile?.bodyWeightLbs && profile.bodyWeightLbs > 0) return String(displayRound(profile.bodyWeightLbs, units))
        if (last) return String(displayRound(last.weight, units))
      }
      if ((ex.weightType === AccessoryWeightType.Standard || ex.weightType === AccessoryWeightType.Barbell) && last) {
        return String(displayRound(last.weight, units))
      }
      return ''
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setLogs, profile, units, isHypertrophy],
  )

  const defaultReps = useCallback(
    (ex: AccessoryExercise): string => {
      if (isHypertrophy) {
        const s = accessorySuggestion(ex)
        if (s) return String(s.reps)
        if (ex.repRangeMin !== undefined) return String(ex.repRangeMin)
      }
      const last = setLogs
        .filter((l) => l.exerciseName === ex.name && !l.isMainLift && l.isCompleted)
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        [0]
      return last ? String(last.targetReps) : String(ex.reps)
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [setLogs, isHypertrophy],
  )

  function currentBestE1RM(): number | null {
    if (!lift) return null
    const logs = setLogs.filter(
      (l) => l.exerciseName === liftDisplayName(lift) && l.isAMRAP && l.isMainLift && l.isCompleted && l.actualReps != null,
    )
    let best: number | null = null
    for (const l of logs) {
      const e = estimated1RM(l.weight, l.actualReps!)
      if (e !== null && (best === null || e > best)) best = e
    }
    return best
  }

  // ---- Hypertrophy progression suggestions ----

  /** For the current main lift in hypertrophy mode, what does the algorithm
   *  suggest for next session? Used to update profile.hypertrophyTopSets on save. */
  function computeNextHypertrophyTopSet(actualReps: number, rir: number | null): { weightLbs: number; message: string } | null {
    if (!isHypertrophy || !lift || !profile) return null
    const currentTopLbs = profile.hypertrophyTopSets?.[lift] ?? 0
    if (currentTopLbs <= 0) return null
    const range = topSetRepRange(lift)
    const recent = recentMainLiftTopSets(setLogs, lift, 3).map((l) => ({
      weightLbs: l.weight,
      actualReps: l.actualReps ?? 0,
    }))
    const out = nextTopSetRpe({
      currentTopSetLbs: currentTopLbs,
      lastActualReps: actualReps,
      lastRir: rir,
      repRangeMin: range.min,
      repRangeMax: range.max,
      incrementLbs: liftProgressionAmount(lift, 'lbs'),
      recentHistory: recent,
    })
    return { weightLbs: out.weightLbs, message: out.message }
  }

  /** Suggested next set for an accessory based on its progressionType and history. */
  function accessorySuggestion(ex: AccessoryExercise): { weight: number; reps: number; message: string } | null {
    if (!isHypertrophy) return null
    const pType = ex.progressionType ?? ProgressionType.Fixed
    if (pType === ProgressionType.Fixed || pType === ProgressionType.RepsOnly || pType === ProgressionType.RomStages) return null
    const range = ex.repRangeMin !== undefined && ex.repRangeMax !== undefined
      ? { min: ex.repRangeMin, max: ex.repRangeMax }
      : { min: Math.max(1, ex.reps - 2), max: ex.reps }
    const last = lastAccessorySession(setLogs, ex.name)
    if (!last) return null
    if (pType === ProgressionType.RepsThenLoad) {
      const s = nextRepsThenLoad({
        lastSession: last,
        bodyWeightLbs: ex.weightType === AccessoryWeightType.Bodyweight ? (profile?.bodyWeightLbs ?? 0) : 0,
        repRangeMin: range.min,
        repRangeMax: range.max,
        incrementLbs: 5,
      })
      return { weight: displayRound(s.weightLbs, units), reps: s.targetReps, message: s.message }
    }
    const s = nextDoubleProgression({
      lastSession: last,
      repRangeMin: range.min,
      repRangeMax: range.max,
      incrementLbs: 5,
    })
    return { weight: displayRound(s.weightLbs, units), reps: s.targetReps, message: s.message }
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

  const restNotifyEnabled = useStore((s) => s.restNotifyEnabled)

  function startSession() {
    if (restNotifyEnabled) requestNotificationPermission()
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
    setTopSetRir(null)
    // Default top-set reps: bottom of range for hypertrophy, AMRAP minimum for 5/3/1.
    const startingReps = isHypertrophy && lift
      ? topSetRepRange(lift).min
      : amrapMinimum(profile!.currentWeek)
    updateAW({
      isActive: true,
      startTime: Date.now(),
      amrapReps: startingReps,
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

  function toggleSet(type: 'main', index: number): void
  function toggleSet(type: 'accessory', key: string): void
  function toggleSet(type: 'main' | 'accessory', id: number | string) {
    if (!aw.isActive) return

    if (type === 'main') {
      const index = id as number
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
    } else {
      const key = id as string
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
    if (!profile) return
    const duration = aw.startTime ? Math.floor((Date.now() - aw.startTime) / 1000) : 0

    const logEntries: Parameters<typeof saveWorkout>[1] = []

    let curAmrapWeight = 0
    let curAmrapReps = 0
    for (let i = 0; i < sets.length; i++) {
      const s = sets[i]
      const completed = completedMain.has(i)
      const weight = effectiveMainWeight(i)  // in display units
      const weightLbs = toStorageLbs(weight, units)  // convert to lbs for storage
      const reps = effectiveMainReps(i)
      const exerciseName = s.isSupplemental && suppOverride
        ? suppOverride.exercise.name
        : (lift ? liftDisplayName(lift) : 'Main Lift')
      logEntries.push({
        exerciseName,
        isMainLift: true,
        setIndex: i,
        weight: weightLbs,
        targetReps: reps,
        actualReps: s.isAMRAP ? aw.amrapReps : null,
        isAMRAP: s.isAMRAP,
        isCompleted: completed,
        completedAt: completed ? new Date().toISOString() : null,
        // Persist RIR on the hypertrophy top-set only (the lone AMRAP entry).
        ...(s.isAMRAP && isHypertrophy && completed ? { rir: topSetRir } : {}),
      })
      if (s.isAMRAP && completed) {
        curAmrapWeight = weightLbs
        curAmrapReps = aw.amrapReps
      }
    }

    for (const ex of accessories) {
      for (let i = 0; i < ex.sets; i++) {
        const key = `${ex.name}-${i}`
        const completed = completedAccessory.has(key)
        const accW = Number(aw.accWeights[key] || '0') || 0
        logEntries.push({
          exerciseName: ex.name,
          isMainLift: false,
          setIndex: i,
          weight: toStorageLbs(accW, units),  // user entered in display units
          targetReps: Number(aw.accReps[key] || String(ex.reps)) || ex.reps,
          actualReps: null,
          isAMRAP: false,
          isCompleted: completed,
          completedAt: completed ? new Date().toISOString() : null,
        })
      }
    }

    saveWorkout(
      {
        date: new Date().toISOString(),
        liftRawValue: lift ?? 0,  // 0 = no main lift (hypertrophy Pull day)
        week: profile.currentWeek,
        cycleNumber: profile.cycleNumber,
        durationSeconds: duration,
        variant: currentVariant,
      },
      logEntries,
    )

    // Hypertrophy: bump the stored top-set weight for next session via the autoprogression algo.
    if (isHypertrophy && lift && curAmrapReps > 0) {
      const next = computeNextHypertrophyTopSet(curAmrapReps, topSetRir)
      if (next) {
        updateProfile({
          hypertrophyTopSets: {
            ...(profile.hypertrophyTopSets ?? {}),
            [lift]: next.weightLbs,
          },
        })
      }
    }

    // Wilks
    if (profile.bodyWeightLbs && profile.bodyWeightLbs > 0) {
      const allLogs = useStore.getState().setLogs
      const liftName = lift ? liftDisplayName(lift) : null
      const bestFor = (name: string) => {
        let best = 0
        for (const l of allLogs) {
          if (l.exerciseName === name && l.isAMRAP && l.isMainLift && l.isCompleted && l.actualReps != null) {
            const e = estimated1RM(l.weight, l.actualReps)
            if (e !== null && e > best) best = e
          }
        }
        if (liftName && name === liftName && curAmrapReps > 0) {
          const e = estimated1RM(curAmrapWeight, curAmrapReps)
          if (e !== null && e > best) best = e
        }
        return best
      }
      const sq = bestFor('Squat')
      const bp = bestFor('Bench Press')
      const dl = bestFor('Deadlift')
      if (sq > 0 || bp > 0 || dl > 0) {
        const w = calculateWilks(profile.bodyWeightLbs, sq, bp, dl, profile.sex ?? 'male', 'lbs')
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

  const completionBadge = (done: boolean, count: number) =>
    aw.isActive && done ? <span className="text-xs text-[var(--color-green)]">✓ {count}/{count}</span> : undefined

  // ---- Render ----
  return (
    <div className="p-4 pb-2 space-y-4">
      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold">
              Week {profile.currentWeek}:{' '}
              {isHypertrophy
                ? hypertrophyDayLabel(profile.currentDay)
                : (lift ? liftDisplayName(lift) : '')}
            </h1>
            <p className="text-sm text-[#8e8e93]">
              Cycle {profile.cycleNumber} · Day {profile.currentDay} of 4
              {isHypertrophy ? ' · Hypertrophy' : ` · ${variantConfig.shortLabel}`}
            </p>
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
        <RestTimer lastSetTime={aw.lastSetTime} />
      )}

      {/* Warmups + Top Set (hypertrophy) or Warmups + 5/3/1 working sets */}
      {sets.length > 0 && (
        <CollapsibleSection
          title={isHypertrophy ? `Warmups + Top Set – ${lift ? liftDisplayName(lift) : ''}` : 'Warmups + 5/3/1'}
          isCollapsed={collapsedSections.has('warmup-working')}
          onToggle={() => toggleSection('warmup-working')}
          badge={completionBadge(warmupWorkingComplete, warmupWorkingIndices.length)}
        >
          {warmupWorkingIndices.map(({ set: s, index: i }) => (
            <div key={s.id}>
              <MainSetCard
                set={s}
                isActive={aw.isActive}
                isCompleted={completedMain.has(i)}
                amrapReps={aw.amrapReps}
                setAmrapReps={(v) => updateAW({ amrapReps: v })}
                bestE1RM={bestE1RM !== null ? toDisplayWeight(bestE1RM, units) : null}
                minRepsToBeat={minRepsToBeat}
                overrideWeight={aw.mainWeights?.[i]}
                overrideReps={aw.mainReps?.[i]}
                onWeightChange={(v) => updateMainWeight(i, v)}
                onRepsChange={(v) => updateMainReps(i, v)}
                onToggle={() => toggleSet('main', i)}
                units={units}
                showPercentage={!isHypertrophy}
              />
              {/* RIR picker — only on the hypertrophy top set, while active and not yet completed */}
              {isHypertrophy && s.isAMRAP && aw.isActive && !completedMain.has(i) && (
                <div className="ml-10 mb-3 mt-1" onClick={(e) => e.stopPropagation()}>
                  <div className="text-xs text-[#8e8e93] mb-1.5">RIR (optional — reps left in the tank)</div>
                  <div className="flex gap-1.5">
                    {[0, 1, 2, 3].map((r) => {
                      const selected = topSetRir === r
                      return (
                        <button
                          key={r}
                          onClick={() => setTopSetRir(selected ? null : r)}
                          className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                            selected ? 'bg-[var(--color-accent)] text-white' : 'bg-[#38383a] text-[#8e8e93]'
                          }`}
                        >
                          {r === 3 ? '3+' : r}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          ))}
        </CollapsibleSection>
      )}

      {/* 5/3/1 Supplemental Sets — not present in hypertrophy */}
      {!isHypertrophy && supplementalIndices.length > 0 && (
        <CollapsibleSection
          title={`${variantConfig.shortLabel} ${variantConfig.supplementalSets}×${variantConfig.supplementalReps} – ${suppDisplayName}`}
          isCollapsed={collapsedSections.has('supplemental')}
          onToggle={() => toggleSection('supplemental')}
          badge={completionBadge(supplementalComplete, supplementalIndices.length)}
        >
          {supplementalIndices.map(({ set: s, index: i }) => (
            <MainSetCard
              key={s.id}
              set={s}
              isActive={aw.isActive}
              isCompleted={completedMain.has(i)}
              amrapReps={aw.amrapReps}
              setAmrapReps={(v) => updateAW({ amrapReps: v })}
              bestE1RM={bestE1RM !== null ? toDisplayWeight(bestE1RM, units) : null}
              minRepsToBeat={minRepsToBeat}
              overrideWeight={aw.mainWeights?.[i]}
              overrideReps={aw.mainReps?.[i]}
              onWeightChange={(v) => updateMainWeight(i, v)}
              onRepsChange={(v) => updateMainReps(i, v)}
              onToggle={() => toggleSet('main', i)}
              units={units}
              showPlates={suppShowPlates}
            />
          ))}
        </CollapsibleSection>
      )}

      {/* Accessories */}
      {accessories.map((ex) => {
        const sectionId = `acc-${ex.name}`
        const accKeys = Array.from({ length: ex.sets }, (_, i) => `${ex.name}-${i}`)
        const allAccDone = accKeys.every((k) => completedAccessory.has(k))
        const repsLabel =
          ex.repRangeMin !== undefined && ex.repRangeMax !== undefined
            ? `${ex.repRangeMin}-${ex.repRangeMax}`
            : String(ex.reps)
        const suggestion = accessorySuggestion(ex)
        return (
          <CollapsibleSection
            key={ex.id}
            title={ex.name}
            isCollapsed={collapsedSections.has(sectionId)}
            onToggle={() => toggleSection(sectionId)}
            badge={completionBadge(allAccDone, ex.sets)}
            trailing={<span className="text-xs text-[#8e8e93]">{ex.sets}x{repsLabel}</span>}
          >
            {ex.notes && (
              <div className="text-xs text-[#8e8e93] -mt-1 mb-2">{ex.notes}</div>
            )}
            {suggestion && (
              <div className="text-xs text-[var(--color-accent)] mb-2">{suggestion.message}</div>
            )}
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
                      onClick={() => toggleSet('accessory', key)}
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
                          placeholder={units}
                          value={aw.accWeights[key] ?? ''}
                          onChange={(e) => { e.stopPropagation(); updateAccWeight(ex, si, e.target.value) }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-16 text-right text-base py-1 px-2"
                        />
                      ) : (
                        accWeight > 0 ? <span className="text-base text-[#8e8e93]">{Math.round(accWeight)} {units}</span> : null
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
                        {aw.accReps[key] || repsLabel} reps
                      </span>
                    )}
                  </div>
                  {ex.weightType === AccessoryWeightType.Barbell && accWeight > barbellWeight(units) && (
                    <div className="ml-10 mt-1">
                      <PlateBreakdown weight={accWeight} units={units} />
                    </div>
                  )}
                </div>
              )
            })}
          </CollapsibleSection>
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
