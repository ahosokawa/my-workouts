import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { AccessoryWeightType, ProgramType, displayRound } from '../types'
import type { AccessoryExercise, PrescribedSet, SetLog, Units } from '../types'
import { getUpcomingWorkouts, type UpcomingWorkout } from '../logic/upcomingWorkouts'
import { getVariantConfig } from '../logic/variants'
import { usesTopSetEngine, programLabel } from '../logic/hypertrophyCalculator'
import { lastAccessorySession } from '../logic/progression'
import CollapsibleSection from '../components/CollapsibleSection'

function accessoryRepsLabel(ex: AccessoryExercise): string {
  if (ex.repRangeMin !== undefined && ex.repRangeMax !== undefined) {
    return `${ex.repRangeMin}-${ex.repRangeMax}`
  }
  return String(ex.reps)
}

export default function UpcomingWorkoutsView() {
  const navigate = useNavigate()
  const profile = useStore((s) => s.profile)
  const customAccessories = useStore((s) => s.customAccessories)
  const customSupplemental = useStore((s) => s.customSupplemental)
  const setLogs = useStore((s) => s.setLogs)

  const workouts = useMemo(
    () => (profile ? getUpcomingWorkouts(profile, customAccessories, customSupplemental) : []),
    [profile, customAccessories, customSupplemental],
  )

  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set())

  if (!profile) return null

  const units = profile.units ?? 'lbs'
  const programType = profile.programType ?? ProgramType.FiveThreeOne
  const isTopSetProgram = usesTopSetEngine(programType)

  const byWeek = new Map<number, UpcomingWorkout[]>()
  for (const w of workouts) {
    const arr = byWeek.get(w.week) ?? []
    arr.push(w)
    byWeek.set(w.week, arr)
  }
  const weeks = Array.from(byWeek.keys()).sort((a, b) => a - b)

  function toggle(key: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="p-4 pb-2 space-y-4">
      <button onClick={() => navigate('/workout')} className="text-sm text-[var(--color-accent)]">
        ← Workout
      </button>

      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <h1 className="text-xl font-bold">Rest of Cycle {profile.cycleNumber}</h1>
        <p className="text-sm text-[#8e8e93]">
          {workouts.length === 0
            ? 'No upcoming workouts in this cycle.'
            : `${workouts.length} workout${workouts.length === 1 ? '' : 's'} remaining · ${isTopSetProgram ? programLabel(programType) : getVariantConfig(profile.currentVariant ?? 'fsl').shortLabel}`}
        </p>
      </div>

      {weeks.map((week) => (
        <section key={week} className="space-y-2">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93] pt-2 px-1">Week {week}</h2>
          {byWeek.get(week)!.map((w) => {
            const key = `${w.week}-${w.day}`
            const expanded = expandedDays.has(key)
            return (
              <CollapsibleSection
                key={key}
                title={`Day ${w.day} — ${w.title}`}
                isCollapsed={!expanded}
                onToggle={() => toggle(key)}
                trailing={
                  <span className="text-xs text-[#8e8e93]">
                    {w.variant ? getVariantConfig(w.variant).shortLabel : programLabel(programType)}
                  </span>
                }
              >
                <UpcomingWorkoutDetail
                  workout={w}
                  units={units}
                  isTopSetProgram={isTopSetProgram}
                  setLogs={setLogs}
                  bodyWeightLbs={profile.bodyWeightLbs}
                />
              </CollapsibleSection>
            )
          })}
        </section>
      ))}
    </div>
  )
}

