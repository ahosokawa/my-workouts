import { describe, it, expect } from 'vitest'
import { evaluateCycle, suggestedTMs } from './cycleEvaluator'
import type { WorkoutSession, SetLog, UserProfile } from '../types'
import { MainLift, MAIN_LIFTS } from '../types'

function makeSession(id: string, lift: MainLift, week: number, cycle: number): WorkoutSession {
  return { id, date: '2025-01-01', liftRawValue: lift, week, cycleNumber: cycle, durationSeconds: 3600 }
}

function makeSetLog(sessionId: string, opts: Partial<SetLog> = {}): SetLog {
  return {
    id: `log-${sessionId}-${Math.random()}`,
    sessionId,
    exerciseName: 'Squat',
    isMainLift: true,
    setIndex: 0,
    weight: 200,
    targetReps: 5,
    actualReps: null,
    isAMRAP: false,
    isCompleted: true,
    completedAt: '2025-01-01',
    ...opts,
  }
}

function buildFullCycle(cycleNumber: number, amrapReps: Record<number, number>): { sessions: WorkoutSession[]; setLogs: SetLog[] } {
  const sessions: WorkoutSession[] = []
  const setLogs: SetLog[] = []

  for (const lift of MAIN_LIFTS) {
    for (let week = 1; week <= 3; week++) {
      const sid = `s-c${cycleNumber}-${lift}-${week}`
      sessions.push(makeSession(sid, lift, week, cycleNumber))

      // 6 main sets (3 working + 3 warmup... we just need 6 completed main sets)
      for (let i = 0; i < 6; i++) {
        const isAmrap = i === 5
        setLogs.push(makeSetLog(sid, {
          isAMRAP: isAmrap,
          actualReps: isAmrap ? (amrapReps[week] ?? 5) : null,
          targetReps: isAmrap ? 5 : 5,
          isCompleted: true,
        }))
      }
    }
  }

  return { sessions, setLogs }
}

describe('evaluateCycle', () => {
  it('marks cycle as successful when all AMRAP minimums met', () => {
    // Week 1 minimum=5, Week 2 minimum=3, Week 3 minimum=1
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const result = evaluateCycle(sessions, setLogs, 1)
    expect(result.isSuccessful).toBe(true)
  })

  it('marks cycle as failed when AMRAP minimums not met', () => {
    // Week 1 minimum=5, give only 4
    const { sessions, setLogs } = buildFullCycle(1, { 1: 4, 2: 5, 3: 3 })
    const result = evaluateCycle(sessions, setLogs, 1)
    expect(result.isSuccessful).toBe(false)
  })

  it('checks AMRAP per lift independently', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const result = evaluateCycle(sessions, setLogs, 1)

    for (const lift of MAIN_LIFTS) {
      expect(result.liftResults[lift]).toBeDefined()
      expect(result.liftResults[lift].amrapMet).toBe(true)
    }
  })

  it('returns amrap details for each week', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const result = evaluateCycle(sessions, setLogs, 1)
    const squatResult = result.liftResults[MainLift.Squat]
    expect(squatResult.amrapDetails).toHaveLength(3) // one per week
  })

  it('only evaluates the specified cycle number', () => {
    const cycle1 = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const cycle2 = buildFullCycle(2, { 1: 2, 2: 1, 3: 0 })
    const sessions = [...cycle1.sessions, ...cycle2.sessions]
    const setLogs = [...cycle1.setLogs, ...cycle2.setLogs]

    const result1 = evaluateCycle(sessions, setLogs, 1)
    expect(result1.isSuccessful).toBe(true)

    const result2 = evaluateCycle(sessions, setLogs, 2)
    expect(result2.isSuccessful).toBe(false)
  })
})

describe('suggestedTMs', () => {
  const profile: UserProfile = {
    squatOneRepMax: 300,
    benchOneRepMax: 225,
    deadliftOneRepMax: 400,
    pressOneRepMax: 135,
    squatTM: 270,
    benchTM: 202.5,
    deadliftTM: 360,
    pressTM: 121.5,
    currentWeek: 1,
    currentDay: 1,
    cycleNumber: 1,
    isCycleComplete: true,
    bodyWeightLbs: 180,
    bodyWeightLastUpdated: null,
    createdAt: '2025-01-01',
  }

  it('increases squat/deadlift by 10, bench/OHP by 5 on success', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const cycleResult = evaluateCycle(sessions, setLogs, 1)
    const tms = suggestedTMs(profile, cycleResult)

    expect(tms[MainLift.Squat]).toBe(270 + 10)
    expect(tms[MainLift.Deadlift]).toBe(360 + 10)
    expect(tms[MainLift.BenchPress]).toBe(202.5 + 5)
    expect(tms[MainLift.ShoulderPress]).toBe(121.5 + 5)
  })

  it('keeps TM unchanged for failed lifts', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 4, 2: 5, 3: 3 })
    const cycleResult = evaluateCycle(sessions, setLogs, 1)
    const tms = suggestedTMs(profile, cycleResult)

    // All lifts failed week 1 AMRAP (4 < 5)
    expect(tms[MainLift.Squat]).toBe(270)
    expect(tms[MainLift.BenchPress]).toBe(202.5)
  })
})
