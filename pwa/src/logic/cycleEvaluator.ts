import type { WorkoutSession, SetLog, UserProfile } from '../types'
import { MainLift, MAIN_LIFTS, liftProgressionAmount } from '../types'
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
}

export interface CycleResult {
  isSuccessful: boolean
  liftResults: Record<number, LiftResult> // keyed by MainLift value
}

// ============================================================
// Evaluation
// ============================================================

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
        return mainSets.length === 6 && mainSets.every((l) => l.isCompleted)
      })

    // Check AMRAP sets
    const amrapDetails: AmrapDetail[] = []
    for (const session of liftSessions) {
      const amrapSets = setLogs.filter(
        (l) => l.sessionId === session.id && l.isMainLift && l.isAMRAP,
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

    const allAmrapMet =
      amrapDetails.length > 0 && amrapDetails.every((d) => d.metMinimum)

    liftResults[lift] = {
      lift,
      allMainSetsCompleted,
      amrapMet: allAmrapMet,
      amrapDetails,
    }
  }

  const isSuccessful = Object.values(liftResults).every(
    (r) => r.allMainSetsCompleted && r.amrapMet,
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

  for (const lift of MAIN_LIFTS) {
    const currentTM = tmMap[lift]
    if (cycleResult.isSuccessful) {
      suggested[lift] = currentTM + liftProgressionAmount(lift)
    } else {
      suggested[lift] = currentTM
    }
  }

  return suggested
}