function UpcomingWorkoutDetail({
  workout,
  units,
  isTopSetProgram,
  setLogs,
  bodyWeightLbs,
}: {
  workout: UpcomingWorkout
  units: Units
  isTopSetProgram: boolean
  setLogs: SetLog[]
  bodyWeightLbs: number | null
}) {
  const variantConfig = workout.variant ? getVariantConfig(workout.variant) : null

  const mainTitle = isTopSetProgram
    ? `Warmups + Top Set${workout.title ? ` – ${workout.title}` : ''}`
    : 'Warmups + 5/3/1'

  return (
    <div>
      {workout.mainSets.length > 0 && (
        <div className="pt-1">
          <div className="text-xs uppercase tracking-wider text-[#8e8e93] mb-1">{mainTitle}</div>
          <div className="divide-y divide-[#38383a]">
            {workout.mainSets.map((s) => (
              <PrescribedSetRow key={s.id} set={s} units={units} showPercentage={!isTopSetProgram} />
            ))}
          </div>
        </div>
      )}

      {isTopSetProgram && workout.lift !== null && workout.mainSets.length === 0 && (
        <div className="py-3 text-xs text-[#8e8e93]">
          Top set not seeded yet — log a session for this lift to populate the prescription.
        </div>
      )}

      {workout.supplementalSets.length > 0 && variantConfig && (
        <div className="pt-2">
          <div className="text-xs uppercase tracking-wider text-[#8e8e93] mb-1">
            {variantConfig.shortLabel} {variantConfig.supplementalSets}×{variantConfig.supplementalReps} – {workout.supplementalDisplayName}
          </div>
          <div className="divide-y divide-[#38383a]">
            {workout.supplementalSets.map((s) => (
              <PrescribedSetRow key={s.id} set={s} units={units} showPercentage={!isTopSetProgram} />
            ))}
          </div>
        </div>
      )}

      {workout.accessories.length > 0 && (
        <div className="pt-2">
          <div className="text-xs uppercase tracking-wider text-[#8e8e93] mb-1">Accessories</div>
          <div className="divide-y divide-[#38383a]">
            {workout.accessories.map((ex) => (
              <AccessoryRow
                key={ex.id}
                ex={ex}
                units={units}
                setLogs={setLogs}
                bodyWeightLbs={bodyWeightLbs}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PrescribedSetRow({
  set,
  units,
  showPercentage,
}: {
  set: PrescribedSet
  units: Units
  showPercentage: boolean
}) {
  const weight = displayRound(set.weight, units)
  const label = set.isWarmup ? 'Warmup' : set.isSupplemental ? 'Supplemental' : 'Working'
  const labelColor = set.isWarmup
    ? 'text-[#8e8e93]'
    : set.isSupplemental
      ? 'text-[var(--color-yellow)]'
      : 'text-[var(--color-accent)]'
  const repsLabel = set.isAMRAP
    ? set.repRangeMin !== undefined && set.repRangeMax !== undefined
      ? `${set.repRangeMin}-${set.repRangeMax} reps`
      : `${set.targetReps}+ reps`
    : `${set.targetReps} reps`

  return (
    <div className="py-2 flex items-baseline gap-3">
      <span className={`text-xs font-semibold uppercase shrink-0 w-24 ${labelColor}`}>{label}</span>
      {showPercentage && (
        <span className="text-xs text-[#8e8e93] tabular-nums shrink-0 w-10">
          {Math.round(set.percentage * 100)}%
        </span>
      )}
      <span className="text-base font-semibold tabular-nums flex-1">
        {weight > 0 ? `${weight} ${units}` : 'Bar'}
      </span>
      <span className="text-sm text-[#8e8e93] tabular-nums">{repsLabel}</span>
    </div>
  )
}

function AccessoryRow({
  ex,
  units,
  setLogs,
  bodyWeightLbs,
}: {
  ex: AccessoryExercise
  units: Units
  setLogs: SetLog[]
  bodyWeightLbs: number | null
}) {
  const repsLabel = accessoryRepsLabel(ex)
  const last = lastAccessorySession(setLogs, ex.name)
  const weightLbs = (() => {
    const bw = ex.weightType === AccessoryWeightType.Bodyweight && bodyWeightLbs && bodyWeightLbs > 0
      ? bodyWeightLbs
      : 0
    // Bodyweight exercises never preview below current bodyweight, even if the
    // last logged total predates a bodyweight change.
    if (last && last.weightLbs > 0) return Math.max(last.weightLbs, bw)
    return bw
  })()
  const weightLabel =
    ex.weightType === AccessoryWeightType.NoWeight
      ? null
      : weightLbs > 0
        ? `${displayRound(weightLbs, units)} ${units}`
        : null

  return (
    <div className="py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-base">{ex.name}</span>
        <span className="text-sm text-[#8e8e93] tabular-nums">
          {weightLabel ? `${weightLabel} · ` : ''}{ex.sets} × {repsLabel}
        </span>
      </div>
      {ex.notes && <div className="text-xs text-[#8e8e93] mt-0.5">{ex.notes}</div>}
    </div>
  )
}
