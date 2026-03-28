import { describe, it, expect } from 'vitest'
import { estimated1RM, formatted1RM } from './brzycki'

describe('estimated1RM', () => {
  it('returns null for reps <= 0', () => {
    expect(estimated1RM(200, 0)).toBeNull()
    expect(estimated1RM(200, -1)).toBeNull()
  })

  it('returns null for reps >= 37', () => {
    expect(estimated1RM(200, 37)).toBeNull()
    expect(estimated1RM(200, 100)).toBeNull()
  })

  it('returns weight unchanged at 1 rep', () => {
    expect(estimated1RM(315, 1)).toBe(315)
  })

  it('calculates known values', () => {
    // 225 lbs x 10 reps → 225 * (36 / 27) = 300
    expect(estimated1RM(225, 10)).toBeCloseTo(300, 1)
  })

  it('increases with more reps at same weight', () => {
    const e5 = estimated1RM(200, 5)!
    const e10 = estimated1RM(200, 10)!
    expect(e10).toBeGreaterThan(e5)
  })
})

describe('formatted1RM', () => {
  it('returns null for invalid inputs', () => {
    expect(formatted1RM(200, 0)).toBeNull()
  })

  it('returns formatted string for valid inputs', () => {
    expect(formatted1RM(315, 1)).toBe('315 lbs')
  })

  it('rounds to nearest integer', () => {
    const result = formatted1RM(225, 10)
    expect(result).toBe('300 lbs')
  })
})
