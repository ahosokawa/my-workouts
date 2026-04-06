import { useState } from 'react'
import { useStore } from '../store'
import { liftDisplayName, liftFromDay, displayRound } from '../types'
import type { DeloadType } from '../types'
import { deloadSets } from '../logic/calculator'
import { barbellWeight } from '../logic/plates'
import PlateBreakdown from '../components/PlateBreakdown'

export default function DeloadWorkoutView() {
  const profile = useStore((s) => s.profile)
  const advanceDeloadDay = useStore((s) => s.advanceDeloadDay)
  const saveWorkout = useStore((s) => s.saveWorkout)
  const [completedSets, setCompletedSets] = useState<Set<number>>(new Set())
  const [showFinishAlert, setShowFinishAlert] = useState(false)

  if (!profile || !profile.deloadType) return null

  const lift = liftFromDay(profile.deloadDay)
  if (!lift) return null

  const units = profile.units ?? 'lbs'
  const tm = (() => {
    switch (lift) {
      case 1: return profile.squatTM
      case 2: return profile.benchTM
      case 3: return profile.deadliftTM
      case 4: return profile.pressTM
      default: return profile.squatTM
    }
  })()

  const deloadType: DeloadType = profile.deloadType
  const sets = deloadSets(tm, deloadType)
  const typeLabel = deloadType === 'tm_test' ? 'TM Test' : 'Deload'

  function toggleSet(index: number) {
    setCompletedSets((prev) => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function finishDeloadDay() {
    if (!profile || !lift) return
    const logEntries = sets.map((s, i) => ({
      exerciseName: liftDisplayName(lift),
      isMainLift: true,
      setIndex: i,
      weight: s.weight,  // already in lbs from deloadSets
      targetReps: s.targetReps,
      actualReps: null,
      isAMRAP: false,
      isCompleted: completedSets.has(i),
      completedAt: completedSets.has(i) ? new Date().toISOString() : null,
    }))

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

    setCompletedSets(new Set())
    advanceDeloadDay()
    setShowFinishAlert(false)
  }

  return (
    <div className="p-4 pb-2 space-y-4">
      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <h1 className="text-xl font-bold">{typeLabel}: {liftDisplayName(lift)}</h1>
        <p className="text-sm text-[#8e8e93]">
          Deload Week · Day {profile.deloadDay} of 4
        </p>
      </div>

      {/* Sets */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">
            {deloadType === 'tm_test' ? 'Work Up to TM' : 'Deload Sets'}
          </h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {sets.map((s, i) => {
            const completed = completedSets.has(i)
            const w = displayRound(s.weight, units)
            return (
              <div
                key={s.id}
                onClick={() => toggleSet(i)}
                className={`py-4 ${completed ? 'opacity-50' : ''}`}
              >
                <div className="flex items-center gap-3">
                  <span className={`text-2xl ${completed ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                    {completed ? '✓' : '○'}
                  </span>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`text-xs font-semibold uppercase ${s.isWarmup ? 'text-[#8e8e93]' : 'text-[var(--color-accent)]'}`}>
                        {s.isWarmup ? 'Warmup' : 'Working'}
                      </span>
                      <span className="text-xs text-[#8e8e93]">{Math.round(s.percentage * 100)}%</span>
                    </div>
                    <div className="font-semibold text-base">
                      {w > 0 ? `${w} ${units}` : 'Bar'}
                    </div>
                    {w > barbellWeight(units) && <PlateBreakdown weight={w} units={units} />}
                  </div>
                  <span className="text-base">{s.targetReps} {s.targetReps === 1 ? 'rep' : 'reps'}</span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

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
              {profile.deloadDay < 4
                ? `Moving to Day ${profile.deloadDay + 1}: ${liftDisplayName(liftFromDay(profile.deloadDay + 1)!)}`
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
