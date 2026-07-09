import type { PrescribedSet } from '../types'
import { roundWeight } from './calculator'

// Program-aware helpers now live in the ProgramDefinition registry; re-exported
// here so existing importers keep working.
export {
  usesTopSetEngine,
  programLabel,
  programDescription,
  topSetRepRange,
  dayHasTopSetMain,
  mainLiftForDay,
  dayLabel,
} from './programs'

/** Warmup percentages of the working top set (spec §4.1 / §4.2 / §4.5 warmup_scheme). */
export const WARMUP_OF_TOP_SET: [number, number][] = [
  [0.50, 5],
  [0.70, 3],
  [0.85, 2],
]

/** Generate the main-lift prescription for a top-set session:
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
