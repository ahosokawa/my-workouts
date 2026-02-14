// ============================================================
// Wilks Score Calculator (Male coefficients)
// ============================================================

const a = -216.0475144
const b = 16.2606339
const c = -0.002388645
const d = -0.00113732
const e = 7.01863e-6
const f = -1.291e-8

const LBS_TO_KG = 0.45359237

/**
 * Calculate the Wilks score.
 * Returns null if inputs are invalid.
 */
export function calculateWilks(
  bodyWeightLbs: number,
  squatLbs: number,
  benchLbs: number,
  deadliftLbs: number,
): number | null {
  if (bodyWeightLbs <= 0) return null

  const bwKg = bodyWeightLbs * LBS_TO_KG
  const totalKg = (squatLbs + benchLbs + deadliftLbs) * LBS_TO_KG

  if (totalKg <= 0) return null

  const coeff =
    a +
    b * bwKg +
    c * Math.pow(bwKg, 2) +
    d * Math.pow(bwKg, 3) +
    e * Math.pow(bwKg, 4) +
    f * Math.pow(bwKg, 5)

  if (coeff <= 0) return null

  return totalKg * (500 / coeff)
}

/** Format a Wilks score for display */
export function formatWilks(score: number): string {
  return score.toFixed(1)
}
