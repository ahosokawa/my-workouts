import { describe, it, expect } from 'vitest'
import { inferMuscleGroups, accessoryTagIndex, resolveMuscleGroups } from './muscleGroups'
import { AccessoryWeightType, MainLift } from '../types'

describe('inferMuscleGroups', () => {
  it('classifies the main lifts', () => {
    expect(inferMuscleGroups('Squat')).toEqual(['quads', 'glutes'])
    expect(inferMuscleGroups('Bench Press')).toEqual(['chest', 'triceps'])
    expect(inferMuscleGroups('Deadlift')).toEqual(['hamstrings', 'glutes', 'back'])
    expect(inferMuscleGroups('Overhead Press')).toEqual(['shoulders', 'triceps'])
  })

  it('classifies every default program accessory to something other than "other"', () => {
    const names = [
      'Romanian Deadlift', 'Bulgarian Split Squat', 'Single-Leg DB RDL', 'Standing Calf Raise',
      'Ab Wheel Rollout', 'Pull-Ups', 'Incline DB Bench Press', 'One-Arm DB Row', 'DB Lateral Raise',
      'Overhead DB Triceps Extension', 'DB Bicep Curl', 'Chest-Supported DB Row', 'Dips',
      'Band Triceps Pushdown', 'DB Hammer Curl', 'Band Facepull', 'Front Squat',
      'Seated DB Calf Raise', 'Hanging Leg Raise', 'Goblet Squat', 'Lying Shoulder External Rotation',
      'DB Bent Over Row', 'Wheel Rollout', 'Band Face Pull', 'Standing Tricep Extension',
    ]
    for (const name of names) {
      expect(inferMuscleGroups(name), name).not.toEqual(['other'])
    }
  })

  it('orders specific patterns before generic ones', () => {
    expect(inferMuscleGroups('Hanging Leg Raise')).toEqual(['core'])           // not shoulders
    expect(inferMuscleGroups('Chest-Supported DB Row')).toEqual(['back', 'biceps']) // not chest
    expect(inferMuscleGroups('Seated DB Calf Raise')).toEqual(['calves'])      // not shoulders
    expect(inferMuscleGroups('Overhead DB Triceps Extension')).toEqual(['triceps']) // not shoulders
  })

  it('falls back to other for unknown names', () => {
    expect(inferMuscleGroups('Farmer Carry')).toEqual(['other'])
  })
})

describe('explicit tags', () => {
  it('accessoryTagIndex collects tags across days; resolveMuscleGroups prefers them', () => {
    const idx = accessoryTagIndex({
      [MainLift.Squat]: [
        { id: 'x', name: 'Farmer Carry', weightType: AccessoryWeightType.Standard, sets: 3, reps: 10, muscleGroups: ['core', 'back'] },
        { id: 'y', name: 'Goblet Squat', weightType: AccessoryWeightType.Standard, sets: 3, reps: 10 },
      ],
    })
    expect(resolveMuscleGroups('Farmer Carry', idx)).toEqual(['core', 'back'])
    expect(resolveMuscleGroups('farmer carry', idx)).toEqual(['core', 'back'])
    expect(resolveMuscleGroups('Goblet Squat', idx)).toEqual(['quads', 'glutes']) // untagged → inference
  })
})
