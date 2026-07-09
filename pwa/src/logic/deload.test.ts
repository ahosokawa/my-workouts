import { describe, it, expect } from 'vitest'
import { topSetDeloadSets, scaleAccessoryVolume, deloadDayPlan } from './deload'
import { deloadSets } from './calculator'
import { getProgram } from './programs'
import { DeloadType, MainLift, ProgramType, AccessoryWeightType } from '../types'
import type { AccessoryExercise } from '../types'

const ACCESSORIES: AccessoryExercise[] = [
  { id: 'a', name: 'Pull-Ups', weightType: AccessoryWeightType.Bodyweight, sets: 4, reps: 7 },
  { id: 'b', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard, sets: 3, reps: 13 },
  { id: 'c', name: 'Band Facepull', weightType: AccessoryWeightType.NoWeight, sets: 1, reps: 17 },
]

describe('topSetDeloadSets', () => {
  it('prescribes 3×3 at 60% of TM (spec §6.2)', () => {
    const sets = topSetDeloadSets(300)
    expect(sets).toHaveLength(3)
    for (const s of sets) {
      expect(s.weight).toBe(180)
      expect(s.targetReps).toBe(3)
      expect(s.percentage).toBe(0.6)
      expect(s.isWarmup).toBe(false)
      expect(s.isAMRAP).toBe(false)
    }
  })

  it('rounds to the nearest 2.5 lbs', () => {
    // 227.5 * 0.6 = 136.5 → 137.5
    expect(topSetDeloadSets(227.5)[0].weight).toBe(137.5)
  })
})

describe('scaleAccessoryVolume', () => {
  it('halves set counts rounding up, minimum 1', () => {
    const scaled = scaleAccessoryVolume(ACCESSORIES, 0.5)
    expect(scaled.map((e) => e.sets)).toEqual([2, 2, 1])
  })

  it('factor 0 drops everything; factor 1 copies unchanged', () => {
    expect(scaleAccessoryVolume(ACCESSORIES, 0)).toEqual([])
    const same = scaleAccessoryVolume(ACCESSORIES, 1)
    expect(same.map((e) => e.sets)).toEqual([4, 3, 1])
    expect(same[0]).not.toBe(ACCESSORIES[0]) // copies, not aliases
  })
})

describe('deloadDayPlan', () => {
  it('5/3/1 keeps the percentage prescriptions and drops accessories', () => {
    const def = getProgram(ProgramType.FiveThreeOne)
    const plan = deloadDayPlan(def, DeloadType.Deload, 1, { tmLbs: 300, accessories: ACCESSORIES })
    expect(plan.lift).toBe(MainLift.Squat)
    expect(plan.mainSets).toEqual(deloadSets(300, DeloadType.Deload))
    expect(plan.accessories).toEqual([])
    expect(plan.isRetestDay).toBe(false)
    // TM test path also unchanged
    const tmPlan = deloadDayPlan(def, DeloadType.TMTest, 1, { tmLbs: 300, accessories: ACCESSORIES })
    expect(tmPlan.mainSets).toEqual(deloadSets(300, DeloadType.TMTest))
    expect(tmPlan.isRetestDay).toBe(false)
  })

  it('5/3/1 respects the user day order', () => {
    const def = getProgram(ProgramType.FiveThreeOne)
    const order = [MainLift.Deadlift, MainLift.Squat, MainLift.ShoulderPress, MainLift.BenchPress]
    const plan = deloadDayPlan(def, DeloadType.Deload, 1, { tmLbs: 300, dayOrder: order, accessories: [] })
    expect(plan.lift).toBe(MainLift.Deadlift)
  })

  it('top-set deload: 60% 3×3 + halved accessories', () => {
    const def = getProgram(ProgramType.UpperLower)
    const plan = deloadDayPlan(def, DeloadType.Deload, 2, { tmLbs: 255, accessories: ACCESSORIES })
    expect(plan.lift).toBe(MainLift.Squat) // UL day 2 = Lower A
    expect(plan.mainSets).toEqual(topSetDeloadSets(255))
    expect(plan.accessories.map((e) => e.sets)).toEqual([2, 2, 1])
    expect(plan.isRetestDay).toBe(false)
  })

  it('top-set TM test: warmup ramp + retest top set with the program rep range', () => {
    const def = getProgram(ProgramType.UpperLower)
    const plan = deloadDayPlan(def, DeloadType.TMTest, 3, { tmLbs: 110, accessories: ACCESSORIES })
    expect(plan.lift).toBe(MainLift.ShoulderPress) // UL day 3 = Upper B
    expect(plan.isRetestDay).toBe(true)
    const top = plan.mainSets[plan.mainSets.length - 1]
    expect(top.isAMRAP).toBe(true)
    expect(top.percentage).toBe(0.9)
    expect(top.repRangeMin).toBe(5) // UL widens OHP to 5-8
    expect(top.repRangeMax).toBe(8)
    expect(plan.mainSets.filter((s) => s.isWarmup)).toHaveLength(3)
    expect(plan.accessories.length).toBeGreaterThan(0)
  })

  it('hypertrophy day 4 (no main) is accessories-only for both deload types', () => {
    const def = getProgram(ProgramType.Hypertrophy)
    for (const type of [DeloadType.Deload, DeloadType.TMTest]) {
      const plan = deloadDayPlan(def, type, 4, { tmLbs: 0, accessories: ACCESSORIES })
      expect(plan.lift).toBeNull()
      expect(plan.mainSets).toEqual([])
      expect(plan.isRetestDay).toBe(false)
      expect(plan.accessories.map((e) => e.sets)).toEqual([2, 2, 1])
    }
  })
})
