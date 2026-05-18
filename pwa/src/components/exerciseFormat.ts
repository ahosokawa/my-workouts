import { AccessoryWeightType } from '../types'
import type { AccessoryExercise } from '../types'

export function describeWeightType(weightType: AccessoryWeightType): string {
  switch (weightType) {
    case AccessoryWeightType.Barbell: return 'Barbell'
    case AccessoryWeightType.Bodyweight: return 'Bodyweight'
    case AccessoryWeightType.NoWeight: return 'No Weight'
    case AccessoryWeightType.Standard: return 'Standard'
  }
}

/** Format an AccessoryExercise's secondary line as "{sets}x{reps} (Type)" — or with a rep range when present. */
export function accessorySecondary(ex: AccessoryExercise): string {
  const wt = describeWeightType(ex.weightType)
  const reps =
    ex.repRangeMin !== undefined && ex.repRangeMax !== undefined
      ? `${ex.repRangeMin}-${ex.repRangeMax}`
      : String(ex.reps)
  return `${ex.sets}x${reps}${wt && wt !== 'Standard' ? ` (${wt === 'Bodyweight' ? 'BW' : wt === 'No Weight' ? 'no weight' : wt})` : ''}`
}
