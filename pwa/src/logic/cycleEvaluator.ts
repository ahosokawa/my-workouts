import type { WorkoutSession, SetLog, UserProfile } from '../types'
import { MainLift, MAIN_LIFTS, liftProgressionAmount, toStorageLbs } from '../types'
import { amrapMinimum } from './calculator'

// ============================================================
// Types
// ============================================================

export interface AmrapDetail {
  week: number
  weight: number
  targetReps: number
  actualReps: number
  metMinimum: boolean
}

export interface LiftResult {
  lift: MainLift
  allMainSetsCompleted: boolean
  amrapMet: boolean
  amrapDetails: AmrapDetail[]
  /** 5/3/1 weeks (1-3) with no completed AMRAP recorded for this lift.
   *  Non-empty means the cycle lacks evidence for those weeks, so the lift
   *  cannot count as successful (e.g. a cycle ended early). */
  missingWeeks: number[]
}

export interface CycleResult {
  isSuccessful: boolean
  liftResults: Record<number, LiftResult> // keyed by MainLift value
}

// ============================================================
// Evaluation
// ============================================================

// The three 5/3/1 loading weeks. Deload sessions log week 0 and never count.
const REQUIRED_WEEKS = [1, 2, 3] as const

/**
 * Evaluate a cycle's sessions and set logs to determine success.
 */
export function evaluateCycle(
  sessions: WorkoutSession[],
  setLogs: SetLog[],
  cycleNumber: number,
): CycleResult {
  const cycleSessions = sessions.filter((s) => s.cycleNumber === cycleNumber)
  const liftResults: Record<number, LiftResult> = {}

  for (const lift of MAIN_LIFTS) {
    const liftSessions = cycleSessions.filter((s) => s.liftRawValue === lift)

    // Check: do we have sessions for all 3 weeks?
    const weeksCompleted = new Set(liftSessions.map((s) => s.week))

    // Check all main lift sets completed
    const allMainSetsCompleted =
      weeksCompleted.size === 3 &&
      liftSessions.every((session) => {
        const mainSets = setLogs.filter(
          (l) => l.sessionId === session.id && l.isMainLift,
        )
        return mainSets.length >= 6 && mainSets.every((l) => l.isCompleted)
      })

    // Check AMRAP sets. Only COMPLETED AMRAP sets count as evidence — an
    // unfinished AMRAP still carries the pre-filled default rep count, which
    // would otherwise pass as "met" without the set ever being performed.
    const amrapDetails: AmrapDetail[] = []
    for (const session of liftSessions) {
      const amrapSets = setLogs.filter(
        (l) => l.sessionId === session.id && l.isMainLift && l.isAMRAP && l.isCompleted,
      )
      for (const amrap of amrapSets) {
        const minimum = amrapMinimum(session.week)
        const actual = amrap.actualReps ?? 0
        amrapDetails.push({
          week: session.week,
          weight: amrap.weight,
          targetReps: amrap.targetReps,
          actualReps: actual,
          metMinimum: actual >= minimum,
        })
      }
    }

    // Success is AMRAP-only, but it requires AMRAP evidence from all three
    // 5/3/1 weeks — a partial cycle (ended early / weeks skipped) must not
    // suggest a TM increase off incomplete data.
    const recordedWeeks = new Set(amrapDetails.map((d) => d.week))
    const missingWeeks = REQUIRED_WEEKS.filter((w) => !recordedWeeks.has(w))
    const allAmrapMet =
      missingWeeks.length === 0 && amrapDetails.every((d) => d.metMinimum)

    liftResults[lift] = {
      lift,
      allMainSetsCompleted,
      amrapMet: allAmrapMet,
      amrapDetails,
      missingWeeks,
    }
  }

  const isSuccessful = Object.values(liftResults).every(
    (r) => r.amrapMet,
  )

  return { isSuccessful, liftResults }
}

// ============================================================
// Suggested TMs
// ============================================================

export function suggestedTMs(
  profile: UserProfile,
  cycleResult: CycleResult,
): Record<number, number> {
  const suggested: Record<number, number> = {}

  const tmMap: Record<number, number> = {
    [MainLift.Squat]: profile.squatTM,
    [MainLift.BenchPress]: profile.benchTM,
    [MainLift.Deadlift]: profile.deadliftTM,
    [MainLift.ShoulderPress]: profile.pressTM,
  }

  const units = profile.units ?? 'lbs'
  for (const lift of MAIN_LIFTS) {
    const currentTM = tmMap[lift]
    const result = cycleResult.liftResults[lift]
    if (result && result.amrapMet) {
      // Progression is in user's unit system; convert to lbs for storage
      suggested[lift] = currentTM + toStorageLbs(liftProgressionAmount(lift, units), units)
    } else {
      suggested[lift] = currentTM
    }
  }

  return suggested
}
