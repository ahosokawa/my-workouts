import { describe, it, expect } from 'vitest'
import {
  PROGRAMS,
  getProgram,
  effectiveDayOrder,
  slotForDay,
  programMainLiftForDay,
  programDayLabel,
  programDayChipLabel,
  getProgramAccessories,
  usesTopSetEngine,
  programLabel,
  topSetRepRange,
  dayHasTopSetMain,
  mainLiftForDay,
  dayLabel,
  seedProgram,
} from './programs'
import { FIVE_THREE_ONE_ACCESSORIES, HYPERTROPHY_ACCESSORIES, UPPER_LOWER_ACCESSORIES } from './accessories'
import { MainLift, MAIN_LIFTS, ProgramType } from '../types'

const ALL_PROGRAMS = Object.values(ProgramType)
const DAYS = [1, 2, 3, 4]

describe('registry completeness', () => {
  it('has a definition for every ProgramType', () => {
    for (const pt of ALL_PROGRAMS) {
      expect(PROGRAMS[pt]).toBeDefined()
      expect(PROGRAMS[pt].id).toBe(pt)
      expect(PROGRAMS[pt].days).toHaveLength(4)
    }
  })

  it('falls back to 5/3/1 for missing program type', () => {
    expect(getProgram(undefined).id).toBe(ProgramType.FiveThreeOne)
    expect(getProgram(null).id).toBe(ProgramType.FiveThreeOne)
  })
})

