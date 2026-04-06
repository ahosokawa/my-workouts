import { describe, it, expect } from 'vitest'
import { calculateWilks, formatWilks } from './wilks'

describe('calculateWilks', () => {
  it('returns null for zero body weight', () => {
    expect(calculateWilks(0, 300, 200, 400)).toBeNull()
  })

  it('returns null for negative body weight', () => {
    expect(calculateWilks(-180, 300, 200, 400)).toBeNull()
  })

  it('returns null for zero total', () => {
    expect(calculateWilks(180, 0, 0, 0)).toBeNull()
  })

  it('returns a reasonable score for known inputs', () => {
    // 180 lb male, 300 squat, 250 bench, 400 deadlift = 950 total
    const score = calculateWilks(180, 300, 250, 400)
    expect(score).not.toBeNull()
    // Wilks scores for intermediate lifters are typically 200-400
    expect(score!).toBeGreaterThan(100)
    expect(score!).toBeLessThan(600)
  })

  it('higher total produces higher score at same body weight', () => {
    const lower = calculateWilks(180, 200, 150, 300)!
    const higher = calculateWilks(180, 400, 300, 500)!
    expect(higher).toBeGreaterThan(lower)
  })

  it('uses male coefficients by default', () => {
    const defaultScore = calculateWilks(180, 300, 250, 400)!
    const maleScore = calculateWilks(180, 300, 250, 400, 'male')!
    expect(defaultScore).toBe(maleScore)
  })

  it('returns a reasonable score for female lifter', () => {
    // 130 lb female, 200 squat, 120 bench, 250 deadlift
    const score = calculateWilks(130, 200, 120, 250, 'female')
    expect(score).not.toBeNull()
    expect(score!).toBeGreaterThan(100)
    expect(score!).toBeLessThan(600)
  })

  it('female score differs from male score for same inputs', () => {
    const male = calculateWilks(150, 200, 150, 250, 'male')!
    const female = calculateWilks(150, 200, 150, 250, 'female')!
    expect(male).not.toBe(female)
  })
})

describe('formatWilks', () => {
  it('formats to one decimal place', () => {
    expect(formatWilks(312.456)).toBe('312.5')
    expect(formatWilks(300)).toBe('300.0')
  })
})
