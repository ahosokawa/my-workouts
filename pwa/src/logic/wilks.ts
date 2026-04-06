// ============================================================
// Wilks Score Calculator (Male & Female coefficients)
// ============================================================

import type { Units } from '../types'
import { LBS_TO_KG } from '../types'

const MALE_COEFFICIENTS = {
  a: -216.0475144,
  b: 16.2606339,
  c: -0.002388645,
  d: -0.00113732,
  e: 7.01863e-6,
  f: -1.291e-8,
} as const

const FEMALE_COEFFICIENTS = {
  a: 594.31747775582,
  b: -27.23842536447,
  c: 0.82112226871,
  d: -0.00930733913,
  e: 4.731582e-5,
  f: -9.054e-8,
} as const

/**
 * Calculate the Wilks score.
 * Accepts weights in either lbs or kg (specified by units param).
 * Returns null if inputs are invalid.
 */
export function calculateWilks(
  bodyWeight: number,
  squat: number,
  bench: number,
  deadlift: number,
  sex: 'male' | 'female' = 'male',
  units: Units = 'lbs',
): number | null {
  if (bodyWeight <= 0) return null

  const bwKg = units === 'kg' ? bodyWeight : bodyWeight * LBS_TO_KG
  const totalKg = units === 'kg' ? (squat + bench + deadlift) : (squat + bench + deadlift) * LBS_TO_KG

  if (totalKg <= 0) return null

  const c = sex === 'female' ? FEMALE_COEFFICIENTS : MALE_COEFFICIENTS
  const coeff =
    c.a +
    c.b * bwKg +
    c.c * Math.pow(bwKg, 2) +
    c.d * Math.pow(bwKg, 3) +
    c.e * Math.pow(bwKg, 4) +
    c.f * Math.pow(bwKg, 5)

  if (coeff <= 0) return null

  return totalKg * (500 / coeff)
}

/** Format a Wilks score for display */
export function formatWilks(score: number): string {
  return score.toFixed(1)
}
