import { describe, it, expect } from 'vitest'
import { getUpcomingWorkouts } from './upcomingWorkouts'
import {
  AccessoryWeightType,
  MainLift,
  ProgramType,
  ProgramVariant,
} from '../types'
import type {
  AccessoryExercise,
  SupplementalOverride,
  UserProfile,
} from '../types'

function makeProfile(overrides: Partial<UserProfile> = {}): UserProfile {
  return {
    squatOneRepMax: 235,
    benchOneRepMax: 175,
    deadliftOneRepMax: 295,
    pressOneRepMax: 115,
    squatTM: 200,
    benchTM: 150,
    deadliftTM: 250,
    pressTM: 100,
    currentWeek: 1,
    currentDay: 1,
    cycleNumber: 1,
    isCycleComplete: false,
    currentVariant: ProgramVariant.FSL,
    leaderCycleCount: 0,
    anchorCycleCount: 0,
    tmPercentage: 90,
    sex: 'male',
    units: 'lbs',
    isDeloading: false,
    deloadType: null,
    deloadDay: 1,
    bodyWeightLbs: null,
    bodyWeightLastUpdated: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    programType: ProgramType.FiveThreeOne,
    cycleWeeks: 3,
    ...overrides,
  }
}

describe('getUpcomingWorkouts — 5/3/1', () => {
  it('mid-cycle W1 D2 returns 10 entries starting at W1 D3 Deadlift', () => {
    const profile = makeProfile({ currentWeek: 1, currentDay: 2, completedDaysThisWeek: [1] })
    const out = getUpcomingWorkouts(profile, null, null)
    expect(out).toHaveLength(10)
    expect(out[0].week).toBe(1)
    expect(out[0].day).toBe(3)
    expect(out[0].lift).toBe(MainLift.Deadlift)
    expect(out[0].title).toBe('Deadlift')
    // Each entry has 6 non-supplemental (3 warmup + 3 working) + 5 supplemental (FSL default)
    for (const w of out) {
      expect(w.mainSets).toHaveLength(6)
      expect(w.supplementalSets).toHaveLength(5)
      expect(w.mainSets.every((s) => !s.isSupplemental)).toBe(true)
      expect(w.supplementalSets.every((s) => s.isSupplemental)).toBe(true)
    }
  })

  it('last day W3 D4 returns []', () => {
    const profile = makeProfile({ currentWeek: 3, currentDay: 4, completedDaysThisWeek: [1, 2, 3] })
    expect(getUpcomingWorkouts(profile, null, null)).toEqual([])
  })

  it('fresh cycle W1 D1 returns 11 entries (W1 D2 through W3 D4)', () => {
    const profile = makeProfile({ currentWeek: 1, currentDay: 1 })
    const out = getUpcomingWorkouts(profile, null, null)
    expect(out).toHaveLength(11)
    expect(out[0]).toMatchObject({ week: 1, day: 2, lift: MainLift.BenchPress })
    expect(out[out.length - 1]).toMatchObject({ week: 3, day: 4, lift: MainLift.ShoulderPress })
  })

  it('variant BBB produces 5×10 @ 50% TM supplemental sets every week', () => {
    const profile = makeProfile({
      currentWeek: 1,
      currentDay: 1,
      currentVariant: ProgramVariant.BBB,
    })
    const out = getUpcomingWorkouts(profile, null, null)
    for (const w of out) {
      expect(w.supplementalSets).toHaveLength(5)
      const expectedWeight = Math.round((w.lift === MainLift.Squat ? 200 :
        w.lift === MainLift.BenchPress ? 150 :
        w.lift === MainLift.Deadlift ? 250 : 100) * 0.50 / 2.5) * 2.5
      for (const s of w.supplementalSets) {
        expect(s.targetReps).toBe(10)
        expect(s.percentage).toBeCloseTo(0.5)
        expect(s.weight).toBe(expectedWeight)
      }
      expect(w.variant).toBe(ProgramVariant.BBB)
    }
  })

  it('customSupplemental override computes supplemental sets off the override TM', () => {
    const override: SupplementalOverride = {
      exercise: { id: 'fs', name: 'Front Squat', weightType: AccessoryWeightType.Barbell },
      trainingMaxLbs: 180,
    }
    const profile = makeProfile({ currentWeek: 1, currentDay: 2 }) // upcoming includes deadlift day
    const customSupplemental = { [MainLift.Deadlift]: override }
    const out = getUpcomingWorkouts(profile, null, customSupplemental)
    const deadliftDays = out.filter((w) => w.lift === MainLift.Deadlift)
    expect(deadliftDays.length).toBeGreaterThan(0)
    for (const w of deadliftDays) {
      expect(w.supplementalDisplayName).toBe('Front Squat')
      // FSL percent = first-working-set % for that week (W1 65%, W2 70%, W3 75%) against the override TM (180).
      const pct = w.week === 1 ? 0.65 : w.week === 2 ? 0.70 : 0.75
      const expected = Math.round((180 * pct) / 2.5) * 2.5
      for (const s of w.supplementalSets) {
        expect(s.weight).toBe(expected)
      }
    }
  })

  it('customAccessories override replaces the default accessory list for that lift', () => {
    const custom: AccessoryExercise[] = [
      { id: 'x', name: 'Custom Squat Accessory', sets: 4, reps: 6, weightType: AccessoryWeightType.Standard },
    ]
    const profile = makeProfile({ currentWeek: 1, currentDay: 4 }) // W1 D4 selected; Squat (day 1) recurs W1–W3
    const customAccessories = { [MainLift.Squat]: custom }
    const out = getUpcomingWorkouts(profile, customAccessories, null)
    const squatDays = out.filter((w) => w.lift === MainLift.Squat)
    expect(squatDays.length).toBeGreaterThan(0)
    for (const w of squatDays) {
      expect(w.accessories).toEqual(custom)
    }
    // Non-squat days still get defaults
    const benchDay = out.find((w) => w.lift === MainLift.BenchPress)
    expect(benchDay?.accessories.length).toBeGreaterThan(0)
    expect(benchDay?.accessories[0].name).not.toBe('Custom Squat Accessory')
  })

  it('iteration boundary: W2 D4 (W2 fully done) → 4 entries all in W3', () => {
    const profile = makeProfile({ currentWeek: 2, currentDay: 4, completedDaysThisWeek: [1, 2, 3] })
    const out = getUpcomingWorkouts(profile, null, null)
    expect(out).toHaveLength(4)
    expect(out.map((w) => w.week)).toEqual([3, 3, 3, 3])
    expect(out.map((w) => w.day)).toEqual([1, 2, 3, 4])
  })

  it('reordered week: D1 done, D3 selected — D2 and D4 still pending this week', () => {
    const profile = makeProfile({ currentWeek: 1, currentDay: 3, completedDaysThisWeek: [1] })
    const out = getUpcomingWorkouts(profile, null, null)
    const w1 = out.filter((w) => w.week === 1)
    expect(w1.map((w) => w.day)).toEqual([2, 4])
    // 2 still-pending in W1 + 4 in W2 + 4 in W3
    expect(out).toHaveLength(10)
  })
})

