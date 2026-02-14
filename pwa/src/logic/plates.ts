// ============================================================
// Plate Calculator
// ============================================================

export interface PlateCount {
  plateWeight: number
  count: number
}

export const BARBELL_WEIGHT = 45

const AVAILABLE_PLATES = [45, 25, 15, 10, 5, 2.5, 1.25]

/** Calculate plates needed per side for a given total weight */
export function platesPerSide(totalWeight: number): PlateCount[] {
  if (totalWeight <= BARBELL_WEIGHT) return []

  let remaining = (totalWeight - BARBELL_WEIGHT) / 2
  const result: PlateCount[] = []

  for (const plate of AVAILABLE_PLATES) {
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
  // Handle 2.5, 1.25 etc.
  return String(weight)
}

/** Format a plate breakdown as a compact string (e.g. "45 + 15 + 2.5") */
export function formattedBreakdown(totalWeight: number): string | null {
  const plates = platesPerSide(totalWeight)
  if (plates.length === 0) return null

  const parts = plates.flatMap((p) =>
    Array.from({ length: p.count }, () => formatPlateWeight(p.plateWeight)),
  )
  return parts.join(' + ')
}
