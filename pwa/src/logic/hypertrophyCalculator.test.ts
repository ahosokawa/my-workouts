import { describe, it, expect } from 'vitest'
import {
  hypertrophyMainSets,
  dayHasTopSetMain,
  mainLiftForDay,
  topSetRepRange,
  usesTopSetEngine,
  dayLabel,
  programLabel,
} from './hypertrophyCalculator'
import { MainLift, ProgramType } from '../types'

describe('hypertrophyMainSets', () => {
  const sets = hypertrophyMainSets(180, 5, 6)

  it('returns 3 warmups + 1 top set', () => {
    expect(sets).toHaveLength(4)
    expect(sets.filter((s) => s.isWarmup)).toHaveLength(3)
    expect(sets.filter((s) => !s.isWarmup)).toHaveLength(1)
  })

  it('builds warmups at 50/70/85% of the top-set weight', () => {
    expect(sets[0].percentage).toBe(0.5)
    expect(sets[0].targetReps).toBe(5)
    expect(sets[1].percentage).toBe(0.7)
    expect(sets[1].targetReps).toBe(3)
    expect(sets[2].percentage).toBe(0.85)
    expect(sets[2].targetReps).toBe(2)
  })

  it('marks the top set as AMRAP with the rep range attached', () => {
    const top = sets[3]
    expect(top.isAMRAP).toBe(true)
    expect(top.isWarmup).toBe(false)
    expect(top.weight).toBe(180)
    expect(top.repRangeMin).toBe(5)
    expect(top.repRangeMax).toBe(6)
  })

  it('rounds warmup weights to the nearest 2.5 lbs', () => {
    for (const s of sets) {
      expect(s.weight % 2.5).toBe(0)
    }
  })

  it('uses 1.0 percentage on the top set', () => {
    expect(sets[3].percentage).toBe(1.0)
  })
})

describe('dayHasTopSetMain / mainLiftForDay', () => {
  it('5/3/1 always has a main lift on days 1–4', () => {
    for (const day of [1, 2, 3, 4]) {
      expect(dayHasTopSetMain(ProgramType.FiveThreeOne, day)).toBe(true)
      expect(mainLiftForDay(ProgramType.FiveThreeOne, day)).not.toBeNull()
    }
  })

  it('hypertrophy has top-set main lifts on days 1–3 only', () => {
    expect(dayHasTopSetMain(ProgramType.Hypertrophy, 1)).toBe(true)
    expect(dayHasTopSetMain(ProgramType.Hypertrophy, 2)).toBe(true)
    expect(dayHasTopSetMain(ProgramType.Hypertrophy, 3)).toBe(true)
    expect(dayHasTopSetMain(ProgramType.Hypertrophy, 4)).toBe(false)
  })

  it('hypertrophy day 4 returns null for mainLiftForDay', () => {
    expect(mainLiftForDay(ProgramType.Hypertrophy, 4)).toBeNull()
  })

  it('hypertrophy day 1 maps to Squat', () => {
    expect(mainLiftForDay(ProgramType.Hypertrophy, 1)).toBe(MainLift.Squat)
  })
})

describe('topSetRepRange', () => {
  it('returns spec rep ranges for each main lift', () => {
    expect(topSetRepRange(MainLift.Squat)).toEqual({ min: 5, max: 6 })
    expect(topSetRepRange(MainLift.BenchPress)).toEqual({ min: 5, max: 6 })
    expect(topSetRepRange(MainLift.Deadlift)).toEqual({ min: 3, max: 5 })
  })

  it('widens OHP to 5-8 for the Upper/Lower program', () => {
    expect(topSetRepRange(MainLift.ShoulderPress, ProgramType.UpperLower)).toEqual({ min: 5, max: 8 })
    // Other lifts unchanged across programs
    expect(topSetRepRange(MainLift.Deadlift, ProgramType.UpperLower)).toEqual({ min: 3, max: 5 })
  })
})

describe('Upper/Lower program', () => {
  it('is recognized as a top-set-engine program', () => {
    expect(usesTopSetEngine(ProgramType.UpperLower)).toBe(true)
    expect(usesTopSetEngine(ProgramType.Hypertrophy)).toBe(true)
    expect(usesTopSetEngine(ProgramType.FiveThreeOne)).toBe(false)
  })

  it('maps days 1-4 to Bench, Squat, OHP, Deadlift (Upper A → Lower A → Upper B → Lower B)', () => {
    expect(mainLiftForDay(ProgramType.UpperLower, 1)).toBe(MainLift.BenchPress)
    expect(mainLiftForDay(ProgramType.UpperLower, 2)).toBe(MainLift.Squat)
    expect(mainLiftForDay(ProgramType.UpperLower, 3)).toBe(MainLift.ShoulderPress)
    expect(mainLiftForDay(ProgramType.UpperLower, 4)).toBe(MainLift.Deadlift)
  })

  it('has a top-set main lift on all four days', () => {
    for (const day of [1, 2, 3, 4]) {
      expect(dayHasTopSetMain(ProgramType.UpperLower, day)).toBe(true)
    }
  })

  it('ignores a passed dayOrder (fixed program order)', () => {
    // Even if a stale dayOrder is supplied, the program order wins.
    expect(mainLiftForDay(ProgramType.UpperLower, 1, [MainLift.Squat, MainLift.BenchPress, MainLift.Deadlift, MainLift.ShoulderPress])).toBe(MainLift.BenchPress)
  })

  it('has its own day labels and program label', () => {
    expect(dayLabel(ProgramType.UpperLower, 1)).toBe('Upper A — Chest/Horizontal')
    expect(dayLabel(ProgramType.UpperLower, 4)).toBe('Lower B — Hinge')
    expect(programLabel(ProgramType.UpperLower)).toBe('4-Day Upper/Lower')
  })
})

describe('hypertrophy day labels', () => {
  it('returns the spec day labels for each hypertrophy day', () => {
    expect(dayLabel(ProgramType.Hypertrophy, 1)).toBe('Lower — Squat Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 2)).toBe('Upper — Push Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 3)).toBe('Lower — Hinge Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 4)).toBe('Upper — Pull Focus')
  })
})