describe('getUpcomingWorkouts — Hypertrophy', () => {
  function hypertrophyProfile(overrides: Partial<UserProfile> = {}): UserProfile {
    return makeProfile({
      programType: ProgramType.Hypertrophy,
      cycleWeeks: 7,
      hypertrophyTopSets: {
        [MainLift.Squat]: 215,
        [MainLift.BenchPress]: 160,
        [MainLift.Deadlift]: 275,
      },
      ...overrides,
    })
  }

  it('mid-cycle W2 D1 returns 23 entries (rest of 7-week × 4-day cycle minus today)', () => {
    const profile = hypertrophyProfile({ currentWeek: 2, currentDay: 1 })
    const out = getUpcomingWorkouts(profile, null, null)
    expect(out).toHaveLength(23)
    // Spot-check W4 D2 has bench top set (3 warmups + 1 AMRAP top set = 4 main sets, no supplemental)
    const w4d2 = out.find((w) => w.week === 4 && w.day === 2)
    expect(w4d2).toBeDefined()
    expect(w4d2!.lift).toBe(MainLift.BenchPress)
    expect(w4d2!.mainSets).toHaveLength(4)
    expect(w4d2!.mainSets[w4d2!.mainSets.length - 1].isAMRAP).toBe(true)
    expect(w4d2!.supplementalSets).toEqual([])
    expect(w4d2!.variant).toBeUndefined()
  })

  it('day 4 (Pull Focus) has lift=null, mainSets=[], accessories populated', () => {
    const profile = hypertrophyProfile({ currentWeek: 1, currentDay: 1 })
    const out = getUpcomingWorkouts(profile, null, null)
    const d4s = out.filter((w) => w.day === 4)
    expect(d4s.length).toBe(7) // one per week
    for (const w of d4s) {
      expect(w.lift).toBeNull()
      expect(w.mainSets).toEqual([])
      expect(w.supplementalSets).toEqual([])
      expect(w.accessories.length).toBeGreaterThan(0)
      expect(w.title).toBe('Upper — Pull Focus')
    }
  })

  it('missing top-set seed leaves mainSets empty but accessories populated', () => {
    const profile = hypertrophyProfile({
      currentWeek: 1,
      currentDay: 1,
      hypertrophyTopSets: { [MainLift.Squat]: 215 }, // bench + deadlift unset
    })
    const out = getUpcomingWorkouts(profile, null, null)
    const benchDay = out.find((w) => w.lift === MainLift.BenchPress)
    expect(benchDay).toBeDefined()
    expect(benchDay!.mainSets).toEqual([])
    expect(benchDay!.accessories.length).toBeGreaterThan(0)
    // Squat days still have main sets
    const squatDay = out.find((w) => w.lift === MainLift.Squat)
    expect(squatDay!.mainSets.length).toBeGreaterThan(0)
  })
})

describe('getUpcomingWorkouts — guard states', () => {
  it('returns [] when isCycleComplete', () => {
    const profile = makeProfile({ isCycleComplete: true, currentWeek: 1, currentDay: 1 })
    expect(getUpcomingWorkouts(profile, null, null)).toEqual([])
  })

  it('returns [] when isDeloading', () => {
    const profile = makeProfile({ isDeloading: true, currentWeek: 1, currentDay: 1 })
    expect(getUpcomingWorkouts(profile, null, null)).toEqual([])
  })

  it('does not throw when TMs are zero', () => {
    const profile = makeProfile({
      currentWeek: 1, currentDay: 1,
      squatTM: 0, benchTM: 0, deadliftTM: 0, pressTM: 0,
    })
    expect(() => getUpcomingWorkouts(profile, null, null)).not.toThrow()
    const out = getUpcomingWorkouts(profile, null, null)
    expect(out.length).toBeGreaterThan(0)
    expect(out[0].mainSets.every((s) => s.weight === 0)).toBe(true)
  })
})
