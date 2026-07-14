import { describe, it, expect } from 'vitest'
import {
  nextTopSetRpe,
  nextDoubleProgression,
  nextRepsThenLoad,
  lastAccessorySession,
  lastMainLiftTopSet,
} from './progression'
import { MainLift, isTopSetLog } from '../types'
import type { SetLog } from '../types'

// ============================================================
// nextTopSetRpe — spec §5.1
// ============================================================

describe('nextTopSetRpe', () => {
  const base = {
    currentTopSetLbs: 180,
    repRangeMin: 5,
    repRangeMax: 6,
    incrementLbs: 5,
  }

  it('holds at the same weight when no history', () => {
    const out = nextTopSetRpe(base)
    expect(out.reason).toBe('hold')
    expect(out.weightLbs).toBe(180)
  })

  it('drops 10% when reps fall below the range minimum', () => {
    const out = nextTopSetRpe({ ...base, lastActualReps: 4 })
    expect(out.reason).toBe('missed_reps')
    expect(out.weightLbs).toBeLessThan(180)
    expect(out.weightLbs).toBeGreaterThanOrEqual(160)
  })

  it('adds weight when top of range is hit and RIR is unlogged', () => {
    const out = nextTopSetRpe({ ...base, lastActualReps: 6 })
    expect(out.reason).toBe('add_weight')
    expect(out.weightLbs).toBe(185)
  })

  it('adds weight when top of range is hit with RIR >= 2', () => {
    const out = nextTopSetRpe({ ...base, lastActualReps: 6, lastRir: 2 })
    expect(out.reason).toBe('add_weight')
    expect(out.weightLbs).toBe(185)
  })

  it('holds at top of range when RIR was 0 or 1 (grinder)', () => {
    const out = nextTopSetRpe({ ...base, lastActualReps: 6, lastRir: 0 })
    expect(out.reason).toBe('hold')
    expect(out.weightLbs).toBe(180)
  })

  it('suggests adding a rep when within range but not at top', () => {
    const out = nextTopSetRpe({ ...base, lastActualReps: 5 })
    expect(out.reason).toBe('add_reps')
    expect(out.weightLbs).toBe(180)
  })

  it('flags stuck when 3 consecutive sessions at same weight have no rep progress', () => {
    const out = nextTopSetRpe({
      ...base,
      lastActualReps: 5,
      recentHistory: [
        { weightLbs: 180, actualReps: 5 },
        { weightLbs: 180, actualReps: 5 },
        { weightLbs: 180, actualReps: 5 },
      ],
    })
    expect(out.reason).toBe('stuck')
  })
})

// ============================================================
// nextDoubleProgression — spec §5.2
// ============================================================

describe('nextDoubleProgression', () => {
  const base = {
    repRangeMin: 8,
    repRangeMax: 10,
    incrementLbs: 5,
  }

  it('returns "hold at bottom of range" when there is no history', () => {
    const out = nextDoubleProgression(base)
    expect(out.reason).toBe('hold')
    expect(out.targetReps).toBe(8)
  })

  it('adds weight + resets reps when all sets hit the max', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 40, repsPerSet: [10, 10, 10] },
    })
    expect(out.reason).toBe('add_weight')
    expect(out.weightLbs).toBe(45)
    expect(out.targetReps).toBe(8)
  })

  it('drops weight when any set is below the min', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 50, repsPerSet: [8, 7, 7] },
    })
    expect(out.reason).toBe('drop_weight')
    expect(out.weightLbs).toBe(45)
  })

  it('holds weight and pushes the weakest set when within range', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 45, repsPerSet: [10, 10, 9] },
    })
    expect(out.reason).toBe('add_reps')
    expect(out.weightLbs).toBe(45)
    expect(out.targetReps).toBe(10)
  })

  it('clamps a drop to the floor and says to drop the added weight', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 182, repsPerSet: [7, 6, 6] },
      minWeightLbs: 180,
    })
    expect(out.reason).toBe('drop_weight')
    expect(out.weightLbs).toBe(180)
    expect(out.message).toContain('drop the added weight')
  })

  it('holds at the floor instead of dropping when already at bodyweight', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 180, repsPerSet: [7, 6, 6] },
      minWeightLbs: 180,
    })
    expect(out.reason).toBe('hold')
    expect(out.weightLbs).toBe(180)
    expect(out.targetReps).toBe(8)
  })

  it('behaves exactly as before when no floor is given', () => {
    const out = nextDoubleProgression({
      ...base,
      lastSession: { weightLbs: 50, repsPerSet: [8, 7, 7] },
    })
    expect(out.reason).toBe('drop_weight')
    expect(out.weightLbs).toBe(45)
    expect(out.message).toContain('drop to 45 lbs')
  })
})

// ============================================================
// nextRepsThenLoad — spec §5.3
// ============================================================

