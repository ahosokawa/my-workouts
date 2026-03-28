import { describe, it, expect } from 'vitest'
import { getAccessories } from './accessories'
import { MainLift, MAIN_LIFTS } from '../types'

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