// Golden parity: these literals capture the pre-registry dispatcher outputs.
// They must not change during the refactor.
describe('golden parity with legacy dispatchers', () => {
  it('usesTopSetEngine', () => {
    expect(usesTopSetEngine(ProgramType.FiveThreeOne)).toBe(false)
    expect(usesTopSetEngine(ProgramType.Hypertrophy)).toBe(true)
    expect(usesTopSetEngine(ProgramType.UpperLower)).toBe(true)
  })

  it('programLabel', () => {
    expect(programLabel(ProgramType.FiveThreeOne)).toBe('5/3/1')
    expect(programLabel(ProgramType.UpperLower)).toBe('4-Day Upper/Lower')
  })

  it('dayHasTopSetMain for every program × day', () => {
    for (const day of DAYS) {
      expect(dayHasTopSetMain(ProgramType.FiveThreeOne, day)).toBe(true)
      expect(dayHasTopSetMain(ProgramType.UpperLower, day)).toBe(true)
      expect(dayHasTopSetMain(ProgramType.Hypertrophy, day)).toBe(day !== 4)
    }
    expect(dayHasTopSetMain(ProgramType.FiveThreeOne, 5)).toBe(false)
    expect(dayHasTopSetMain(ProgramType.Hypertrophy, 0)).toBe(false)
  })

  it('mainLiftForDay for every program × day', () => {
    // Hypertrophy: identity mapping, day 4 has no main
    expect(mainLiftForDay(ProgramType.Hypertrophy, 1)).toBe(MainLift.Squat)
    expect(mainLiftForDay(ProgramType.Hypertrophy, 2)).toBe(MainLift.BenchPress)
    expect(mainLiftForDay(ProgramType.Hypertrophy, 3)).toBe(MainLift.Deadlift)
    expect(mainLiftForDay(ProgramType.Hypertrophy, 4)).toBeNull()
    // Upper/Lower: fixed Bench, Squat, OHP, Deadlift — ignores passed dayOrder
    expect(mainLiftForDay(ProgramType.UpperLower, 1)).toBe(MainLift.BenchPress)
    expect(mainLiftForDay(ProgramType.UpperLower, 2)).toBe(MainLift.Squat)
    expect(mainLiftForDay(ProgramType.UpperLower, 3)).toBe(MainLift.ShoulderPress)
    expect(mainLiftForDay(ProgramType.UpperLower, 4)).toBe(MainLift.Deadlift)
    expect(mainLiftForDay(ProgramType.UpperLower, 1, [1, 2, 3, 4] as MainLift[])).toBe(MainLift.BenchPress)
    // 5/3/1: identity without dayOrder, user order with it
    for (const day of DAYS) {
      expect(mainLiftForDay(ProgramType.FiveThreeOne, day)).toBe(day)
    }
    const custom = [MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress, MainLift.BenchPress]
    expect(mainLiftForDay(ProgramType.FiveThreeOne, 1, custom)).toBe(MainLift.Deadlift)
    expect(mainLiftForDay(ProgramType.FiveThreeOne, 4, custom)).toBe(MainLift.BenchPress)
    // Out of range
    expect(mainLiftForDay(ProgramType.FiveThreeOne, 5)).toBeNull()
    expect(mainLiftForDay(ProgramType.Hypertrophy, 0)).toBeNull()
  })

  it('topSetRepRange with and without program', () => {
    expect(topSetRepRange(MainLift.Squat)).toEqual({ min: 5, max: 6 })
    expect(topSetRepRange(MainLift.BenchPress)).toEqual({ min: 5, max: 6 })
    expect(topSetRepRange(MainLift.Deadlift)).toEqual({ min: 3, max: 5 })
    expect(topSetRepRange(MainLift.ShoulderPress)).toEqual({ min: 6, max: 8 })
    expect(topSetRepRange(MainLift.ShoulderPress, ProgramType.Hypertrophy)).toEqual({ min: 6, max: 8 })
    expect(topSetRepRange(MainLift.ShoulderPress, ProgramType.UpperLower)).toEqual({ min: 5, max: 8 })
    expect(topSetRepRange(MainLift.Deadlift, ProgramType.UpperLower)).toEqual({ min: 3, max: 5 })
  })

  it('dayLabel for top-set programs', () => {
    expect(dayLabel(ProgramType.Hypertrophy, 1)).toBe('Lower — Squat Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 2)).toBe('Upper — Push Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 3)).toBe('Lower — Hinge Focus')
    expect(dayLabel(ProgramType.Hypertrophy, 4)).toBe('Upper — Pull Focus')
    expect(dayLabel(ProgramType.UpperLower, 1)).toBe('Upper A — Chest/Horizontal')
    expect(dayLabel(ProgramType.UpperLower, 2)).toBe('Lower A — Squat')
    expect(dayLabel(ProgramType.UpperLower, 3)).toBe('Upper B — Back/Vertical')
    expect(dayLabel(ProgramType.UpperLower, 4)).toBe('Lower B — Hinge')
    expect(dayLabel(ProgramType.Hypertrophy, 7)).toBe('Day 7')
  })

  it('dayLabel for 5/3/1 derives from the lift', () => {
    expect(dayLabel(ProgramType.FiveThreeOne, 1)).toBe('Squat')
    expect(dayLabel(ProgramType.FiveThreeOne, 4)).toBe('Overhead Press')
  })

  it('day chip labels (previously WorkoutView.dayChipLabel)', () => {
    const hyp = getProgram(ProgramType.Hypertrophy)
    expect(DAYS.map((d) => programDayChipLabel(hyp, d))).toEqual(['Squat', 'Push', 'Hinge', 'Pull'])
    const ul = getProgram(ProgramType.UpperLower)
    expect(DAYS.map((d) => programDayChipLabel(ul, d))).toEqual(['BP', 'SQ', 'OHP', 'DL'])
    const fto = getProgram(ProgramType.FiveThreeOne)
    expect(DAYS.map((d) => programDayChipLabel(fto, d))).toEqual(['SQ', 'BP', 'DL', 'OHP'])
    const custom = [MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress, MainLift.BenchPress]
    expect(DAYS.map((d) => programDayChipLabel(fto, d, custom))).toEqual(['DL', 'SQ', 'OHP', 'BP'])
  })

  it('getProgramAccessories dispatches to the right table', () => {
    for (const lift of MAIN_LIFTS) {
      expect(getProgramAccessories(ProgramType.FiveThreeOne, lift)).toBe(FIVE_THREE_ONE_ACCESSORIES[lift])
      expect(getProgramAccessories(ProgramType.Hypertrophy, lift)).toBe(HYPERTROPHY_ACCESSORIES[lift])
      expect(getProgramAccessories(ProgramType.UpperLower, lift)).toBe(UPPER_LOWER_ACCESSORIES[lift])
    }
  })
})

