import type { PrescribedSet } from '../types'

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

/** Round weight down to nearest 5 lbs */
export function roundWeight(weight: number): number {
  return Math.floor(weight / 5) * 5
}

/** Generate all 6 prescribed sets for a main lift on a given week */
export function prescribedSets(trainingMax: number, week: number): PrescribedSet[] {
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
      weight: roundWeight(trainingMax * pct),
    })
  }

  return sets
}
