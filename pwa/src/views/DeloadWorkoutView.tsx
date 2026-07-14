import { useState, useRef } from 'react'
import { useStore } from '../store'
import { liftDisplayName, displayRound, toStorageLbs, trainingMaxFor } from '../types'
import type { DeloadType, MainLift, UserProfile } from '../types'
import { getProgram, getProgramAccessories, programDayLabel, slotForDay } from '../logic/programs'
import { deloadDayPlan } from '../logic/deload'
import { suggestedTMFromRetest, reseedTopSetFromTM } from '../logic/tmRetest'
import { estimated1RM } from '../logic/brzycki'
import { barbellWeight } from '../logic/plates'
import PlateBreakdown from '../components/PlateBreakdown'

const TM_FIELD: Record<MainLift, 'squatTM' | 'benchTM' | 'deadliftTM' | 'pressTM'> = {
  1: 'squatTM',
  2: 'benchTM',
  3: 'deadliftTM',
  4: 'pressTM',
}

export default function DeloadWorkoutView() {
  const profile = useStore((s) => s.profile)
  if (!profile || !profile.deloadType) return null
  return <DeloadWorkoutViewInner profile={profile} />
}

function DeloadWorkoutViewInner({ profile }: { profile: UserProfile }) {
  const advanceDeloadDay = useStore((s) => s.advanceDeloadDay)
  const saveWorkout = useStore((s) => s.saveWorkout)
  const updateProfile = useStore((s) => s.updateProfile)
  const customAccessories = useStore((s) => s.customAccessories)
  const [completedSets, setCompletedSets] = useState<Set<number>>(new Set())
  const [completedAcc, setCompletedAcc] = useState<Set<string>>(new Set())
  const [showFinishAlert, setShowFinishAlert] = useState(false)
  // Retest-day captures (display units for weight)
  const [retestWeight, setRetestWeight] = useState('')
  const [retestReps, setRetestReps] = useState('')
  const [retestRir, setRetestRir] = useState<number | null>(null)
  const [editedTM, setEditedTM] = useState('')
  const finishingRef = useRef(false)

  const units = profile.units ?? 'lbs'
  const def = getProgram(profile.programType)
  const deloadType: DeloadType = profile.deloadType!
  const day = profile.deloadDay

  const slot = slotForDay(def, day, profile.dayOrder)
  const dayAccessories = slot ? (customAccessories?.[slot] ?? getProgramAccessories(def.id, slot)) : []
  const plan = deloadDayPlan(def, deloadType, day, {
    tmLbs: (() => {
      const lift = slot // deloadDayPlan re-resolves; TM only matters when the day has a main
      return lift ? trainingMaxFor(profile, lift) : 0
    })(),
    dayOrder: profile.dayOrder,
    accessories: dayAccessories,
  })
  const lift = plan.lift

  const typeLabel = deloadType === 'tm_test' ? 'TM Test' : 'Deload'
  const topSetIndex = plan.mainSets.findIndex((s) => s.isAMRAP)
  const topSetDone = topSetIndex >= 0 && completedSets.has(topSetIndex)

  // Retest math (live, from the user's entered weight/reps)
  const retestWeightLbs = toStorageLbs(Number(retestWeight) || 0, units)
  const retestRepsNum = Number(retestReps) || 0
  const retestE1RM = plan.isRetestDay && retestWeightLbs > 0 && retestRepsNum > 0
    ? estimated1RM(retestWeightLbs, retestRepsNum)
    : null
  const suggestedTM = plan.isRetestDay && retestWeightLbs > 0 && retestRepsNum > 0
    ? suggestedTMFromRetest(retestWeightLbs, retestRepsNum, units)
    : null
  const effectiveTmLbs = (() => {
    const edited = toStorageLbs(Number(editedTM) || 0, units)
    if (edited > 0) return edited
    return suggestedTM
  })()

  function toggleSet(index: number) {
    setCompletedSets((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function toggleAcc(key: string) {
    setCompletedAcc((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function finishDeloadDay() {
    if (!profile) return
    // Double-tap guard: saveWorkout/advanceDeloadDay are not idempotent. The
    // fresh getState() read catches taps landing after the first call advanced
    // the deload day (or ended the deload); the ref catches same-tick reentry.
    const fresh = useStore.getState().profile
    if (finishingRef.current || !fresh?.isDeloading || fresh.deloadDay !== profile.deloadDay) return
    finishingRef.current = true
    try {
      finishDeloadDayInner()
    } finally {
      finishingRef.current = false
    }
  }

  function finishDeloadDayInner() {
    if (!profile) return

    // Main-lift sets are logged (week 0 = deload). Accessory sets are a guide
    // only — logging their reduced volume would skew the double-progression
    // suggestions that read the most recent session.
    if (lift && plan.mainSets.length > 0) {
      const logEntries = plan.mainSets.map((s, i) => {
        const isRetestTop = plan.isRetestDay && s.isAMRAP
        const weight = isRetestTop && retestWeightLbs > 0 ? retestWeightLbs : s.weight
        return {
          exerciseName: liftDisplayName(lift),
          isMainLift: true,
          setIndex: i,
          weight,
          targetReps: s.targetReps,
          actualReps: isRetestTop && completedSets.has(i) && retestRepsNum > 0 ? retestRepsNum : null,
          isAMRAP: s.isAMRAP,
          isCompleted: completedSets.has(i),
          completedAt: completedSets.has(i) ? new Date().toISOString() : null,
          ...(isRetestTop && completedSets.has(i) ? { rir: retestRir } : {}),
          // Persist the prescribed rep-range so history can tell top sets from true AMRAPs.
          ...(s.repRangeMin !== undefined ? { repRangeMin: s.repRangeMin, repRangeMax: s.repRangeMax } : {}),
        }
      })

      saveWorkout(
        {
          date: new Date().toISOString(),
          liftRawValue: lift,
          week: 0, // week 0 = deload
          cycleNumber: profile.cycleNumber,
          durationSeconds: 0,
          variant: profile.currentVariant,
        },
        logEntries,
      )

      // Retest: apply the (possibly edited) new TM and reseed the top set.
      if (plan.isRetestDay && topSetDone && effectiveTmLbs && effectiveTmLbs > 0) {
        updateProfile({
          [TM_FIELD[lift]]: effectiveTmLbs,
          hypertrophyTopSets: {
            ...(profile.hypertrophyTopSets ?? {}),
            [lift]: reseedTopSetFromTM(def, effectiveTmLbs, units),
          },
        })
      }
    }

    setCompletedSets(new Set())
    setCompletedAcc(new Set())
    setRetestWeight('')
    setRetestReps('')
    setRetestRir(null)
    setEditedTM('')
    advanceDeloadDay()
    setShowFinishAlert(false)
  }

  const dayTitle = lift ? liftDisplayName(lift) : programDayLabel(def, day, profile.dayOrder)
  const nextDayLabel = day < 4 ? programDayLabel(def, day + 1, profile.dayOrder) : null

  return (
    <div className="p-4 pb-2 space-y-4">
      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <h1 className="text-xl font-bold">{typeLabel}: {dayTitle}</h1>
        <p className="text-sm text-[#8e8e93]">
          {typeLabel} Week · Day {day} of 4
        </p>
      </div>

      {/* Main sets */}
      {plan.mainSets.length > 0 && (
        <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">
              {plan.isRetestDay
                ? 'Work Up to a Hard Top Set — RPE 8-9 (1-2 RIR)'
                : deloadType === 'tm_test' ? 'Work Up to TM' : 'Deload Sets'}
            </h2>
          </div>
          <div className="px-4 pb-3 divide-y divide-[#38383a]">
            {plan.mainSets.map((s, i) => {
              const completed = completedSets.has(i)
              const isRetestTop = plan.isRetestDay && s.isAMRAP
              const w = displayRound(s.weight, units)
              return (
                <div key={s.id} className={`py-4 ${completed ? 'opacity-50' : ''}`}>
                  <div className="flex items-center gap-3" onClick={() => toggleSet(i)}>
                    <span className={`text-2xl ${completed ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                      {completed ? '✓' : '○'}
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold uppercase ${s.isWarmup ? 'text-[#8e8e93]' : 'text-[var(--color-accent)]'}`}>
                          {s.isWarmup ? 'Warmup' : isRetestTop ? 'Retest Top Set' : 'Working'}
                        </span>
                        <span className="text-xs text-[#8e8e93]">{Math.round(s.percentage * 100)}%{isRetestTop ? ' start' : ''}</span>
                      </div>
                      <div className="font-semibold text-base">
                        {w > 0 ? `${w} ${units}` : 'Bar'}
                      </div>
                      {w > barbellWeight(units) && <PlateBreakdown weight={w} units={units} />}
                    </div>
                    <span className="text-base">
                      {isRetestTop && s.repRangeMin !== undefined && s.repRangeMax !== undefined
                        ? `${s.repRangeMin}-${s.repRangeMax} reps`
                        : `${s.targetReps} ${s.targetReps === 1 ? 'rep' : 'reps'}`}
                    </span>
                  </div>

                  {/* Retest capture: what did the top set actually look like? */}
                  {isRetestTop && (
                    <div className="ml-10 mt-2 space-y-2" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center gap-2">
                        <input
                          type="number"
                          inputMode="decimal"
                          placeholder={`weight (${units})`}
                          value={retestWeight}
                          onChange={(e) => setRetestWeight(e.target.value)}
                          className="w-24 text-right text-sm py-1 px-2"
                        />
                        <span className="text-xs text-[#8e8e93]">×</span>
                        <input
                          type="number"
                          inputMode="numeric"
                          placeholder="reps"
                          value={retestReps}
                          onChange={(e) => setRetestReps(e.target.value)}
                          className="w-16 text-center text-sm py-1 px-1"
                        />
                      </div>
                      <div>
                        <div className="text-xs text-[#8e8e93] mb-1">RIR (reps left in the tank)</div>
                        <div className="flex gap-1.5 max-w-56">
                          {[0, 1, 2, 3].map((r) => (
                            <button
                              key={r}
                              onClick={() => setRetestRir(retestRir === r ? null : r)}
                              className={`flex-1 py-1.5 text-xs font-semibold rounded-md ${
                                retestRir === r ? 'bg-[var(--color-accent)] text-white' : 'bg-[#38383a] text-[#8e8e93]'
                              }`}
                            >
                              {r === 3 ? '3+' : r}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Retest result → new TM suggestion */}
      {plan.isRetestDay && retestE1RM !== null && suggestedTM !== null && (
        <div className="bg-[#1c1c1e] rounded-xl p-4 space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">New Training Max</h2>
          <div className="text-sm text-[#8e8e93]">
            e1RM ≈ <span className="text-white font-semibold">{displayRound(retestE1RM, units)} {units}</span>
            {' → '}suggested TM (85%): <span className="text-[var(--color-accent)] font-semibold">{displayRound(suggestedTM, units)} {units}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm">TM</span>
            <input
              type="number"
              inputMode="decimal"
              placeholder={String(displayRound(suggestedTM, units))}
              value={editedTM}
              onChange={(e) => setEditedTM(e.target.value)}
              className="w-24 text-right text-sm py-1 px-2"
            />
            <span className="text-xs text-[#8e8e93]">{units}</span>
          </div>
          {effectiveTmLbs && effectiveTmLbs > 0 && (
            <div className="text-xs text-[#8e8e93]">
              Next cycle's top set starts at{' '}
              <span className="text-white">{displayRound(reseedTopSetFromTM(def, effectiveTmLbs, units), units)} {units}</span>.
              Applied when you finish this day.
            </div>
          )}
        </div>
      )}

      {/* Accessories (volume-scaled) */}
      {plan.accessories.length > 0 && (
        <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Accessories — Half Volume</h2>
          </div>
          <div className="px-4 pb-3 divide-y divide-[#38383a]">
            {plan.accessories.map((ex) => {
              const repsLabel = ex.repRangeMin !== undefined && ex.repRangeMax !== undefined
                ? `${ex.repRangeMin}-${ex.repRangeMax}`
                : String(ex.reps)
              return (
                <div key={ex.id} className="py-3">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">{ex.name}</span>
                    <span className="text-xs text-[#8e8e93]">{ex.sets}x{repsLabel}</span>
                  </div>
                  <div className="flex gap-2">
                    {Array.from({ length: ex.sets }, (_, si) => {
                      const key = `${ex.name}-${si}`
                      const done = completedAcc.has(key)
                      return (
                        <button
                          key={key}
                          onClick={() => toggleAcc(key)}
                          className={`flex-1 py-1.5 rounded-md text-xs font-semibold ${
                            done ? 'bg-[var(--color-green)] text-white' : 'bg-[#38383a] text-[#8e8e93]'
                          }`}
                        >
                          {done ? '✓' : `Set ${si + 1}`}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
            <p className="text-xs text-[#8e8e93] pt-2">
              Light effort — deload accessories aren't logged, so they won't skew progression suggestions.
            </p>
          </div>
        </div>
      )}

      {/* Finish Button */}
      <button
        onClick={() => setShowFinishAlert(true)}
        className="w-full py-3.5 rounded-xl font-semibold text-base text-[var(--color-green)] bg-[#1c1c1e] text-center"
      >
        Finish {typeLabel}
      </button>

      {/* Finish Alert */}
      {showFinishAlert && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setShowFinishAlert(false)}>
          <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <h3 className="font-semibold text-lg mb-2">Finish {typeLabel}?</h3>
            <p className="text-base text-[#8e8e93] mb-5">
              {plan.isRetestDay && topSetDone && effectiveTmLbs && effectiveTmLbs > 0 && lift
                ? `${liftDisplayName(lift)} TM will update to ${displayRound(effectiveTmLbs, units)} ${units}. `
                : ''}
              {nextDayLabel
                ? `Moving to Day ${day + 1}: ${nextDayLabel}`
                : 'This is the last deload day. You\'ll set up your next cycle after this.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowFinishAlert(false)} className="flex-1 py-3 rounded-lg bg-[#38383a] text-base">Cancel</button>
              <button onClick={finishDeloadDay} className="flex-1 py-3 rounded-lg bg-[var(--color-green)] text-base font-semibold text-white">
                Finish
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
