import { describe, it, expect } from 'vitest'
import { getAccessories, getUpperLowerAccessories, getProgramAccessories } from './accessories'
import { MainLift, MAIN_LIFTS, ProgramType } from '../types'

describe('getAccessories', () => {
  it('returns exercises for each main lift', () => {
    for (const lift of MAIN_LIFTS) {
      const accessories = getAccessories(lift)
      expect(accessories.length).toBeGreaterThan(0)
    }
  })

  it('each exercise has required fields', () => {
    for (const lift of MAIN_LIFTS) {
      for (const ex of getAccessories(lift)) {
        expect(ex.id).toBeTruthy()
        expect(ex.name).toBeTruthy()
        expect(ex.sets).toBeGreaterThan(0)
        expect(ex.reps).toBeGreaterThan(0)
        expect(ex.weightType).toBeDefined()
      }
    }
  })

  it('returns specific exercises for squat day', () => {
    const accessories = getAccessories(MainLift.Squat)
    const names = accessories.map((a) => a.name)
    expect(names).toContain('Romanian Deadlift')
  })

  it('returns specific exercises for bench day', () => {
    const accessories = getAccessories(MainLift.BenchPress)
    const names = accessories.map((a) => a.name)
    expect(names).toContain('Incline DB Bench Press')
  })
})

describe('getUpperLowerAccessories', () => {
  it('returns rep-ranged exercises for every slot', () => {
    for (const lift of MAIN_LIFTS) {
      const accessories = getUpperLowerAccessories(lift)
      expect(accessories.length).toBeGreaterThan(0)
      for (const ex of accessories) {
        expect(ex.id).toBeTruthy()
        expect(ex.name).toBeTruthy()
        expect(ex.sets).toBeGreaterThan(0)
        expect(ex.repRangeMin).toBeGreaterThan(0)
        expect(ex.repRangeMax).toBeGreaterThanOrEqual(ex.repRangeMin!)
        expect(ex.progressionType).toBeDefined()
      }
    }
  })

  it('maps each MainLift slot to the matching Upper/Lower day exercises', () => {
    // Bench slot = Upper A; Squat slot = Lower A; OHP slot = Upper B; Deadlift slot = Lower B
    expect(getUpperLowerAccessories(MainLift.BenchPress).map((a) => a.name)).toContain('Pull-Ups')
    expect(getUpperLowerAccessories(MainLift.Squat).map((a) => a.name)).toContain('Bulgarian Split Squat')
    expect(getUpperLowerAccessories(MainLift.ShoulderPress).map((a) => a.name)).toContain('Chest-Supported DB Row')
    expect(getUpperLowerAccessories(MainLift.Deadlift).map((a) => a.name)).toContain('Hanging Leg Raise')
  })
})

describe('getProgramAccessories', () => {
  it('dispatches by program type', () => {
    expect(getProgramAccessories(ProgramType.FiveThreeOne, MainLift.Squat)).toEqual(getAccessories(MainLift.Squat))
    expect(getProgramAccessories(ProgramType.UpperLower, MainLift.Squat)).toEqual(getUpperLowerAccessories(MainLift.Squat))
  })
})
