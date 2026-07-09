import { describe, it, expect } from 'vitest'
import { weekStartKey, weeklyVolume, sessionsPerWeek, consistencyStreakWeeks, stalledLifts } from './metrics'
import { MainLift } from '../types'
import type { SetLog, WorkoutSession } from '../types'

// A Wednesday, local time
const NOW = new Date(2026, 6, 8, 12, 0, 0) // 2026-07-08 (Wed)

function daysAgoISO(n: number): string {
  return new Date(NOW.getTime() - n * 24 * 60 * 60 * 1000).toISOString()
}

let idCounter = 0
function log(overrides: Partial<SetLog>): SetLog {
  idCounter++
  return {
    id: `l${idCounter}`, sessionId: `s${idCounter}`,
    exerciseName: 'Squat', isMainLift: true, setIndex: 0,
    weight: 200, targetReps: 5, actualReps: 5,
    isAMRAP: false, isCompleted: true, completedAt: daysAgoISO(0),
    ...overrides,
  }
}

function session(daysBack: number): WorkoutSession {
  idCounter++
  return { id: `ws${idCounter}`, date: daysAgoISO(daysBack), liftRawValue: 1, week: 1, cycleNumber: 1, durationSeconds: 0 }
}

describe('weekStartKey', () => {
  it('returns the Monday of the containing week', () => {
    expect(weekStartKey(new Date(2026, 6, 8))).toBe('2026-07-06')  // Wed → Mon
    expect(weekStartKey(new Date(2026, 6, 6))).toBe('2026-07-06')  // Mon → itself
    expect(weekStartKey(new Date(2026, 6, 5))).toBe('2026-06-29')  // Sun → previous Mon
  })
})

describe('weeklyVolume', () => {
  it('buckets completed weighted sets into this week and last week per muscle group', () => {
    const logs = [
      log({ exerciseName: 'Squat', weight: 200, actualReps: 5, completedAt: daysAgoISO(1) }),   // this week
      log({ exerciseName: 'Squat', weight: 200, actualReps: 5, completedAt: daysAgoISO(8) }),   // last week
      log({ exerciseName: 'DB Bicep Curl', isMainLift: false, weight: 25, targetReps: 12, actualReps: null, completedAt: daysAgoISO(1) }),
      log({ exerciseName: 'Squat', weight: 200, actualReps: 5, isCompleted: false, completedAt: null }), // not completed
      log({ exerciseName: 'Band Facepull', isMainLift: false, weight: 0, targetReps: 15, completedAt: daysAgoISO(1) }), // no weight
    ]
    const [lastWeek, thisWeek] = weeklyVolume(logs, 2, NOW)
    expect(thisWeek.volumeByGroup.quads).toBe(1000)   // 200×5
    expect(thisWeek.volumeByGroup.glutes).toBe(1000)  // full attribution to each group
    expect(thisWeek.volumeByGroup.biceps).toBe(300)   // 25×12 targetReps fallback
    expect(thisWeek.volumeByGroup.shoulders).toBeUndefined() // 0-weight facepull ignored
    expect(lastWeek.volumeByGroup.quads).toBe(1000)
  })

  it('prefers explicit tags when provided', () => {
    const logs = [log({ exerciseName: 'Mystery Move', isMainLift: false, weight: 50, actualReps: 10, completedAt: daysAgoISO(0) })]
    const [, thisWeek] = weeklyVolume(logs, 2, NOW, { 'mystery move': ['core'] })
    expect(thisWeek.volumeByGroup.core).toBe(500)
    expect(thisWeek.volumeByGroup.other).toBeUndefined()
  })
})

describe('sessionsPerWeek / consistencyStreakWeeks', () => {
  it('counts sessions per week oldest → newest', () => {
    // NOW is Wed: this week = daysAgo 0-2, last week = 3-9, two weeks ago = 10-16
    const sessions = [session(0), session(1), session(4), session(5), session(6), session(12), session(30)]
    const counts = sessionsPerWeek(sessions, 3, NOW)
    expect(counts.map((c) => c.count)).toEqual([1, 3, 2]) // two weeks ago, last week, this week
  })

  it('streak counts consecutive target weeks back from last week; current week extends once met', () => {
    // 4 sessions in each of the previous two full weeks; 1 so far this week
    const sessions = [
      ...[4, 5, 6, 7].map(session),     // last week
      ...[11, 12, 13, 14].map(session), // two weeks ago
      session(1),
    ]
    expect(consistencyStreakWeeks(sessions, 4, NOW)).toBe(2)
    // Current week hits the target too → 3
    const withCurrent = [...sessions, session(0), session(1), session(2)]
    expect(consistencyStreakWeeks(withCurrent, 4, NOW)).toBe(3)
    // A gap week breaks it: only two-weeks-ago hit the target
    expect(consistencyStreakWeeks([11, 12, 13, 14].map(session), 4, NOW)).toBe(0)
  })
})

describe('stalledLifts', () => {
  const topSet = (weight: number, reps: number, daysBack: number) =>
    log({ exerciseName: 'Squat', isAMRAP: true, weight, actualReps: reps, completedAt: daysAgoISO(daysBack) })

  it('flags a lift whose recent best e1RM has not beaten the older best', () => {
    const logs = [topSet(200, 5, 40), topSet(200, 5, 7), topSet(195, 5, 2)]
    expect(stalledLifts(logs, [MainLift.Squat], NOW)).toEqual([MainLift.Squat])
  })

  it('does not flag progress, missing recent data, or missing older data', () => {
    expect(stalledLifts([topSet(200, 5, 40), topSet(205, 5, 7)], [MainLift.Squat], NOW)).toEqual([])
    expect(stalledLifts([topSet(200, 5, 40)], [MainLift.Squat], NOW)).toEqual([]) // nothing recent
    expect(stalledLifts([topSet(200, 5, 7)], [MainLift.Squat], NOW)).toEqual([])  // nothing older
  })
})
