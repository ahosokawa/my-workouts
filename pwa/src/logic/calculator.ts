import type { PrescribedSet, ProgramVariant } from '../types'
import { getVariantConfig } from './variants'

// ============================================================
// Week Definitions
// ============================================================

/** Working set percentages and reps for each week: [percentage, targetReps, isAMRAP] */
function workingSets(week: number): [number, number, boolean][] {
  switch (week) {
    case 1:
      return [
        [0.65, 5, false],
        [0.75, 5, false],
        [0.85, 5, true],
      ]
    case 2:
      return [
        [0.70, 3, false],
        [0.80, 3, false],
        [0.90, 3, true],
      ]
    case 3:
      return [
        [0.75, 5, false],
        [0.85, 3, false],
        [0.95, 1, true],
      ]
    default:
      return workingSets(1)
  }
}

/** Warmup sets: [percentage, targetReps] */
const WARMUP_SETS: [number, number][] = [
  [0.40, 5],
  [0.50, 5],
  [0.60, 3],
]

// ============================================================
// Public API
// ============================================================

/** AMRAP minimum reps per week (used as default value for AMRAP input) */
export function amrapMinimum(week: number): number {
  switch (week) {
    case 1: return 5
    case 2: return 3
    case 3: return 1
    default: return 5
  }
}

/** Round weight to nearest 2.5 lbs (supports 1.25 lb plates per side) */
export function roundWeight(weight: number): number {
  return Math.round(weight / 2.5) * 2.5
}

/** Generate all prescribed sets for a main lift on a given week.
 *  3 warmup + 3 working (last is AMRAP) + supplemental sets (varies by variant).
 *  Default variant is FSL for backwards compatibility.
 */
export function prescribedSets(trainingMax: number, week: number, variant: ProgramVariant = 'fsl'): PrescribedSet[] {
  const sets: PrescribedSet[] = []
  let counter = 0

  // 3 warmup sets
  for (const [pct, reps] of WARMUP_SETS) {
    counter++
    sets.push({
      id: `set-${counter}`,
      setNumber: counter,
      percentage: pct,
      targetReps: reps,
      isWarmup: true,
      isAMRAP: false,
      isSupplemental: false,
      weight: roundWeight(trainingMax * pct),
    })
  }

  // 3 working sets
  for (const [pct, reps, isAMRAP] of workingSets(week)) {
    counter++
    sets.push({
      id: `set-${counter}`,
      setNumber: counter,
      percentage: pct,
      targetReps: reps,
      isWarmup: false,
      isAMRAP,
      isSupplemental: false,
      weight: roundWeight(trainingMax * pct),
    })
  }

  // Supplemental sets (configured by variant)
  const config = getVariantConfig(variant)
  const suppPct = config.supplementalPercentage(week)
  const suppWeight = roundWeight(trainingMax * suppPct)
  for (let i = 0; i < config.supplementalSets; i++) {
    counter++
    sets.push({
      id: `set-${counter}`,
      setNumber: counter,
      percentage: suppPct,
      targetReps: config.supplementalReps,
      isWarmup: false,
      isAMRAP: false,
      isSupplemental: true,
      weight: suppWeight,
    })
  }

  return sets
}
