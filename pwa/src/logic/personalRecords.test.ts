import { describe, it, expect } from 'vitest'
import type { SetLog } from '../types'
import { MainLift } from '../types'
import { estimated1RM } from './brzycki'
import { bestAmrapE1RM } from './personalRecords'

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
