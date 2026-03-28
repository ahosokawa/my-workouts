import { ProgramVariant, PhaseType } from '../types'

export interface VariantConfig {
  label: string
  shortLabel: string
  phase: PhaseType
  supplementalSets: number
  supplementalReps: number
  supplementalPercentage: (week: number) => number
  description: string
}

/** First working set % by week */
function firstWorkingPct(week: number): number {
  switch (week) {
    case 1: return 0.65
    case 2: return 0.70
    case 3: return 0.75
    default: return 0.65
  }
}

/** Second working set % by week */
function secondWorkingPct(week: number): number {
  switch (week) {
    case 1: return 0.75
    case 2: return 0.80
    case 3: return 0.85
    default: return 0.75
  }
}

export const VARIANT_CONFIGS: Record<ProgramVariant, VariantConfig> = {
  [ProgramVariant.FSL]: {
    label: 'First Set Last',
    shortLabel: 'FSL',
    phase: PhaseType.Anchor,
    supplementalSets: 5,
    supplementalReps: 5,
    supplementalPercentage: firstWorkingPct,
    description: '5×5 at first working set percentage',
  },
  [ProgramVariant.BBB]: {
    label: 'Boring But Big',
    shortLabel: 'BBB',
    phase: PhaseType.Leader,
    supplementalSets: 5,
    supplementalReps: 10,
    supplementalPercentage: () => 0.50,
    description: '5×10 at 50% of training max',
  },
  [ProgramVariant.SSL]: {
    label: 'Second Set Last',
    shortLabel: 'SSL',
    phase: PhaseType.Leader,
    supplementalSets: 5,
    supplementalReps: 5,
    supplementalPercentage: secondWorkingPct,
    description: '5×5 at second working set percentage',
  },
  [ProgramVariant.BBS]: {
    label: 'Boring But Strong',
    shortLabel: 'BBS',
    phase: PhaseType.Leader,
    supplementalSets: 10,
    supplementalReps: 5,
    supplementalPercentage: firstWorkingPct,
    description: '10×5 at first working set percentage',
  },
}

export function getVariantConfig(variant: ProgramVariant): VariantConfig {
  return VARIANT_CONFIGS[variant]
}

/** Suggest phase based on completed leader/anchor counts.
 *  2+ Leaders → suggest Anchor, 1+ Anchor → suggest Leader, default Leader.
 */
export function suggestPhase(leaderCount: number, anchorCount: number): PhaseType {
  if (leaderCount >= 2) return PhaseType.Anchor
  if (anchorCount >= 1) return PhaseType.Leader
  return PhaseType.Leader
}

export function variantsForPhase(phase: PhaseType): VariantConfig[] {
  return Object.values(VARIANT_CONFIGS).filter((v) => v.phase === phase)
}
