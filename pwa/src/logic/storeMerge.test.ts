import { describe, it, expect } from 'vitest'
import { mergePersistedState } from '../store'
import type { UserProfile, AccessoryExercise } from '../types'
import { MainLift, MAIN_LIFTS, AccessoryWeightType } from '../types'
import { FIVE_THREE_ONE_ACCESSORIES } from './accessories'

// Minimal valid profile for simulating existing users
const EXISTING_PROFILE: UserProfile = {
  squatOneRepMax: 300,
  benchOneRepMax: 225,
  deadliftOneRepMax: 400,
  pressOneRepMax: 135,
  squatTM: 270,
  benchTM: 202.5,
  deadliftTM: 360,
  pressTM: 122.5,
  currentWeek: 2,
  currentDay: 3,
  cycleNumber: 2,
  isCycleComplete: false,
  currentVariant: 'fsl',
  leaderCycleCount: 1,
  anchorCycleCount: 0,
  tmPercentage: 90,
  sex: 'male',
  units: 'lbs',
  isDeloading: false,
  deloadType: null,
  deloadDay: 1,
  bodyWeightLbs: 180,
  bodyWeightLastUpdated: '2026-01-01T00:00:00.000Z',
  createdAt: '2025-12-01T00:00:00.000Z',
  programType: '531',
  cycleWeeks: 3,
}

// A "current" state skeleton — mergePersistedState spreads persisted over this.
// We only need the shape; the real store provides defaults via create().
function freshDefaults() {
  // We call mergePersistedState(persisted, current).
  // `current` is the in-memory default the store starts with before hydration.
  return mergePersistedState({}, {
    profile: null,
    sessions: [],
    setLogs: [],
    wilksEntries: [],
    activeWorkout: {
      isActive: false,
      startTime: null,
      completedMain: [],
      completedAccessory: [],
      amrapReps: 0,
      accWeights: {},
      accReps: {},
      mainWeights: {},
      mainReps: {},
      lastSetTime: null,
      showRestTimer: false,
    },
    customAccessories: null,
    savedExercises: [],
    restNotifyEnabled: true,
    restNotifyMinutes: 3,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  } as any)
}

function currentState() {
  return freshDefaults()
}

