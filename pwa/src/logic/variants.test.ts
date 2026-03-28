import { describe, it, expect } from 'vitest'
import { VARIANT_CONFIGS, getVariantConfig, suggestPhase, variantsForPhase } from './variants'
import { ProgramVariant, PhaseType } from '../types'

describe('VARIANT_CONFIGS', () => {
  it('has all four variants', () => {
    expect(Object.keys(VARIANT_CONFIGS)).toHaveLength(4)
    expect(VARIANT_CONFIGS[ProgramVariant.FSL]).toBeDefined()
    expect(VARIANT_CONFIGS[ProgramVariant.BBB]).toBeDefined()
    expect(VARIANT_CONFIGS[ProgramVariant.SSL]).toBeDefined()
    expect(VARIANT_CONFIGS[ProgramVariant.BBS]).toBeDefined()
  })

  it('each config has required fields', () => {
    for (const config of Object.values(VARIANT_CONFIGS)) {
      expect(config.label).toBeTruthy()
      expect(config.shortLabel).toBeTruthy()
      expect([PhaseType.Leader, PhaseType.Anchor]).toContain(config.phase)
      expect(config.supplementalSets).toBeGreaterThan(0)
      expect(config.supplementalReps).toBeGreaterThan(0)
      expect(typeof config.supplementalPercentage).toBe('function')
      expect(config.description).toBeTruthy()
    }
  })

  it('FSL is Anchor phase', () => {
    expect(VARIANT_CONFIGS[ProgramVariant.FSL].phase).toBe(PhaseType.Anchor)
  })

  it('BBB, SSL, BBS are Leader phase', () => {
    expect(VARIANT_CONFIGS[ProgramVariant.BBB].phase).toBe(PhaseType.Leader)
    expect(VARIANT_CONFIGS[ProgramVariant.SSL].phase).toBe(PhaseType.Leader)
    expect(VARIANT_CONFIGS[ProgramVariant.BBS].phase).toBe(PhaseType.Leader)
  })
})

describe('getVariantConfig', () => {
  it('returns the correct config for each variant', () => {
    expect(getVariantConfig('fsl').shortLabel).toBe('FSL')
    expect(getVariantConfig('bbb').shortLabel).toBe('BBB')
    expect(getVariantConfig('ssl').shortLabel).toBe('SSL')
    expect(getVariantConfig('bbs').shortLabel).toBe('BBS')
  })
})

describe('suggestPhase', () => {
  it('suggests Anchor after 2 Leaders', () => {
    expect(suggestPhase(2, 0)).toBe(PhaseType.Anchor)
    expect(suggestPhase(3, 0)).toBe(PhaseType.Anchor)
  })

  it('suggests Leader after 1 Anchor', () => {
    expect(suggestPhase(0, 1)).toBe(PhaseType.Leader)
    expect(suggestPhase(0, 2)).toBe(PhaseType.Leader)
  })

  it('defaults to Leader when both are 0', () => {
    expect(suggestPhase(0, 0)).toBe(PhaseType.Leader)
  })

  it('suggests Leader when 1 Leader 0 Anchor', () => {
    expect(suggestPhase(1, 0)).toBe(PhaseType.Leader)
  })
})

describe('variantsForPhase', () => {
  it('returns only Leader variants', () => {
    const leaders = variantsForPhase(PhaseType.Leader)
    expect(leaders.every((v) => v.phase === PhaseType.Leader)).toBe(true)
    expect(leaders).toHaveLength(3) // BBB, SSL, BBS
  })

  it('returns only Anchor variants', () => {
    const anchors = variantsForPhase(PhaseType.Anchor)
    expect(anchors.every((v) => v.phase === PhaseType.Anchor)).toBe(true)
    expect(anchors).toHaveLength(1) // FSL
  })
})
