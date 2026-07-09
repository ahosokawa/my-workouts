import { describe, it, expect } from 'vitest'
import {
  weeksSince,
  weeksSinceLastDeload,
  performanceStalledLift,
  topSetLifts,
  deloadSuggestion,
  DEFAULT_DELOAD_CADENCE_WEEKS,
} from './deloadTriggers'
import { getProgram, topSetRepRange } from './programs'
import { MainLift, ProgramType } from '../types'
import type { SetLog, UserProfile } from '../types'

const NOW = new Date('2026-07-08T12:00:00.000Z')

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

function profile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    squatOneRepMax: 300, benchOneRepMax: 200, deadliftOneRepMax: 400, pressOneRepMax: 130,
    squatTM: 255, benchTM: 170, deadliftTM: 340, pressTM: 110,
    currentWeek: 3, currentDay: 1, cycleNumber: 1, isCycleComplete: false,
    currentVariant: 'fsl', leaderCycleCount: 0, anchorCycleCount: 0,
    tmPercentage: 85, sex: 'male', units: 'lbs',
    isDeloading: false, deloadType: null, deloadDay: 1,
    bodyWeightLbs: 180, bodyWeightLastUpdated: null,
    createdAt: daysAgo(21),
    programType: ProgramType.UpperLower, cycleWeeks: 7,
    lastDeloadEndedAt: null, deloadCadenceWeeks: DEFAULT_DELOAD_CADENCE_WEEKS,
    ...overrides,
  }
}

function topSetLog(lift: MainLift, reps: number, daysBack: number): SetLog {
  const names: Record<MainLift, string> = { 1: 'Squat', 2: 'Bench Press', 3: 'Deadlift', 4: 'Overhead Press' }
  return {
    id: `l-${lift}-${daysBack}`, sessionId: `s-${lift}-${daysBack}`,
    exerciseName: names[lift], isMainLift: true, setIndex: 3,
    weight: 200, targetReps: reps, actualReps: reps,
    isAMRAP: true, isCompleted: true, completedAt: daysAgo(daysBack),
  }
}

describe('weeksSince', () => {
  it('returns whole weeks, clamped at 0, null for missing/invalid', () => {
    expect(weeksSince(daysAgo(50), NOW)).toBe(7)
    expect(weeksSince(daysAgo(6), NOW)).toBe(0)
    expect(weeksSince(daysAgo(-3), NOW)).toBe(0) // future-dated
    expect(weeksSince(null, NOW)).toBeNull()
    expect(weeksSince('garbage', NOW)).toBeNull()
  })
})

describe('weeksSinceLastDeload', () => {
  it('uses lastDeloadEndedAt when present, createdAt otherwise', () => {
    expect(weeksSinceLastDeload(profile({ lastDeloadEndedAt: daysAgo(14) }), NOW)).toBe(2)
    expect(weeksSinceLastDeload(profile({ createdAt: daysAgo(70) }), NOW)).toBe(10)
  })
})

describe('performanceStalledLift', () => {
  const rangeFor = (l: MainLift) => topSetRepRange(l, ProgramType.UpperLower)

  it('flags a lift with 3 consecutive top sets below the range minimum', () => {
    // Squat range 5-6: three sessions at 4, 3, 4 reps
    const logs = [topSetLog(1, 4, 3), topSetLog(1, 3, 10), topSetLog(1, 4, 17)]
    expect(performanceStalledLift(logs, [1, 2, 3, 4] as MainLift[], rangeFor)).toBe(MainLift.Squat)
  })

  it('does not flag with fewer than 3 sessions or when any met the minimum', () => {
    expect(performanceStalledLift([topSetLog(1, 3, 3), topSetLog(1, 3, 10)], [1] as MainLift[], rangeFor)).toBeNull()
    const mixed = [topSetLog(1, 4, 3), topSetLog(1, 5, 10), topSetLog(1, 4, 17)]
    expect(performanceStalledLift(mixed, [1] as MainLift[], rangeFor)).toBeNull()
  })

  it('only the most recent 3 sessions count', () => {
    // Old misses followed by recent successes — not stalled
    const logs = [topSetLog(2, 6, 2), topSetLog(2, 5, 9), topSetLog(2, 6, 16), topSetLog(2, 2, 23), topSetLog(2, 2, 30), topSetLog(2, 2, 37)]
    expect(performanceStalledLift(logs, [2] as MainLift[], rangeFor)).toBeNull()
  })
})

describe('topSetLifts', () => {
  it('includes all four lifts for Upper/Lower, skips the hypertrophy no-main day', () => {
    expect(topSetLifts(getProgram(ProgramType.UpperLower))).toEqual([2, 1, 4, 3])
    expect(topSetLifts(getProgram(ProgramType.Hypertrophy))).toEqual([1, 2, 3])
  })
})

describe('deloadSuggestion', () => {
  const def = getProgram(ProgramType.UpperLower)

  it('null while already deloading', () => {
    expect(deloadSuggestion(profile({ isDeloading: true, lastDeloadEndedAt: daysAgo(100) }), [], def, NOW)).toBeNull()
  })

  it('time trigger fires at the cadence (from last deload)', () => {
    const p = profile({ lastDeloadEndedAt: daysAgo(50) }) // 7 weeks
    const s = deloadSuggestion(p, [], def, NOW)
    expect(s?.reason).toBe('time')
    expect(deloadSuggestion(profile({ lastDeloadEndedAt: daysAgo(40) }), [], def, NOW)).toBeNull()
  })

  it('time trigger measures from createdAt when never deloaded', () => {
    const p = profile({ createdAt: daysAgo(50), lastDeloadEndedAt: null })
    expect(deloadSuggestion(p, [], def, NOW)?.reason).toBe('time')
  })

  it('respects a custom cadence', () => {
    const p = profile({ lastDeloadEndedAt: daysAgo(30), deloadCadenceWeeks: 4 })
    expect(deloadSuggestion(p, [], def, NOW)?.reason).toBe('time')
  })

  it('performance trigger beats time and names the lift', () => {
    const logs = [topSetLog(3, 2, 3), topSetLog(3, 2, 10), topSetLog(3, 1, 17)] // deadlift range 3-5
    const s = deloadSuggestion(profile({ lastDeloadEndedAt: daysAgo(50) }), logs, def, NOW)
    expect(s?.reason).toBe('performance')
    expect(s?.lift).toBe(MainLift.Deadlift)
    expect(s?.message).toContain('Deadlift')
  })

  it('no performance trigger for the percentage engine', () => {
    const logs = [topSetLog(3, 1, 3), topSetLog(3, 1, 10), topSetLog(3, 1, 17)]
    const p = profile({ programType: ProgramType.FiveThreeOne, lastDeloadEndedAt: daysAgo(7) })
    expect(deloadSuggestion(p, logs, getProgram(ProgramType.FiveThreeOne), NOW)).toBeNull()
  })
})
