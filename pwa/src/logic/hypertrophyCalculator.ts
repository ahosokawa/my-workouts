import type { MainLift, PrescribedSet, ProgramType } from '../types'
import { liftFromDay, ProgramType as PT } from '../types'
import { roundWeight } from './calculator'

/** Warmup percentages of the working top set (spec §4.1 / §4.2 / §4.5 warmup_scheme). */
const WARMUP_OF_TOP_SET: [number, number][] = [
  [0.50, 5],
  [0.70, 3],
  [0.85, 2],
]

/** Generate the main-lift prescription for a hypertrophy session:
 *  3 warmups (50%×5, 70%×3, 85%×2 of the working top set) + 1 top set at the chosen weight.
 *  The top set is marked `isAMRAP=true` so the existing flow captures actualReps and feeds e1RM.
 *  `repRangeMin`/`repRangeMax` are the user's target range (e.g. 5-6) — used by the progression
 *  algorithm post-session and shown on the top-set card.
 *
 *  `topSetWeightLbs` is the working weight in lbs. */
export function hypertrophyMainSets(
  topSetWeightLbs: number,
  repRangeMin: number,
  repRangeMax: number,
): PrescribedSet[] {
  const sets: PrescribedSet[] = []
  let counter = 0
  for (const [pct, reps] of WARMUP_OF_TOP_SET) {
    counter++
    sets.push({
      id: `h-set-${counter}`,
      setNumber: counter,
      percentage: pct,
      targetReps: reps,
      isWarmup: true,
      isAMRAP: false,
      isSupplemental: false,
      weight: roundWeight(topSetWeightLbs * pct),
    })
  }
  counter++
  sets.push({
    id: `h-set-${counter}`,
    setNumber: counter,
    percentage: 1.0,
    targetReps: repRangeMax,
    isWarmup: false,
    isAMRAP: true,
    isSupplemental: false,
    weight: roundWeight(topSetWeightLbs),
    repRangeMin,
    repRangeMax,
  })
  return sets
}

/** Top-set rep range for each hypertrophy main lift (spec §3.1). */
export function topSetRepRange(lift: MainLift): { min: number; max: number } {
  switch (lift) {
    case 1: return { min: 5, max: 6 }  // Squat
    case 2: return { min: 5, max: 6 }  // Bench
    case 3: return { min: 3, max: 5 }  // Deadlift
    case 4: return { min: 6, max: 8 }  // OHP — unused in hypertrophy main slot (Fri has no top set)
  }
  return { min: 5, max: 6 }
}

/** True when the program/day combination prescribes a top-set RPE main lift.
 *  For hypertrophy day 4 (Friday — Upper Pull Focus), there is no top-set main lift —
 *  pull-ups are the focal exercise and live in the accessory list. */
export function dayHasTopSetMain(programType: ProgramType, day: number): boolean {
  if (programType === PT.Hypertrophy && day === 4) return false
  return liftFromDay(day) !== null
}

/** Program-aware version of `liftFromDay`. Returns null when the day has no top-set main. */
export function mainLiftForDay(programType: ProgramType, day: number): MainLift | null {
  if (!dayHasTopSetMain(programType, day)) return null
  return liftFromDay(day)
}

/** Spec day labels for hypertrophy (replaces "Day N — {LiftName}" headers). */
export function hypertrophyDayLabel(day: number): string {
  switch (day) {
    case 1: return 'Lower — Squat Focus'
    case 2: return 'Upper — Push Focus'
    case 3: return 'Lower — Hinge Focus'
    case 4: return 'Upper — Pull Focus'
    default: return `Day ${day}`
  }
}
