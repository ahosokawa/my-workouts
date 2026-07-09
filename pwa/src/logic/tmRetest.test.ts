import { describe, it, expect } from 'vitest'
import { tmRetestSets, suggestedTMFromRetest, reseedTopSetFromTM } from './tmRetest'
import { getProgram } from './programs'
import { ProgramType } from '../types'
import { estimated1RM } from './brzycki'

describe('tmRetestSets', () => {
  const sets = tmRetestSets(255, { min: 5, max: 6 })

  it('builds 3 warmups at 50/70/85% of current TM', () => {
    const warmups = sets.filter((s) => s.isWarmup)
    expect(warmups.map((s) => s.percentage)).toEqual([0.5, 0.7, 0.85])
    expect(warmups.map((s) => s.targetReps)).toEqual([5, 3, 2])
    expect(warmups.map((s) => s.weight)).toEqual([127.5, 177.5, 217.5])
  })

  it('suggests the retest top set at 90% of TM, marked AMRAP with the rep range', () => {
    const top = sets[sets.length - 1]
    expect(top.isAMRAP).toBe(true)
    expect(top.percentage).toBe(0.9)
    expect(top.weight).toBe(230) // 255 * 0.9 = 229.5 → 230
    expect(top.targetReps).toBe(5)
    expect(top.repRangeMin).toBe(5)
    expect(top.repRangeMax).toBe(6)
  })
})

describe('suggestedTMFromRetest', () => {
  it('returns 85% of the Brzycki e1RM, rounded', () => {
    // 230 × 5: e1RM = 230 * 36/32 = 258.75; ×0.85 = 219.94 → 220
    expect(suggestedTMFromRetest(230, 5, 'lbs')).toBe(220)
  })

  it('single rep uses the weight itself as e1RM', () => {
    expect(estimated1RM(240, 1)).toBe(240)
    expect(suggestedTMFromRetest(240, 1, 'lbs')).toBe(Math.round(240 * 0.85 / 2.5) * 2.5)
  })

  it('null for impossible rep counts', () => {
    expect(suggestedTMFromRetest(230, 0, 'lbs')).toBeNull()
    expect(suggestedTMFromRetest(230, 40, 'lbs')).toBeNull()
  })
})

describe('reseedTopSetFromTM', () => {
  it('uses the program seed fraction (85% of TM)', () => {
    const def = getProgram(ProgramType.UpperLower)
    // 220 * 0.85 = 187 → 187.5
    expect(reseedTopSetFromTM(def, 220, 'lbs')).toBe(187.5)
  })
})
