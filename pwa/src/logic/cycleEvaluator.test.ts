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

  it('fails a lift missing week 3 (cycle ended early) even when recorded AMRAPs were met', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    // Drop every week-3 session (and its logs) — simulates End Cycle Early at week 2.
    const week12Sessions = sessions.filter((s) => s.week !== 3)
    const keptIds = new Set(week12Sessions.map((s) => s.id))
    const week12Logs = setLogs.filter((l) => keptIds.has(l.sessionId))

    const result = evaluateCycle(week12Sessions, week12Logs, 1)

    expect(result.isSuccessful).toBe(false)
    for (const lift of MAIN_LIFTS) {
      expect(result.liftResults[lift].amrapMet).toBe(false)
      expect(result.liftResults[lift].missingWeeks).toEqual([3])
    }
  })

  it('fails a lift with only week 1 recorded (the partial-cycle regression)', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const week1Sessions = sessions.filter((s) => s.week === 1)
    const keptIds = new Set(week1Sessions.map((s) => s.id))
    const week1Logs = setLogs.filter((l) => keptIds.has(l.sessionId))

    const result = evaluateCycle(week1Sessions, week1Logs, 1)

    expect(result.isSuccessful).toBe(false)
    expect(result.liftResults[MainLift.Squat].missingWeeks).toEqual([2, 3])
  })

  it('reports empty missingWeeks when all 3 weeks are recorded but one fails', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 2, 3: 3 }) // week 2 min is 3
    const result = evaluateCycle(sessions, setLogs, 1)

    expect(result.isSuccessful).toBe(false)
    expect(result.liftResults[MainLift.Squat].amrapMet).toBe(false)
    expect(result.liftResults[MainLift.Squat].missingWeeks).toEqual([])
  })

  it('ignores an AMRAP set that was never completed (pre-filled reps are not evidence)', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    // Week 3 squat AMRAP left unchecked — its actualReps still carry the
    // pre-filled default, but the set wasn't performed.
    const logs = setLogs.map((l) =>
      l.sessionId === `s-c1-${MainLift.Squat}-3` && l.isAMRAP
        ? { ...l, isCompleted: false, completedAt: null }
        : l,
    )

    const result = evaluateCycle(sessions, logs, 1)

    expect(result.liftResults[MainLift.Squat].amrapMet).toBe(false)
    expect(result.liftResults[MainLift.Squat].missingWeeks).toEqual([3])
    // Other lifts are unaffected.
    expect(result.liftResults[MainLift.BenchPress].amrapMet).toBe(true)
  })

  it('evaluates correctly when a week has duplicate sessions (legacy double-save data)', () => {
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    // Duplicate the week-1 squat session under a new id, same logs.
    const dupId = '.dup-s-c1-1-1'
    sessions.push(makeSession(dupId, MainLift.Squat, 1, 1))
    for (let i = 0; i < 6; i++) {
      setLogs.push(makeSetLog(dupId, {
        isAMRAP: i === 5,
        actualReps: i === 5 ? 8 : null,
        isCompleted: true,
      }))
    }

    const result = evaluateCycle(sessions, setLogs, 1)

    expect(result.isSuccessful).toBe(true)
    expect(result.liftResults[MainLift.Squat].missingWeeks).toEqual([])
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
    currentVariant: 'fsl',
    leaderCycleCount: 0,
    anchorCycleCount: 0,
    tmPercentage: 90,
    sex: 'male',
    units: 'lbs',
    isDeloading: false,
    deloadType: null,
    deloadDay: 1,
    bodyWeightLbs: 180,
    bodyWeightLastUpdated: null,
    createdAt: '2025-01-01',
    programType: '531',
    cycleWeeks: 3,
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

  it('uses kg progression amounts when units are kg', () => {
    // TMs are stored in lbs; progression should be +5 kg for SQ/DL, +2.5 kg for BP/OHP
    const kgProfile: UserProfile = { ...profile, units: 'kg' }
    const { sessions, setLogs } = buildFullCycle(1, { 1: 8, 2: 5, 3: 3 })
    const cycleResult = evaluateCycle(sessions, setLogs, 1)
    const tms = suggestedTMs(kgProfile, cycleResult)

    // +5 kg ≈ +11.02 lbs for squat/deadlift
    expect(tms[MainLift.Squat]).toBeCloseTo(270 + 5 * 2.20462, 1)
    expect(tms[MainLift.Deadlift]).toBeCloseTo(360 + 5 * 2.20462, 1)
    // +2.5 kg ≈ +5.51 lbs for bench/OHP
    expect(tms[MainLift.BenchPress]).toBeCloseTo(202.5 + 2.5 * 2.20462, 1)
    expect(tms[MainLift.ShoulderPress]).toBeCloseTo(121.5 + 2.5 * 2.20462, 1)
  })
})
