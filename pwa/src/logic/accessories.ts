import { MainLift, AccessoryWeightType } from '../types'
import type { AccessoryExercise } from '../types'

// ============================================================
// Accessory Definitions
// ============================================================

/** Day 1: Squat accessories */
const SQUAT_ACCESSORIES: AccessoryExercise[] = [
  { id: 'rdl', name: 'Romanian Deadlift', sets: 3, reps: 8, weightType: AccessoryWeightType.Standard },
  { id: 'calf', name: 'DB Standing Calf Raise', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'wheel', name: 'Wheel Rollout', sets: 3, reps: 10, weightType: AccessoryWeightType.NoWeight },
]

/** Day 2: Bench Press accessories */
const BENCH_ACCESSORIES: AccessoryExercise[] = [
  { id: 'incline', name: 'Incline DB Bench Press', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'lateral', name: 'DB Lateral Raise', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'tricep', name: 'Standing Tricep Extension', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'extrot', name: 'Lying Shoulder External Rotation', sets: 3, reps: 10, weightType: AccessoryWeightType.Standard },
]

/** Day 3: Deadlift accessories */
const DEADLIFT_ACCESSORIES: AccessoryExercise[] = [
  { id: 'hammer', name: 'DB Hammer Curl', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'bicep', name: 'DB Bicep Curl', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'facepull', name: 'Band Face Pull', sets: 3, reps: 12, weightType: AccessoryWeightType.NoWeight },
]

/** Day 4: Overhead Press accessories */
const SHOULDER_PRESS_ACCESSORIES: AccessoryExercise[] = [
  { id: 'pullup', name: 'Pull Up', sets: 3, reps: 8, weightType: AccessoryWeightType.Bodyweight },
  { id: 'row', name: 'DB Bent Over Row', sets: 3, reps: 8, weightType: AccessoryWeightType.Standard },
]

/** Get accessories for a given main lift / day */
export function getAccessories(lift: MainLift): AccessoryExercise[] {
  switch (lift) {
    case MainLift.Squat: return SQUAT_ACCESSORIES
    case MainLift.BenchPress: return BENCH_ACCESSORIES
    case MainLift.Deadlift: return DEADLIFT_ACCESSORIES
    case MainLift.ShoulderPress: return SHOULDER_PRESS_ACCESSORIES
  }
}
