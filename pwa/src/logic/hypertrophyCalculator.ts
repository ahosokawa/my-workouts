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

/** True when a program uses the ramp-to-top-set engine (warmup ramp → AMRAP top set +
 *  double-progression accessories + RPE autoprogression), as opposed to 5/3/1 percentages.
 *  Both Hypertrophy and 4-Day Upper/Lower share this engine. */
export function usesTopSetEngine(programType: ProgramType): boolean {
  return programType === PT.Hypertrophy || programType === PT.UpperLower
}

/** Short program name for UI headers/selectors. */
export function programLabel(programType: ProgramType): string {
  switch (programType) {
    case PT.Hypertrophy: return 'Hypertrophy'
    case PT.UpperLower: return '4-Day Upper/Lower'
    default: return '5/3/1'
  }
}

/** One-line program description for the selector cards. */
export function programDescription(programType: ProgramType): string {
  switch (programType) {
    case PT.Hypertrophy: return 'RPE-8 top sets + double progression, 7-week cycles'
    case PT.UpperLower: return 'Upper/Lower split, top sets on all 4 days, 7-week cycles'
    default: return 'Top-set AMRAP percentages over 3-week cycles'
  }
}

/** Fixed day→lift order for 4-Day Upper/Lower: Bench, Squat, OHP, Deadlift across days 1-4
 *  (Upper A → Lower A → Upper B → Lower B). */
export const UPPER_LOWER_DAY_ORDER: readonly MainLift[] = [2, 1, 4, 3] as MainLift[]

/** Top-set rep range for a main lift. Hypertrophy uses the spec ranges (§3.1); Upper/Lower
 *  widens OHP to 5-8. */
export function topSetRepRange(lift: MainLift, programType?: ProgramType): { min: number; max: number } {
  if (programType === PT.UpperLower && lift === 4) return { min: 5, max: 8 }  // OHP (Upper B)
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

/** Program-aware version of `liftFromDay`. Returns null when the day has no top-set main.
 *  For 5/3/1, `dayOrder` resolves the day against the user's custom lift order;
 *  hypertrophy days have fixed Lower/Upper-focus semantics and ignore `dayOrder`;
 *  Upper/Lower uses its own fixed order (Bench, Squat, OHP, Deadlift). */
export function mainLiftForDay(
  programType: ProgramType,
  day: number,
  dayOrder?: readonly MainLift[],
): MainLift | null {
  if (!dayHasTopSetMain(programType, day)) return null
  if (programType === PT.Hypertrophy) return liftFromDay(day)
  if (programType === PT.UpperLower) return liftFromDay(day, UPPER_LOWER_DAY_ORDER)
  return liftFromDay(day, dayOrder)
}

/** Program-aware day label for the top-set engine programs. */
export function dayLabel(programType: ProgramType, day: number): string {
  if (programType === PT.UpperLower) return upperLowerDayLabel(day)
  return hypertrophyDayLabel(day)
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

/** Day labels for 4-Day Upper/Lower. */
export function upperLowerDayLabel(day: number): string {
  switch (day) {
    case 1: return 'Upper A — Chest/Horizontal'
    case 2: return 'Lower A — Squat'
    case 3: return 'Upper B — Back/Vertical'
    case 4: return 'Lower B — Hinge'
    default: return `Day ${day}`
  }
}
