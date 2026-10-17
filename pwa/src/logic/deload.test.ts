import { describe, it, expect } from 'vitest'
import {
  topSetDeloadSets, scaleAccessoryVolume, deloadDayPlan,
  isDeloadSession, withoutDeload, sessionWeekLabel, deloadAccessoryWeight,
} from './deload'
import { deloadSets } from './calculator'
import { getProgram } from './programs'
import { DeloadType, MainLift, ProgramType, AccessoryWeightType } from '../types'
import type { AccessoryExercise, SetLog, WorkoutSession } from '../types'

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
  it('5/3/1 keeps the percentage prescriptions and halves accessories', () => {
    const def = getProgram(ProgramType.FiveThreeOne)
    const plan = deloadDayPlan(def, DeloadType.Deload, 1, { tmLbs: 300, accessories: ACCESSORIES })
    expect(plan.lift).toBe(MainLift.Squat)
    expect(plan.mainSets).toEqual(deloadSets(300, DeloadType.Deload))
    expect(plan.accessories.map((e) => e.sets)).toEqual([2, 2, 1])
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

const session = (id: string, week: number, extra: Partial<WorkoutSession> = {}): WorkoutSession => ({
  id, date: '2026-10-01T12:00:00.000Z', liftRawValue: 1, week, cycleNumber: 1, durationSeconds: 0, ...extra,
})
const log = (id: string, sessionId: string): SetLog => ({
  id, sessionId, exerciseName: 'Squat', isMainLift: true, setIndex: 0, weight: 200,
  targetReps: 5, actualReps: 8, isAMRAP: true, isCompleted: true, completedAt: '2026-10-01T12:00:00.000Z',
})

describe('deload isolation', () => {
  it('week 0 marks a deload session', () => {
    expect(isDeloadSession({ week: 0 })).toBe(true)
    expect(isDeloadSession({ week: 1 })).toBe(false)
  })

  it('withoutDeload drops deload sessions and their logs, keeps orphan logs', () => {
    const sessions = [session('a', 1), session('d', 0, { deloadType: DeloadType.TMTest })]
    const logs = [log('1', 'a'), log('2', 'd'), log('3', 'gone')]
    const out = withoutDeload(sessions, logs)
    expect(out.sessions.map((s) => s.id)).toEqual(['a'])
    expect(out.setLogs.map((l) => l.id)).toEqual(['1', '3'])
  })

  it('withoutDeload returns inputs untouched when there is no deload', () => {
    const sessions = [session('a', 2)]
    const logs = [log('1', 'a')]
    const out = withoutDeload(sessions, logs)
    expect(out.sessions).toBe(sessions)
    expect(out.setLogs).toBe(logs)
  })

  it('labels weeks, deloads and TM tests (legacy week-0 reads as Deload)', () => {
    expect(sessionWeekLabel(session('a', 3))).toBe('Week 3')
    expect(sessionWeekLabel(session('d', 0, { deloadType: DeloadType.Deload }))).toBe('Deload')
    expect(sessionWeekLabel(session('t', 0, { deloadType: DeloadType.TMTest }))).toBe('TM Test')
    expect(sessionWeekLabel(session('l', 0))).toBe('Deload')
  })
})

describe('deloadAccessoryWeight', () => {
  it('prefills ~80% rounded down to 2.5 lb / 1 kg', () => {
    expect(deloadAccessoryWeight(50, 'lbs', null)).toBe(40)
    expect(deloadAccessoryWeight(55, 'lbs', null)).toBe(42.5) // 44 → 42.5
    expect(deloadAccessoryWeight(27, 'kg', null)).toBe(21) // 21.6 → 21
  })

  it('bodyweight totals keep bodyweight and scale only the added load', () => {
    expect(deloadAccessoryWeight(205, 'lbs', 180)).toBe(200) // +25 → +20
    expect(deloadAccessoryWeight(180, 'lbs', 180)).toBe(180)
  })

  it('leaves tiny or missing loads alone', () => {
    expect(deloadAccessoryWeight(2.5, 'lbs', null)).toBe(2.5)
    expect(deloadAccessoryWeight(0, 'lbs', null)).toBe(0)
    expect(deloadAccessoryWeight(NaN, 'lbs', null)).toBe(0)
  })
})
