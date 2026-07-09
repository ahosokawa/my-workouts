// ============================================================
// TM retest (spec §2) — top-set programs' TM-test week
// ============================================================
//
// After a deload, the user works up to a hard top set (RPE 8-9, 1-2 RIR) on
// each main lift; the new training max is 85% of the estimated 1RM from that
// set, and the next cycle's top set reseeds from the new TM.

import type { PrescribedSet, Units } from '../types'
import { toDisplayWeight, toStorageLbs } from '../types'
import { roundWeight } from './calculator'
import { WARMUP_OF_TOP_SET } from './hypertrophyCalculator'
import { estimated1RM } from './brzycki'
import type { ProgramDefinition } from './programs'

/** Warmups at 50/70/85% of the current TM, then a retest top set suggested at
 *  90% of TM (weight/reps editable in the view — "work up to RPE 8-9").
 *  The top set is marked isAMRAP so it feeds e1RM/PR history like any top set. */
export function tmRetestSets(tmLbs: number, repRange: { min: number; max: number }): PrescribedSet[] {
  const sets: PrescribedSet[] = []
  let counter = 0
  for (const [pct, reps] of WARMUP_OF_TOP_SET) {
    counter++
    sets.push({
      id: `retest-${counter}`,
      setNumber: counter,
      percentage: pct,
      targetReps: reps,
      isWarmup: true,
      isAMRAP: false,
      isSupplemental: false,
      weight: roundWeight(tmLbs * pct),
    })
  }
  counter++
  sets.push({
    id: `retest-${counter}`,
    setNumber: counter,
    percentage: 0.9,
    targetReps: repRange.min,
    isWarmup: false,
    isAMRAP: true,
    isSupplemental: false,
    weight: roundWeight(tmLbs * 0.9),
    repRangeMin: repRange.min,
    repRangeMax: repRange.max,
  })
  return sets
}

/** New TM from a retest top set: 0.85 × estimated 1RM, rounded in the user's
 *  display units. Weight in/out is lbs. Null when the set can't produce an e1RM. */
export function suggestedTMFromRetest(weightLbs: number, reps: number, units: Units): number | null {
  const e = estimated1RM(weightLbs, reps)
  if (e === null || e <= 0) return null
  return toStorageLbs(roundWeight(toDisplayWeight(e, units) * 0.85, units), units)
}

/** Where the next cycle's top set starts after a TM change — the same seed
 *  fraction used when the program is first adopted. Weight in/out is lbs. */
export function reseedTopSetFromTM(def: ProgramDefinition, newTmLbs: number, units: Units): number {
  const factor = def.topSetSeedOfTM ?? 0.85
  return toStorageLbs(roundWeight(toDisplayWeight(newTmLbs, units) * factor, units), units)
}
