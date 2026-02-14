// ============================================================
// Brzycki Estimated 1RM
// ============================================================

/**
 * Calculate estimated 1RM from weight and reps.
 * Formula: weight × (36 / (37 - reps))
 * Returns null if reps <= 0 or reps >= 37
 */
export function estimated1RM(weight: number, reps: number): number | null {
  if (reps <= 0 || reps >= 37) return null
  if (reps === 1) return weight
  return weight * (36 / (37 - reps))
}

/** Format an estimated 1RM for display */
export function formatted1RM(weight: number, reps: number): string | null {
  const e1rm = estimated1RM(weight, reps)
  if (e1rm === null) return null
  return `${Math.round(e1rm)} lbs`
}
