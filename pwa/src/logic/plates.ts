// ============================================================
// Plate Calculator
// ============================================================

import type { Units } from '../types'

export interface PlateCount {
  plateWeight: number
  count: number
}

export const BARBELL_WEIGHT_LBS = 45
export const BARBELL_WEIGHT_KG = 20

/** @deprecated Use barbellWeight(units) instead */
export const BARBELL_WEIGHT = BARBELL_WEIGHT_LBS

const PLATES_LBS = [45, 25, 15, 10, 5, 2.5, 1.25]
const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25, 0.5]

export function barbellWeight(units: Units = 'lbs'): number {
  return units === 'kg' ? BARBELL_WEIGHT_KG : BARBELL_WEIGHT_LBS
}

/** Calculate plates needed per side for a given total weight */
export function platesPerSide(totalWeight: number, units: Units = 'lbs'): PlateCount[] {
  const barWeight = barbellWeight(units)
  const plates = units === 'kg' ? PLATES_KG : PLATES_LBS

  if (totalWeight <= barWeight) return []

  let remaining = (totalWeight - barWeight) / 2
  const result: PlateCount[] = []

  for (const plate of plates) {
    if (remaining >= plate) {
      const count = Math.floor(remaining / plate)
      result.push({ plateWeight: plate, count })
      remaining -= count * plate
    }
  }

  return result
}

/** Format a plate weight for display (handles decimals) */
export function formatPlateWeight(weight: number): string {
  if (weight === Math.round(weight)) return String(weight)
  return String(weight)
}

/** Format a plate breakdown as a compact string (e.g. "45 + 15 + 2.5") */
export function formattedBreakdown(totalWeight: number, units: Units = 'lbs'): string | null {
  const plates = platesPerSide(totalWeight, units)
  if (plates.length === 0) return null

  const parts = plates.flatMap((p) =>
    Array.from({ length: p.count }, () => formatPlateWeight(p.plateWeight)),
  )
  return parts.join(' + ')
}
