import { describe, it, expect } from 'vitest'
import {
  MainLift,
  DEFAULT_DAY_ORDER,
  liftFromDay,
  isValidDayOrder,
  isCycleStart,
  ProgramType,
} from '../types'
import { mainLiftForDay } from './hypertrophyCalculator'

const CUSTOM_ORDER = [
  MainLift.BenchPress,
  MainLift.Squat,
  MainLift.ShoulderPress,
  MainLift.Deadlift,
]

describe('liftFromDay', () => {
  it('maps days 1-4 directly to lifts when no order is given', () => {
    expect(liftFromDay(1)).toBe(MainLift.Squat)
    expect(liftFromDay(2)).toBe(MainLift.BenchPress)
    expect(liftFromDay(3)).toBe(MainLift.Deadlift)
    expect(liftFromDay(4)).toBe(MainLift.ShoulderPress)
  })

  it('returns null for out-of-range days', () => {
    expect(liftFromDay(0)).toBeNull()
    expect(liftFromDay(5)).toBeNull()
    expect(liftFromDay(0, CUSTOM_ORDER)).toBeNull()
    expect(liftFromDay(5, CUSTOM_ORDER)).toBeNull()
  })

  it('resolves the day against a custom order when one is given', () => {
    expect(liftFromDay(1, CUSTOM_ORDER)).toBe(MainLift.BenchPress)
    expect(liftFromDay(2, CUSTOM_ORDER)).toBe(MainLift.Squat)
    expect(liftFromDay(3, CUSTOM_ORDER)).toBe(MainLift.ShoulderPress)
    expect(liftFromDay(4, CUSTOM_ORDER)).toBe(MainLift.Deadlift)
  })
})

describe('isValidDayOrder', () => {
  it('accepts any permutation of the four main lifts', () => {
    expect(isValidDayOrder([...DEFAULT_DAY_ORDER])).toBe(true)
    expect(isValidDayOrder(CUSTOM_ORDER)).toBe(true)
  })

  it('rejects orders with duplicates', () => {
    expect(isValidDayOrder([MainLift.Squat, MainLift.Squat, MainLift.Deadlift, MainLift.BenchPress])).toBe(false)
  })

  it('rejects wrong-length orders', () => {
    expect(isValidDayOrder([MainLift.Squat, MainLift.BenchPress])).toBe(false)
    expect(isValidDayOrder([1, 2, 3, 4, 1])).toBe(false)
  })

  it('rejects values outside the main lifts and non-arrays', () => {
    expect(isValidDayOrder([1, 2, 3, 5])).toBe(false)
    expect(isValidDayOrder(undefined)).toBe(false)
    expect(isValidDayOrder('squat')).toBe(false)
  })
})

describe('isCycleStart', () => {
  it('is true only at week 1 / day 1 outside a deload', () => {
    expect(isCycleStart({ currentWeek: 1, currentDay: 1, isDeloading: false })).toBe(true)
  })

  it('is false once any day of the cycle has been logged', () => {
    expect(isCycleStart({ currentWeek: 1, currentDay: 2, isDeloading: false })).toBe(false)
    expect(isCycleStart({ currentWeek: 2, currentDay: 1, isDeloading: false })).toBe(false)
  })

  it('is false during a deload week', () => {
    expect(isCycleStart({ currentWeek: 1, currentDay: 1, isDeloading: true })).toBe(false)
  })
})

describe('mainLiftForDay', () => {
  it('applies the custom day order for 5/3/1', () => {
    expect(mainLiftForDay(ProgramType.FiveThreeOne, 2, CUSTOM_ORDER)).toBe(MainLift.Squat)
    expect(mainLiftForDay(ProgramType.FiveThreeOne, 2)).toBe(MainLift.BenchPress)
  })

  it('ignores day order for hypertrophy (fixed focus semantics)', () => {
    expect(mainLiftForDay(ProgramType.Hypertrophy, 2, CUSTOM_ORDER)).toBe(MainLift.BenchPress)
  })

  it('returns null for hypertrophy day 4 (no top-set main)', () => {
    expect(mainLiftForDay(ProgramType.Hypertrophy, 4, CUSTOM_ORDER)).toBeNull()
  })
})
