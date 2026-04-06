import { describe, it, expect } from 'vitest'
import { toDisplayWeight, toStorageLbs, displayRound, KG_TO_LBS, LBS_TO_KG } from '../types'

describe('toDisplayWeight', () => {
  it('returns the same value for lbs', () => {
    expect(toDisplayWeight(300, 'lbs')).toBe(300)
    expect(toDisplayWeight(0, 'lbs')).toBe(0)
    expect(toDisplayWeight(202.5, 'lbs')).toBe(202.5)
  })

  it('converts lbs to kg', () => {
    // 300 lbs ≈ 136.08 kg
    expect(toDisplayWeight(300, 'kg')).toBeCloseTo(136.08, 1)
    // 45 lbs (barbell) ≈ 20.41 kg
    expect(toDisplayWeight(45, 'kg')).toBeCloseTo(20.41, 1)
  })

  it('handles zero', () => {
    expect(toDisplayWeight(0, 'kg')).toBe(0)
  })
})

describe('toStorageLbs', () => {
  it('returns the same value for lbs', () => {
    expect(toStorageLbs(300, 'lbs')).toBe(300)
    expect(toStorageLbs(0, 'lbs')).toBe(0)
    expect(toStorageLbs(202.5, 'lbs')).toBe(202.5)
  })

  it('converts kg to lbs', () => {
    // 100 kg ≈ 220.46 lbs
    expect(toStorageLbs(100, 'kg')).toBeCloseTo(220.46, 1)
    // 20 kg (barbell) ≈ 44.09 lbs
    expect(toStorageLbs(20, 'kg')).toBeCloseTo(44.09, 1)
  })

  it('handles zero', () => {
    expect(toStorageLbs(0, 'kg')).toBe(0)
  })
})

describe('roundtrip conversion', () => {
  it('converting lbs→kg→lbs returns the original value', () => {
    const original = 300
    const kg = toDisplayWeight(original, 'kg')
    const backToLbs = toStorageLbs(kg, 'kg')
    expect(backToLbs).toBeCloseTo(original, 5)
  })

  it('converting kg→lbs→kg returns the original value', () => {
    const original = 100
    const lbs = toStorageLbs(original, 'kg')
    const backToKg = toDisplayWeight(lbs, 'kg')
    expect(backToKg).toBeCloseTo(original, 5)
  })

  it('multiple roundtrips do not drift', () => {
    let value = 225
    for (let i = 0; i < 10; i++) {
      value = toStorageLbs(toDisplayWeight(value, 'kg'), 'kg')
    }
    expect(value).toBeCloseTo(225, 5)
  })
})

describe('displayRound', () => {
  it('preserves 0.5 precision for lbs', () => {
    expect(displayRound(282.5, 'lbs')).toBe(282.5)
    expect(displayRound(202.5, 'lbs')).toBe(202.5)
    expect(displayRound(315, 'lbs')).toBe(315)
  })

  it('rounds to nearest integer for kg', () => {
    // 282.5 lbs → 128.14 kg → 128
    expect(displayRound(282.5, 'kg')).toBe(128)
    // 315 lbs → 142.88 kg → 143
    expect(displayRound(315, 'kg')).toBe(143)
  })

  it('handles zero', () => {
    expect(displayRound(0, 'lbs')).toBe(0)
    expect(displayRound(0, 'kg')).toBe(0)
  })

  it('rounds lbs to nearest 0.5', () => {
    // If floating point gives 282.50000001 or 282.49999999, should still be 282.5
    expect(displayRound(282.5 + 0.0001, 'lbs')).toBe(282.5)
    expect(displayRound(282.5 - 0.0001, 'lbs')).toBe(282.5)
  })
})

describe('conversion constants', () => {
  it('KG_TO_LBS is approximately 2.205', () => {
    expect(KG_TO_LBS).toBeCloseTo(2.20462, 3)
  })

  it('LBS_TO_KG is the inverse of KG_TO_LBS', () => {
    expect(LBS_TO_KG * KG_TO_LBS).toBeCloseTo(1, 10)
  })
})
