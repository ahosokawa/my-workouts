import { describe, it, expect } from 'vitest'
import { remainingDays, computeWeekAdvance } from './weekOrder'

describe('remainingDays', () => {
  it('returns all four days when none are done', () => {
    expect(remainingDays([])).toEqual([1, 2, 3, 4])
  })

  it('omits completed days and stays ascending regardless of input order', () => {
    expect(remainingDays([3, 1])).toEqual([2, 4])
  })

  it('returns [] when every day is done', () => {
    expect(remainingDays([1, 2, 3, 4])).toEqual([])
  })
})

describe('computeWeekAdvance', () => {
  it('within a week, advances to the lowest remaining day (linear default)', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [],
      finishedDay: 1,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(r).toEqual({
      completedDaysThisWeek: [1],
      currentDay: 2,
      currentWeek: 1,
      isCycleComplete: false,
    })
  })

  it('honors a reordered week — finishing day 2 first lands on day 1', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [],
      finishedDay: 2,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(r.completedDaysThisWeek).toEqual([2])
    expect(r.currentDay).toBe(1)
    expect(r.currentWeek).toBe(1)
    expect(r.isCycleComplete).toBe(false)
  })

  it('rolls over to the next week once all four days are done, in any order', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [2, 4, 1],
      finishedDay: 3,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(r).toEqual({
      completedDaysThisWeek: [],
      currentDay: 1,
      currentWeek: 2,
      isCycleComplete: false,
    })
  })

  it('marks the cycle complete when the final week finishes', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [1, 2, 3],
      finishedDay: 4,
      currentWeek: 3,
      cycleWeeks: 3,
    })
    expect(r.currentWeek).toBe(4)
    expect(r.isCycleComplete).toBe(true)
  })

  it('does not complete a 7-week hypertrophy cycle after week 3', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [1, 2, 3],
      finishedDay: 4,
      currentWeek: 3,
      cycleWeeks: 7,
    })
    expect(r.currentWeek).toBe(4)
    expect(r.isCycleComplete).toBe(false)
  })

  it('ignores a duplicate finished day', () => {
    const r = computeWeekAdvance({
      completedDaysThisWeek: [1, 2],
      finishedDay: 2,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(r.completedDaysThisWeek).toEqual([1, 2])
    expect(r.currentDay).toBe(3)
  })

  it('marks the finished day done even when it is not the lowest remaining', () => {
    // A pinned workout finished out of order: day 4 done before days 2 and 3.
    const r = computeWeekAdvance({
      completedDaysThisWeek: [1],
      finishedDay: 4,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(r.completedDaysThisWeek).toEqual([1, 4])
    expect(r.currentDay).toBe(2)
    expect(r.currentWeek).toBe(1)
  })
})

describe('computeWeekAdvance — repeated advance is NOT idempotent at week rollover', () => {
  // Documents why the Finish buttons carry a double-tap guard: advancing the
  // same finished day twice is harmless mid-week (the day dedups), but at week
  // rollover the second call lands in the NEW week and re-marks the old day
  // done there, corrupting week progress. The store behavior is intentionally
  // unchanged; callers must not double-invoke advanceDay.
  it('mid-week: repeating the same finished day is a no-op', () => {
    const first = computeWeekAdvance({
      completedDaysThisWeek: [1],
      finishedDay: 2,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    const second = computeWeekAdvance({
      completedDaysThisWeek: first.completedDaysThisWeek,
      finishedDay: 2,
      currentWeek: first.currentWeek,
      cycleWeeks: 3,
    })
    expect(second).toEqual(first)
  })

  it('at week rollover: a repeated advance corrupts the new week', () => {
    const first = computeWeekAdvance({
      completedDaysThisWeek: [1, 2, 3],
      finishedDay: 4,
      currentWeek: 1,
      cycleWeeks: 3,
    })
    expect(first.currentWeek).toBe(2)
    expect(first.completedDaysThisWeek).toEqual([])

    const second = computeWeekAdvance({
      completedDaysThisWeek: first.completedDaysThisWeek,
      finishedDay: 4,
      currentWeek: first.currentWeek,
      cycleWeeks: 3,
    })
    // Day 4 of the OLD week gets marked done in week 2 — this is the corruption.
    expect(second.completedDaysThisWeek).toEqual([4])
    expect(second.currentWeek).toBe(2)
  })
})
