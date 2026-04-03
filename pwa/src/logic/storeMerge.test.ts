import { describe, it, expect } from 'vitest'
import { mergePersistedState } from '../store'
import type { UserProfile, AccessoryExercise } from '../types'
import { MainLift, MAIN_LIFTS, AccessoryWeightType } from '../types'
import { getAccessories } from './accessories'

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
  bodyWeightLbs: 180,
  bodyWeightLastUpdated: '2026-01-01T00:00:00.000Z',
  createdAt: '2025-12-01T00:00:00.000Z',
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
      const expected = getAccessories(lift)
      const actual = result.customAccessories![lift]
      expect(actual).toHaveLength(expected.length)
      expect(actual.map((a: AccessoryExercise) => a.name)).toEqual(expected.map((e) => e.name))
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
      const expected = getAccessories(lift)
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
