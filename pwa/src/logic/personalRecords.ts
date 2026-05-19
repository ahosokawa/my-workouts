import type { SetLog, MainLift } from '../types'
import { liftDisplayName } from '../types'
import { estimated1RM } from './brzycki'

/** A completed AMRAP main-lift set and the estimated 1RM it produced. */
export interface AmrapBest {
  weight: number
  reps: number
  e1rm: number
}

/** Best Brzycki estimated 1RM across all completed AMRAP main-lift sets for `lift`.
 *  Sets are matched to the lift by `exerciseName === liftDisplayName(lift)`, so a
 *  query is scoped strictly to one lift — squat history never leaks into a bench
 *  query. Returns null when the lift has no qualifying AMRAP set. */
export function bestAmrapE1RM(setLogs: readonly SetLog[], lift: MainLift): AmrapBest | null {
  const name = liftDisplayName(lift)
  let best: AmrapBest | null = null
  for (const l of setLogs) {
    if (
      l.exerciseName !== name ||
      !l.isAMRAP ||
      !l.isMainLift ||
      !l.isCompleted ||
      l.actualReps == null
    ) {
      continue
    }
    const e = estimated1RM(l.weight, l.actualReps)
    if (e !== null && (best === null || e > best.e1rm)) {
      best = { weight: l.weight, reps: l.actualReps, e1rm: e }
    }
  }
  return best
}