describe('nextRepsThenLoad', () => {
  it('adds load when top of range hit on bodyweight (no added load yet)', () => {
    const out = nextRepsThenLoad({
      lastSession: { weightLbs: 180, repsPerSet: [8, 8, 8, 8] },
      bodyWeightLbs: 180,
      repRangeMin: 6,
      repRangeMax: 8,
      incrementLbs: 5,
    })
    expect(out.reason).toBe('add_weight')
    expect(out.weightLbs).toBeGreaterThan(180)
  })

  it('adds 5 lbs when top of range hit with existing added load', () => {
    const out = nextRepsThenLoad({
      lastSession: { weightLbs: 200, repsPerSet: [8, 8, 8, 8] },
      bodyWeightLbs: 180,
      repRangeMin: 6,
      repRangeMax: 8,
      incrementLbs: 5,
    })
    expect(out.reason).toBe('add_weight')
    expect(out.weightLbs).toBe(205)
  })

  it('falls back to double progression on reps when not at top of range', () => {
    const out = nextRepsThenLoad({
      lastSession: { weightLbs: 200, repsPerSet: [7, 7, 6, 6] },
      bodyWeightLbs: 180,
      repRangeMin: 6,
      repRangeMax: 8,
      incrementLbs: 5,
    })
    expect(out.reason).toBe('add_reps')
    expect(out.weightLbs).toBe(200)
  })

  it('never suggests dropping below bodyweight after a below-range session', () => {
    const out = nextRepsThenLoad({
      lastSession: { weightLbs: 180, repsPerSet: [5, 4, 4] },
      bodyWeightLbs: 180,
      repRangeMin: 6,
      repRangeMax: 8,
      incrementLbs: 5,
    })
    expect(out.weightLbs).toBeGreaterThanOrEqual(180)
    expect(out.reason).toBe('hold')
  })

  it('drops only the added weight after a below-range session with load', () => {
    const out = nextRepsThenLoad({
      lastSession: { weightLbs: 183, repsPerSet: [5, 4, 4] },
      bodyWeightLbs: 180,
      repRangeMin: 6,
      repRangeMax: 8,
      incrementLbs: 5,
    })
    expect(out.reason).toBe('drop_weight')
    expect(out.weightLbs).toBe(180)
  })
})

// ============================================================
// History helpers
// ============================================================

describe('history helpers', () => {
  const baseLog: Omit<SetLog, 'id' | 'sessionId' | 'exerciseName' | 'setIndex' | 'completedAt'> = {
    isMainLift: false,
    weight: 50,
    targetReps: 10,
    actualReps: 10,
    isAMRAP: false,
    isCompleted: true,
  }

  function log(over: Partial<SetLog>): SetLog {
    return {
      id: 'l' + Math.random(),
      sessionId: 's1',
      exerciseName: 'Goblet Squat',
      setIndex: 0,
      completedAt: '2026-05-01T00:00:00.000Z',
      ...baseLog,
      ...over,
    }
  }

  it('lastAccessorySession picks the most recent session by completedAt', () => {
    const setLogs: SetLog[] = [
      log({ sessionId: 's1', completedAt: '2026-05-01T00:00:00.000Z', setIndex: 0, weight: 40, actualReps: 10 }),
      log({ sessionId: 's1', completedAt: '2026-05-01T00:00:00.000Z', setIndex: 1, weight: 40, actualReps: 9 }),
      log({ sessionId: 's2', completedAt: '2026-05-08T00:00:00.000Z', setIndex: 0, weight: 45, actualReps: 10 }),
      log({ sessionId: 's2', completedAt: '2026-05-08T00:00:00.000Z', setIndex: 1, weight: 45, actualReps: 9 }),
    ]
    const out = lastAccessorySession(setLogs, 'Goblet Squat')
    expect(out).not.toBeNull()
    expect(out!.weightLbs).toBe(45)
    expect(out!.repsPerSet).toEqual([10, 9])
  })

  it('lastAccessorySession returns null when there is no completed history', () => {
    expect(lastAccessorySession([], 'Anything')).toBeNull()
  })

  it('lastMainLiftTopSet returns the most recent AMRAP set log for a main lift', () => {
    const setLogs: SetLog[] = [
      log({
        isMainLift: true,
        exerciseName: 'Squat',
        isAMRAP: true,
        weight: 180,
        actualReps: 6,
        completedAt: '2026-05-01T00:00:00.000Z',
      }),
      log({
        isMainLift: true,
        exerciseName: 'Squat',
        isAMRAP: true,
        weight: 185,
        actualReps: 5,
        completedAt: '2026-05-08T00:00:00.000Z',
      }),
    ]
    const out = lastMainLiftTopSet(setLogs, MainLift.Squat)
    expect(out).not.toBeNull()
    expect(out!.weight).toBe(185)
  })

  it('isTopSetLog is false for a genuine 5/3/1 AMRAP log (no rir key, no rep range)', () => {
    expect(isTopSetLog(log({ isMainLift: true, isAMRAP: true }))).toBe(false)
  })

  it('isTopSetLog is true for a new log carrying the prescribed rep range', () => {
    expect(isTopSetLog(log({ isMainLift: true, isAMRAP: true, repRangeMin: 5, repRangeMax: 6 }))).toBe(true)
  })

  it('isTopSetLog is true for a legacy completed top set whose rir key is null', () => {
    expect(isTopSetLog(log({ isMainLift: true, isAMRAP: true, rir: null }))).toBe(true)
  })

  it('isTopSetLog is false for non-AMRAP logs even with a rep range', () => {
    expect(isTopSetLog(log({ isAMRAP: false, repRangeMin: 8, repRangeMax: 10 }))).toBe(false)
  })
})