describe('mergePersistedState — accessory migration', () => {
  it('populates default accessories for existing user with customAccessories: null', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      customAccessories: null,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.customAccessories).not.toBeNull()
    for (const lift of MAIN_LIFTS) {
      const expected = FIVE_THREE_ONE_ACCESSORIES[lift]
      const actual = result.customAccessories![lift]
      expect(actual).toHaveLength(expected.length)
      expect(actual.map((a: AccessoryExercise) => a.name)).toEqual(expected.map((e: AccessoryExercise) => e.name))
    }
  })

  it('populates default accessories for existing user with customAccessories: undefined', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      // customAccessories not present at all — simulates old localStorage shape
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.customAccessories).not.toBeNull()
    for (const lift of MAIN_LIFTS) {
      const expected = FIVE_THREE_ONE_ACCESSORIES[lift]
      const actual = result.customAccessories![lift]
      expect(actual).toHaveLength(expected.length)
    }
  })

  it('does NOT overwrite existing custom accessories', () => {
    const custom: Record<number, AccessoryExercise[]> = {
      [MainLift.Squat]: [{ id: 'custom1', name: 'Leg Press', sets: 4, reps: 10, weightType: AccessoryWeightType.Standard }],
      [MainLift.BenchPress]: [],
      [MainLift.Deadlift]: [],
      [MainLift.ShoulderPress]: [],
    }
    const persisted = {
      profile: EXISTING_PROFILE,
      customAccessories: custom,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.customAccessories![MainLift.Squat]).toHaveLength(1)
    expect(result.customAccessories![MainLift.Squat][0].name).toBe('Leg Press')
    expect(result.customAccessories![MainLift.BenchPress]).toHaveLength(0)
  })

  it('does NOT populate accessories for brand new user (no profile)', () => {
    const persisted = {
      profile: null,
      customAccessories: null,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.customAccessories).toBeNull()
  })

  it('is idempotent — does not re-populate after migration flag is set', () => {
    // First merge: existing user, null accessories → populates defaults
    const persisted1 = {
      profile: EXISTING_PROFILE,
      customAccessories: null,
    }
    const after1 = mergePersistedState(persisted1, currentState())
    expect(after1.customAccessories).not.toBeNull()
    expect((after1 as unknown as Record<string, unknown>)._migratedAccessories).toBe(true)

    // User then clears all accessories (sets them to empty arrays)
    const cleared: Record<number, AccessoryExercise[]> = {
      [MainLift.Squat]: [],
      [MainLift.BenchPress]: [],
      [MainLift.Deadlift]: [],
      [MainLift.ShoulderPress]: [],
    }

    // Second merge: simulates next app load with cleared accessories and migration flag
    const persisted2 = {
      ...after1,
      customAccessories: cleared,
    }
    const after2 = mergePersistedState(persisted2, currentState())

    // Should keep the empty arrays, NOT re-populate defaults
    for (const lift of MAIN_LIFTS) {
      expect(after2.customAccessories![lift]).toHaveLength(0)
    }
  })

  it('does not re-populate if user sets customAccessories to null after migration', () => {
    // Simulate: migrated once, then somehow customAccessories is null again
    const persisted = {
      profile: EXISTING_PROFILE,
      customAccessories: null,
      _migratedAccessories: true,
    }

    const result = mergePersistedState(persisted, currentState())

    // Migration flag prevents re-population; falls through to the undefined→null default
    expect(result.customAccessories).toBeNull()
  })
})

describe('mergePersistedState — tmPercentage migration', () => {
  it('defaults tmPercentage to 90 for existing user without it', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { tmPercentage: _, ...profileWithoutTmPct } = EXISTING_PROFILE
    const persisted = {
      profile: profileWithoutTmPct,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.tmPercentage).toBe(90)
  })

  it('preserves existing tmPercentage', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, tmPercentage: 85 as const },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.tmPercentage).toBe(85)
  })
})

describe('mergePersistedState — sex migration', () => {
  it('defaults sex to male for existing user without it', () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sex: __, ...profileWithoutSex } = EXISTING_PROFILE
    const persisted = {
      profile: profileWithoutSex,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.sex).toBe('male')
  })

  it('preserves existing sex setting', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, sex: 'female' as const },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.sex).toBe('female')
  })
})

describe('mergePersistedState — program type migration', () => {
  it("defaults programType to '531' for existing user without it", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { programType: _, cycleWeeks: __, ...legacy } = EXISTING_PROFILE
    const persisted = {
      profile: legacy,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.programType).toBe('531')
    expect(result.profile!.cycleWeeks).toBe(3)
  })

  it("preserves a 'hypertrophy' programType when already set", () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, programType: 'hypertrophy' as const, cycleWeeks: 7 },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.programType).toBe('hypertrophy')
    expect(result.profile!.cycleWeeks).toBe(7)
  })

  it('preserves cycleWeeks when already set', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, cycleWeeks: 5 },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.cycleWeeks).toBe(5)
  })
})

describe('mergePersistedState — day order migration', () => {
  it('defaults dayOrder to the standard order for existing user without it', () => {
    const persisted = { profile: EXISTING_PROFILE }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.dayOrder).toEqual([
      MainLift.Squat,
      MainLift.BenchPress,
      MainLift.Deadlift,
      MainLift.ShoulderPress,
    ])
  })

  it('preserves a valid custom dayOrder', () => {
    const custom = [MainLift.BenchPress, MainLift.Squat, MainLift.ShoulderPress, MainLift.Deadlift]
    const persisted = { profile: { ...EXISTING_PROFILE, dayOrder: custom } }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.dayOrder).toEqual(custom)
  })

  it('resets a dayOrder with duplicates to the default', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, dayOrder: [1, 1, 2, 3] as MainLift[] },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.dayOrder).toEqual([...MAIN_LIFTS])
  })

  it('resets a wrong-length dayOrder to the default', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, dayOrder: [MainLift.Squat, MainLift.BenchPress] },
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.profile!.dayOrder).toEqual([...MAIN_LIFTS])
  })
})

