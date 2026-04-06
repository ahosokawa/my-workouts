import { describe, it, expect } from 'vitest'
import { platesPerSide, BARBELL_WEIGHT, BARBELL_WEIGHT_KG, formattedBreakdown, barbellWeight } from './plates'

describe('platesPerSide', () => {
  it('returns empty for weight <= barbell', () => {
    expect(platesPerSide(45)).toEqual([])
    expect(platesPerSide(0)).toEqual([])
    expect(platesPerSide(30)).toEqual([])
  })

  it('returns one 45 plate for 135 lbs', () => {
    const plates = platesPerSide(135)
    expect(plates).toEqual([{ plateWeight: 45, count: 1 }])
  })

  it('returns two 45 plates for 225 lbs', () => {
    const plates = platesPerSide(225)
    expect(plates).toEqual([{ plateWeight: 45, count: 2 }])
  })

  it('handles mixed plate sizes', () => {
    // 185 = 45 bar + 140 total → 70 per side → 45 + 25
    const plates = platesPerSide(185)
    expect(plates).toEqual([
      { plateWeight: 45, count: 1 },
      { plateWeight: 25, count: 1 },
    ])
  })

  it('handles small plates', () => {
    // 50 = 45 bar + 5 total → 2.5 per side
    const plates = platesPerSide(50)
    expect(plates).toEqual([{ plateWeight: 2.5, count: 1 }])
  })

  it('uses 1.25 lb plates', () => {
    // 47.5 = 45 bar + 2.5 total → 1.25 per side
    const plates = platesPerSide(47.5)
    expect(plates).toEqual([{ plateWeight: 1.25, count: 1 }])
  })
})

describe('formattedBreakdown', () => {
  it('returns null for barbell-only weight', () => {
    expect(formattedBreakdown(45)).toBeNull()
  })

  it('formats single plate', () => {
    expect(formattedBreakdown(135)).toBe('45')
  })

  it('formats multiple different plates', () => {
    expect(formattedBreakdown(185)).toBe('45 + 25')
  })
})

describe('BARBELL_WEIGHT', () => {
  it('is 45 lbs', () => {
    expect(BARBELL_WEIGHT).toBe(45)
  })
})

describe('barbellWeight', () => {
  it('returns 45 for lbs', () => {
    expect(barbellWeight('lbs')).toBe(45)
  })

  it('returns 20 for kg', () => {
    expect(barbellWeight('kg')).toBe(20)
    expect(BARBELL_WEIGHT_KG).toBe(20)
  })
})

describe('platesPerSide (kg)', () => {
  it('returns empty for weight <= 20 kg bar', () => {
    expect(platesPerSide(20, 'kg')).toEqual([])
    expect(platesPerSide(15, 'kg')).toEqual([])
  })

  it('returns one 20 kg plate for 60 kg', () => {
    // 60 - 20 bar = 40, 20 per side
    const plates = platesPerSide(60, 'kg')
    expect(plates).toEqual([{ plateWeight: 20, count: 1 }])
  })

  it('handles mixed metric plates', () => {
    // 100 kg = 20 bar + 80 → 40 per side → 25 + 15
    const plates = platesPerSide(100, 'kg')
    expect(plates).toEqual([
      { plateWeight: 25, count: 1 },
      { plateWeight: 15, count: 1 },
    ])
  })
})

describe('formattedBreakdown (kg)', () => {
  it('returns null for bar-only weight in kg', () => {
    expect(formattedBreakdown(20, 'kg')).toBeNull()
  })

  it('formats metric plates', () => {
    expect(formattedBreakdown(60, 'kg')).toBe('20')
  })
})
