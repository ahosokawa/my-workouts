import type { SetLog, MainLift } from '../types'
import { liftDisplayName } from '../types'
import { estimated1RM } from './brzycki'

/** A completed set and the estimated 1RM it produced. */
export interface AmrapBest {
  weight: number
  reps: number
  e1rm: number
}
export type BestSet = AmrapBest

/** Reps actually performed: the logged count when present (AMRAPs, Upper/Lower
 *  Hypertrophy working sets), otherwise the prescribed reps of a completed set. */
export function performedReps(l: SetLog): number {
  return l.actualReps ?? l.targetReps
}

/** True when `l` is a completed, loaded, non-warmup set of `lift`, in any program.
 *  Matching is by exact display name and ignores `isMainLift`: Upper/Lower
 *  Hypertrophy logs its primary lifts as straight working-set rows
 *  (`isMainLift: false`), and those must count toward PRs like any other set.
 *  Variants (Front Squat, Incline DB Bench…) have different names and never match. */
export function isLiftWorkingSet(l: SetLog, lift: MainLift): boolean {
  const reps = performedReps(l)
  return (
    l.exerciseName === liftDisplayName(lift) &&
    l.isCompleted &&
    !l.isWarmup &&
    l.weight > 0 &&
    Number.isFinite(reps) &&
    reps > 0
  )
}

/** All PR-eligible sets for `lift`. Read-side only — works on existing history. */
export function liftWorkingSets(setLogs: readonly SetLog[], lift: MainLift): SetLog[] {
  return setLogs.filter((l) => isLiftWorkingSet(l, lift))
}

/** Best Brzycki estimated 1RM across every PR-eligible set of `lift` (AMRAP or
 *  straight working set). Returns null when the lift has no qualifying set. */
export function bestE1RM(setLogs: readonly SetLog[], lift: MainLift): BestSet | null {
  let best: BestSet | null = null
  for (const l of setLogs) {
    if (!isLiftWorkingSet(l, lift)) continue
    const reps = performedReps(l)
    const e = estimated1RM(l.weight, reps)
    if (e !== null && (best === null || e > best.e1rm)) {
      best = { weight: l.weight, reps, e1rm: e }
    }
  }
  return best
}

/** Best Brzycki estimated 1RM across all completed AMRAP main-lift sets for `lift`.
 *  Sets are matched to the lift by `exerciseName === liftDisplayName(lift)`, so a
 *  query is scoped strictly to one lift — squat history never leaks into a bench
 *  query. Returns null when the lift has no qualifying AMRAP set.
 *  Still used by the analysis export's AMRAP-specific column; PR screens use bestE1RM. */
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
