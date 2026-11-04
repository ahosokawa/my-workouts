import { describe, it, expect } from 'vitest'
import type { SetLog } from '../types'
import { MainLift } from '../types'
import { estimated1RM } from './brzycki'
import { bestAmrapE1RM, bestE1RM, isLiftWorkingSet, liftWorkingSets } from './personalRecords'

let idCounter = 0

/** Build a SetLog that qualifies for bestAmrapE1RM; override fields per test. */
function setLog(partial: Partial<SetLog> = {}): SetLog {
  return {
    id: `log-${idCounter++}`,
    sessionId: 'session-1',
    exerciseName: 'Bench Press',
    isMainLift: true,
    setIndex: 5,
    weight: 200,
    targetReps: 5,
    actualReps: 5,
    isAMRAP: true,
    isCompleted: true,
    completedAt: '2026-01-01T00:00:00.000Z',
    ...partial,
  }
}

describe('bestAmrapE1RM', () => {
  it('returns null when there are no set logs', () => {
    expect(bestAmrapE1RM([], MainLift.BenchPress)).toBeNull()
  })

  it('returns null when no log matches the lift', () => {
    const logs = [setLog({ exerciseName: 'Squat' })]
    expect(bestAmrapE1RM(logs, MainLift.BenchPress)).toBeNull()
  })

  it('ignores non-AMRAP sets', () => {
    expect(bestAmrapE1RM([setLog({ isAMRAP: false })], MainLift.BenchPress)).toBeNull()
  })

  it('ignores non-main-lift sets', () => {
    expect(bestAmrapE1RM([setLog({ isMainLift: false })], MainLift.BenchPress)).toBeNull()
  })

  it('ignores sets that were not completed', () => {
    expect(bestAmrapE1RM([setLog({ isCompleted: false })], MainLift.BenchPress)).toBeNull()
  })

  it('ignores sets with no recorded reps', () => {
    expect(bestAmrapE1RM([setLog({ actualReps: null })], MainLift.BenchPress)).toBeNull()
  })

  it('returns the set with the highest estimated 1RM', () => {
    const logs = [
      setLog({ weight: 200, actualReps: 5 }), // e1RM = 225
      setLog({ weight: 225, actualReps: 3 }), // e1RM ≈ 238.2
      setLog({ weight: 240, actualReps: 1 }), // e1RM = 240
    ]
    const best = bestAmrapE1RM(logs, MainLift.BenchPress)
    expect(best).not.toBeNull()
    expect(best!.weight).toBe(240)
    expect(best!.reps).toBe(1)
    expect(best!.e1rm).toBe(estimated1RM(240, 1))
  })

  it('scopes strictly to one lift — squat history never leaks into a bench query', () => {
    // Regression for the reported bug: a bench AMRAP must not surface squat data.
    const logs = [
      setLog({ exerciseName: 'Squat', weight: 405, actualReps: 5 }),
      setLog({ exerciseName: 'Bench Press', weight: 225, actualReps: 5 }),
    ]
    const bench = bestAmrapE1RM(logs, MainLift.BenchPress)
    expect(bench).not.toBeNull()
    expect(bench!.weight).toBe(225)
    expect(bench!.e1rm).toBe(estimated1RM(225, 5))

    const squat = bestAmrapE1RM(logs, MainLift.Squat)
    expect(squat!.weight).toBe(405)
  })
})

describe('bestE1RM / liftWorkingSets (all programs)', () => {
  /** Upper/Lower Hypertrophy logs primaries as straight working-set rows. */
  const ulSet = (partial: Partial<SetLog> = {}) => setLog({
    exerciseId: 'ca-bench', isMainLift: false, isAMRAP: false,
    weight: 130, targetReps: 8, actualReps: 8, setIndex: 0, ...partial,
  })

  it('counts Upper/Lower Hypertrophy working sets logged with isMainLift: false', () => {
    // Regression: 130×8 bench must beat an older 92.5×8 main-lift set.
    const logs = [setLog({ isAMRAP: false, actualReps: null, weight: 92.5, targetReps: 8 }), ulSet()]
    const best = bestE1RM(logs, MainLift.BenchPress)
    expect(best).toEqual({ weight: 130, reps: 8, e1rm: estimated1RM(130, 8) })
    expect(liftWorkingSets(logs, MainLift.BenchPress)).toHaveLength(2)
  })

  it('counts 5/3/1 non-AMRAP sets at their prescribed reps', () => {
    const best = bestE1RM([setLog({ isAMRAP: false, actualReps: null, weight: 200, targetReps: 5 })], MainLift.BenchPress)
    expect(best).toEqual({ weight: 200, reps: 5, e1rm: estimated1RM(200, 5) })
  })

  it('still counts AMRAP sets at their logged reps', () => {
    const best = bestE1RM([setLog({ weight: 200, targetReps: 5, actualReps: 9 })], MainLift.BenchPress)
    expect(best!.reps).toBe(9)
  })

  it('excludes warmups, incomplete, unloaded and zero-rep sets', () => {
    expect(isLiftWorkingSet(ulSet({ isWarmup: true, weight: 300 }), MainLift.BenchPress)).toBe(false)
    expect(isLiftWorkingSet(ulSet({ isCompleted: false }), MainLift.BenchPress)).toBe(false)
    expect(isLiftWorkingSet(ulSet({ weight: 0 }), MainLift.BenchPress)).toBe(false)
    expect(isLiftWorkingSet(ulSet({ actualReps: 0 }), MainLift.BenchPress)).toBe(false)
    expect(isLiftWorkingSet(ulSet({ actualReps: Number.NaN }), MainLift.BenchPress)).toBe(false)
  })

  it('never matches variant lifts by a different name', () => {
    const logs = [
      ulSet({ exerciseName: 'Incline DB Bench Press', weight: 500 }),
      ulSet({ exerciseName: 'Front Squat', weight: 500 }),
      ulSet({ exerciseName: 'Romanian Deadlift', weight: 500 }),
    ]
    expect(bestE1RM(logs, MainLift.BenchPress)).toBeNull()
    expect(bestE1RM(logs, MainLift.Squat)).toBeNull()
    expect(bestE1RM(logs, MainLift.Deadlift)).toBeNull()
  })

  it('maps each program primary to its lift', () => {
    const logs = [
      ulSet({ exerciseName: 'Squat', weight: 225, actualReps: 6 }),
      ulSet({ exerciseName: 'Deadlift', weight: 275, actualReps: 5 }),
      ulSet({ exerciseName: 'Overhead Press', weight: 95, actualReps: 8 }),
    ]
    expect(bestE1RM(logs, MainLift.Squat)!.weight).toBe(225)
    expect(bestE1RM(logs, MainLift.Deadlift)!.weight).toBe(275)
    expect(bestE1RM(logs, MainLift.ShoulderPress)!.weight).toBe(95)
  })
})