describe('mergePersistedState — completed-days migration', () => {
  it('derives completedDaysThisWeek from currentDay for a legacy profile (linear history)', () => {
    // EXISTING_PROFILE is mid-week at currentDay 3 → days 1 and 2 were done.
    const result = mergePersistedState({ profile: EXISTING_PROFILE }, currentState())
    expect(result.profile!.completedDaysThisWeek).toEqual([1, 2])
  })

  it('yields an empty list when a legacy profile is at day 1', () => {
    const persisted = { profile: { ...EXISTING_PROFILE, currentDay: 1 } }
    const result = mergePersistedState(persisted, currentState())
    expect(result.profile!.completedDaysThisWeek).toEqual([])
  })

  it('preserves an existing completedDaysThisWeek', () => {
    const persisted = { profile: { ...EXISTING_PROFILE, completedDaysThisWeek: [2] } }
    const result = mergePersistedState(persisted, currentState())
    expect(result.profile!.completedDaysThisWeek).toEqual([2])
  })
})

describe('mergePersistedState — notification defaults', () => {
  it('adds notification defaults for existing user without them', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      // no restNotifyEnabled or restNotifyMinutes
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.restNotifyEnabled).toBe(true)
    expect(result.restNotifyMinutes).toBe(3)
  })

  it('preserves existing notification settings', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      restNotifyEnabled: false,
      restNotifyMinutes: 5,
    }

    const result = mergePersistedState(persisted, currentState())

    expect(result.restNotifyEnabled).toBe(false)
    expect(result.restNotifyMinutes).toBe(5)
  })
})

describe('mergePersistedState — active workout day pin', () => {
  // An activeWorkout persisted before the day/liftRawValue pin fields existed.
  function prePinActiveWorkout(overrides: Record<string, unknown> = {}) {
    return {
      isActive: true,
      startTime: 123,
      completedMain: [],
      completedAccessory: [],
      amrapReps: 5,
      accWeights: {},
      accReps: {},
      mainWeights: {},
      mainReps: {},
      lastSetTime: null,
      showRestTimer: false,
      ...overrides,
    }
  }

  it('heals an in-progress workout with no pin to the profile position', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, currentDay: 2 },
      activeWorkout: prePinActiveWorkout(),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.day).toBe(2)
    // Default day order → day 2 is Bench Press.
    expect(result.activeWorkout.liftRawValue).toBe(MainLift.BenchPress)
  })

  it('resolves the pinned lift through a custom day order', () => {
    const custom = [MainLift.BenchPress, MainLift.Squat, MainLift.Deadlift, MainLift.ShoulderPress]
    const persisted = {
      profile: { ...EXISTING_PROFILE, currentDay: 1, dayOrder: custom },
      activeWorkout: prePinActiveWorkout(),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.day).toBe(1)
    expect(result.activeWorkout.liftRawValue).toBe(MainLift.BenchPress)
  })

  it('leaves an inactive workout unpinned', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      activeWorkout: prePinActiveWorkout({ isActive: false }),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.day).toBeNull()
    expect(result.activeWorkout.liftRawValue).toBeNull()
  })

  it('preserves an already-pinned in-progress workout', () => {
    const persisted = {
      profile: { ...EXISTING_PROFILE, currentDay: 1 },
      activeWorkout: prePinActiveWorkout({ day: 3, liftRawValue: MainLift.Deadlift }),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.day).toBe(3)
    expect(result.activeWorkout.liftRawValue).toBe(MainLift.Deadlift)
  })

  it('does not crash healing an active workout with no profile', () => {
    const persisted = {
      profile: null,
      activeWorkout: prePinActiveWorkout(),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.day).toBeNull()
  })

  it('fills null prescription-snapshot fields for a legacy in-flight workout', () => {
    // Persisted before week/tmLbs/topSetLbs existed — readers must see null
    // and fall back to live profile values (the pre-snapshot behavior).
    const persisted = {
      profile: EXISTING_PROFILE,
      activeWorkout: prePinActiveWorkout({ day: 2, liftRawValue: MainLift.BenchPress }),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.week).toBeNull()
    expect(result.activeWorkout.tmLbs).toBeNull()
    expect(result.activeWorkout.topSetLbs).toBeNull()
  })

  it('preserves captured snapshot fields', () => {
    const persisted = {
      profile: EXISTING_PROFILE,
      activeWorkout: prePinActiveWorkout({ day: 2, liftRawValue: MainLift.BenchPress, week: 2, tmLbs: 202.5, topSetLbs: null }),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.activeWorkout.week).toBe(2)
    expect(result.activeWorkout.tmLbs).toBe(202.5)
  })
})

