// ============================================================
// Muscle-group resolution for volume metrics
// ============================================================
//
// Set logs only carry an exercise name, so historical data (and untagged
// custom accessories) resolve muscle groups by name inference. An explicit
// `muscleGroups` tag on an accessory always wins.

import type { AccessoryExercise, MuscleGroup } from '../types'

/** Ordered keyword rules — first match wins. Specific patterns come before
 *  generic ones ('leg raise' before 'lateral raise', 'row' before 'chest'). */
const RULES: [RegExp, MuscleGroup[]][] = [
  [/face ?pull/, ['shoulders', 'back']],
  [/external rotation|rotator/, ['shoulders']],
  [/calf/, ['calves']],
  [/leg raise|rollout|wheel|plank|crunch|sit-?up|\bab\b|hollow/, ['core']],
  [/pushdown|triceps?|skull/, ['triceps']],
  [/leg curl/, ['hamstrings']],
  [/curl/, ['biceps']],
  [/\brows?\b|pull-?ups?|pull ups?|chin-?ups?|pulldown|\blat\b/, ['back', 'biceps']],
  [/lateral raise|front raise|rear delt/, ['shoulders']],
  [/overhead press|shoulder press|\bohp\b|arnold/, ['shoulders', 'triceps']],
  [/bench|\bdips?\b|fly|push-?ups?/, ['chest', 'triceps']],
  [/deadlift|\brdl\b|good ?morning/, ['hamstrings', 'glutes', 'back']],
  [/squat|lunge|leg press|step-?up/, ['quads', 'glutes']],
  [/hip thrust|glute/, ['glutes']],
]

/** Best-effort muscle groups for an exercise name. Falls back to ['other']. */
export function inferMuscleGroups(exerciseName: string): MuscleGroup[] {
  const name = exerciseName.toLowerCase()
  for (const [pattern, groups] of RULES) {
    if (pattern.test(name)) return groups
  }
  return ['other']
}

/** Index of explicit muscle-group tags from the user's current plan, keyed by
 *  lowercased exercise name. */
export function accessoryTagIndex(
  customAccessories: Record<number, AccessoryExercise[]> | null,
): Record<string, MuscleGroup[]> {
  const idx: Record<string, MuscleGroup[]> = {}
  if (!customAccessories) return idx
  for (const key of Object.keys(customAccessories)) {
    for (const ex of customAccessories[Number(key)] ?? []) {
      if (ex.muscleGroups && ex.muscleGroups.length > 0) {
        idx[ex.name.toLowerCase()] = ex.muscleGroups
      }
    }
  }
  return idx
}

/** Explicit tag → inference → 'other'. */
export function resolveMuscleGroups(
  exerciseName: string,
  tags?: Record<string, MuscleGroup[]>,
): MuscleGroup[] {
  return tags?.[exerciseName.toLowerCase()] ?? inferMuscleGroups(exerciseName)
}

export function muscleGroupLabel(g: MuscleGroup): string {
  return g.charAt(0).toUpperCase() + g.slice(1)
}
