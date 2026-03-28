import { describe, it, expect } from 'vitest'
import { prescribedSets, roundWeight, amrapMinimum } from './calculator'

describe('roundWeight', () => {
  it('rounds to nearest 2.5', () => {
    expect(roundWeight(100)).toBe(100)
    expect(roundWeight(101)).toBe(100)
    expect(roundWeight(102)).toBe(102.5)
    expect(roundWeight(103.75)).toBe(105)
  })

  it('handles zero', () => {
    expect(roundWeight(0)).toBe(0)
  })
})

describe('amrapMinimum', () => {
  it('returns correct minimums per week', () => {
    expect(amrapMinimum(1)).toBe(5)
    expect(amrapMinimum(2)).toBe(3)
    expect(amrapMinimum(3)).toBe(1)
  })

  it('defaults to 5 for unknown week', () => {
    expect(amrapMinimum(99)).toBe(5)
  })
})

describe('prescribedSets', () => {
  const tm = 200
  const sets1 = prescribedSets(tm, 1)
  const sets2 = prescribedSets(tm, 2)
  const sets3 = prescribedSets(tm, 3)

  it('returns 11 total sets (3 warmup + 3 working + 5 supplemental)', () => {
    expect(sets1).toHaveLength(11)
    expect(sets2).toHaveLength(11)
    expect(sets3).toHaveLength(11)
  })

  it('has 3 warmup sets', () => {
    const warmups = sets1.filter((s) => s.isWarmup)
    expect(warmups).toHaveLength(3)
  })

  it('has 3 working sets (not warmup, not supplemental)', () => {
    const working = sets1.filter((s) => !s.isWarmup && !s.isSupplemental)
    expect(working).toHaveLength(3)
  })

  it('has 5 supplemental sets', () => {
    const supp = sets1.filter((s) => s.isSupplemental)
    expect(supp).toHaveLength(5)
  })

  it('marks the last working set as AMRAP', () => {
    const working = sets1.filter((s) => !s.isWarmup && !s.isSupplemental)
    expect(working[working.length - 1].isAMRAP).toBe(true)
    expect(working[0].isAMRAP).toBe(false)
  })

  it('uses correct percentages for week 1', () => {
    const working = sets1.filter((s) => !s.isWarmup && !s.isSupplemental)
    expect(working[0].percentage).toBe(0.65)
    expect(working[1].percentage).toBe(0.75)
    expect(working[2].percentage).toBe(0.85)
  })

  it('uses correct percentages for week 2', () => {
    const working = sets2.filter((s) => !s.isWarmup && !s.isSupplemental)
    expect(working[0].percentage).toBe(0.70)
    expect(working[1].percentage).toBe(0.80)
    expect(working[2].percentage).toBe(0.90)
  })

  it('uses correct percentages for week 3', () => {
    const working = sets3.filter((s) => !s.isWarmup && !s.isSupplemental)
    expect(working[0].percentage).toBe(0.75)
    expect(working[1].percentage).toBe(0.85)
    expect(working[2].percentage).toBe(0.95)
  })

  it('rounds all weights to nearest 2.5', () => {
    for (const s of sets1) {
      expect(s.weight % 2.5).toBe(0)
    }
  })

  it('supplemental percentage matches first working set', () => {
    const working = sets1.filter((s) => !s.isWarmup && !s.isSupplemental)
    const supp = sets1.filter((s) => s.isSupplemental)
    expect(supp[0].percentage).toBe(working[0].percentage)
  })
})