// ============================================================
// Upper/Lower accessory revision migration
// ============================================================

describe('mergePersistedState — Upper/Lower accessory revision', () => {
  const UL_PROFILE: UserProfile = { ...EXISTING_PROFILE, programType: 'upper_lower', cycleWeeks: 7 }
  const flag = (r: unknown) => (r as { _migratedUpperLowerPlan?: boolean })._migratedUpperLowerPlan

  // Old default lists as they exist in live users' customAccessories
  const oldPlan = (): Record<number, AccessoryExercise[]> => ({
    [MainLift.Squat]: [
      { id: 'ul-rdl', name: 'Romanian Deadlift', weightType: AccessoryWeightType.Barbell, sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10, progressionType: 'double_progression' },
      { id: 'ul-lat-raise-l', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard, sets: 3, reps: 13, repRangeMin: 12, repRangeMax: 15, progressionType: 'double_progression' },
    ],
    [MainLift.BenchPress]: [
      { id: 'ul-pullup', name: 'Pull-Ups', weightType: AccessoryWeightType.Bodyweight, sets: 4, reps: 7, repRangeMin: 6, repRangeMax: 8, progressionType: 'reps_then_load' },
      { id: 'ul-incline-db', name: 'Incline DB Bench Press', weightType: AccessoryWeightType.Standard, sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10, progressionType: 'double_progression' },
      { id: 'ul-curl', name: 'DB Bicep Curl', weightType: AccessoryWeightType.Standard, sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12, progressionType: 'double_progression' },
    ],
    [MainLift.Deadlift]: [
      { id: 'ul-front-sq', name: 'Front Squat', weightType: AccessoryWeightType.Barbell, sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12, progressionType: 'double_progression' },
    ],
    [MainLift.ShoulderPress]: [
      { id: 'ul-lat-raise-b', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard, sets: 4, reps: 13, repRangeMin: 12, repRangeMax: 15, progressionType: 'double_progression' },
      { id: 'ul-facepull', name: 'Band Facepull', weightType: AccessoryWeightType.NoWeight, sets: 3, reps: 17, repRangeMin: 15, repRangeMax: 20, progressionType: 'reps_only' },
    ],
  })

  it('applies all four revisions to an unmodified live plan', () => {
    const result = mergePersistedState({ profile: UL_PROFILE, customAccessories: oldPlan() }, currentState())
    const acc = result.customAccessories!
    // Upper A: One-Arm DB Row inserted after Incline
    const benchNames = acc[MainLift.BenchPress].map((e) => e.name)
    expect(benchNames).toEqual(['Pull-Ups', 'Incline DB Bench Press', 'One-Arm DB Row', 'DB Bicep Curl'])
    // Lower A: default lateral raise removed
    expect(acc[MainLift.Squat].map((e) => e.name)).toEqual(['Romanian Deadlift'])
    // Upper B: Band Triceps Pushdown inserted after lateral raise
    expect(acc[MainLift.ShoulderPress].map((e) => e.name)).toEqual(['DB Lateral Raise', 'Band Triceps Pushdown', 'Band Facepull'])
    // Lower B: Front Squat retargeted to 6-8
    const fs = acc[MainLift.Deadlift][0]
    expect(fs.repRangeMin).toBe(6)
    expect(fs.repRangeMax).toBe(8)
    expect(fs.reps).toBe(7)
    expect(flag(result)).toBe(true)
  })

  it('respects user customizations: renamed lat raise kept, edited Front Squat range kept, no duplicate row', () => {
    const plan = oldPlan()
    plan[MainLift.Squat][1] = { ...plan[MainLift.Squat][1], name: 'Cable Lateral Raise' }
    plan[MainLift.Deadlift][0] = { ...plan[MainLift.Deadlift][0], repRangeMin: 8, repRangeMax: 10 }
    plan[MainLift.BenchPress].push({ id: 'custom-row', name: 'One-Arm DB Row', weightType: AccessoryWeightType.Standard, sets: 4, reps: 10 })
    const result = mergePersistedState({ profile: UL_PROFILE, customAccessories: plan }, currentState())
    const acc = result.customAccessories!
    expect(acc[MainLift.Squat].map((e) => e.name)).toContain('Cable Lateral Raise')
    expect(acc[MainLift.Deadlift][0].repRangeMin).toBe(8)
    // No duplicate insert — the user's own One-Arm DB Row is the only one
    expect(acc[MainLift.BenchPress].filter((e) => e.name === 'One-Arm DB Row')).toHaveLength(1)
    expect(acc[MainLift.BenchPress].find((e) => e.name === 'One-Arm DB Row')!.sets).toBe(4)
  })

  it('skips the live-plan revision while a workout is active, and retries later', () => {
    const persisted = {
      profile: UL_PROFILE,
      activeWorkout: { isActive: true, startTime: 1, day: 1, liftRawValue: 2 },
      customAccessories: oldPlan(),
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.customAccessories![MainLift.BenchPress].map((e) => e.name)).not.toContain('One-Arm DB Row')
    expect(flag(result)).toBeUndefined()
    const after = mergePersistedState({ ...result, activeWorkout: { ...result.activeWorkout, isActive: false } }, currentState())
    expect(after.customAccessories![MainLift.BenchPress].map((e) => e.name)).toContain('One-Arm DB Row')
    expect(flag(after)).toBe(true)
  })

  it('revises the archived Upper/Lower plan when another program is live, leaving the live plan alone', () => {
    const persisted = {
      profile: EXISTING_PROFILE, // 5/3/1 live
      customAccessories: { [MainLift.BenchPress]: [{ id: 'incline', name: 'Incline DB Bench Press', weightType: AccessoryWeightType.Standard, sets: 3, reps: 12 }] },
      programAccessoryArchive: { upper_lower: oldPlan() },
    }
    const result = mergePersistedState(persisted, currentState())
    expect(result.programAccessoryArchive.upper_lower![MainLift.BenchPress].map((e) => e.name)).toContain('One-Arm DB Row')
    expect(result.customAccessories![MainLift.BenchPress].map((e) => e.name)).not.toContain('One-Arm DB Row')
    expect(flag(result)).toBe(true)
  })

  it('is idempotent — a second normalize changes nothing', () => {
    const once = mergePersistedState({ profile: UL_PROFILE, customAccessories: oldPlan() }, currentState())
    const twice = mergePersistedState({ ...once }, currentState())
    expect(twice.customAccessories).toEqual(once.customAccessories)
    expect(flag(twice)).toBe(true)
  })
})