describe('day-order helpers', () => {
  it('fixed programs dictate the order regardless of user order', () => {
    const ul = getProgram(ProgramType.UpperLower)
    expect(effectiveDayOrder(ul, [1, 2, 3, 4] as MainLift[])).toEqual([2, 1, 4, 3])
  })

  it('user programs take the user order, defaulting to MAIN_LIFTS', () => {
    const fto = getProgram(ProgramType.FiveThreeOne)
    expect(effectiveDayOrder(fto)).toEqual([...MAIN_LIFTS])
    const custom = [MainLift.BenchPress, MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress]
    expect(effectiveDayOrder(fto, custom)).toBe(custom)
  })

  it('slotForDay is defined even for no-main days (accessories key)', () => {
    const hyp = getProgram(ProgramType.Hypertrophy)
    expect(programMainLiftForDay(hyp, 4)).toBeNull()
    expect(slotForDay(hyp, 4)).toBe(MainLift.ShoulderPress)
    expect(slotForDay(hyp, 5)).toBeNull()
  })

  it('programDayLabel falls back to lift name then Day N', () => {
    const fto = getProgram(ProgramType.FiveThreeOne)
    expect(programDayLabel(fto, 2)).toBe('Bench Press')
    expect(programDayLabel(fto, 9)).toBe('Day 9')
  })
})

describe('seedProgram', () => {
  // 1RMs stored in lbs (lbs user): squat 300, bench 200, deadlift 400, press 130
  const RMS = { 1: 300, 2: 200, 3: 400, 4: 130 } as Record<MainLift, number>

  it('5/3/1 preserves the current TM% and day order, no top sets', () => {
    const custom = [MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress, MainLift.BenchPress]
    const seed = seedProgram(getProgram(ProgramType.FiveThreeOne), RMS, 'lbs', {
      currentTmPercentage: 90,
      currentDayOrder: custom,
    })
    expect(seed.tmPercentage).toBe(90)
    expect(seed.cycleWeeks).toBe(3)
    expect(seed.dayOrder).toEqual(custom)
    expect(seed.hypertrophyTopSets).toBeUndefined()
    // 90% TMs rounded to 2.5: 270, 180, 360, 117.5
    expect(seed.squatTM).toBe(270)
    expect(seed.benchTM).toBe(180)
    expect(seed.deadliftTM).toBe(360)
    expect(seed.pressTM).toBe(117.5)
  })

  it('hypertrophy locks TM% to 85 and seeds top sets for days 1-3 only', () => {
    const seed = seedProgram(getProgram(ProgramType.Hypertrophy), RMS, 'lbs', {
      currentTmPercentage: 90,
    })
    expect(seed.tmPercentage).toBe(85)
    expect(seed.cycleWeeks).toBe(7)
    expect(seed.dayOrder).toEqual([...MAIN_LIFTS])
    // 85% TMs: 255, 170, 340, 110 — top sets at 85% of TM: 217.5, 145, 290
    expect(seed.squatTM).toBe(255)
    expect(seed.benchTM).toBe(170)
    expect(seed.deadliftTM).toBe(340)
    expect(seed.pressTM).toBe(110)
    expect(seed.hypertrophyTopSets).toEqual({
      [MainLift.Squat]: 217.5,
      [MainLift.BenchPress]: 145,
      [MainLift.Deadlift]: 290,
    })
  })

  it('upper/lower seeds all four top sets and writes its fixed day order', () => {
    const seed = seedProgram(getProgram(ProgramType.UpperLower), RMS, 'lbs', {
      currentTmPercentage: 90,
      currentDayOrder: [MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress, MainLift.BenchPress],
    })
    expect(seed.tmPercentage).toBe(85)
    expect(seed.dayOrder).toEqual([MainLift.BenchPress, MainLift.Squat, MainLift.ShoulderPress, MainLift.Deadlift])
    expect(seed.hypertrophyTopSets).toEqual({
      [MainLift.Squat]: 217.5,
      [MainLift.BenchPress]: 145,
      [MainLift.Deadlift]: 290,
      [MainLift.ShoulderPress]: 92.5,
    })
  })
})
