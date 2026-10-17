import { describe, it, expect, beforeEach } from 'vitest'
import { CHEST_ARMS_ACCESSORIES as plan, workingSetGuidance, workingWeightDisplay, startingWorkingWeight, workingWarmupWeight, upgradeHypertrophyUpperB } from './chestArms'
import { getProgram, seedProgram, programMainLiftForDay } from './programs'
import { getUpcomingWorkouts } from './upcomingWorkouts'
import { ProgramType, MainLift, toStorageLbs } from '../types'
import type { SetLog, WorkoutSession } from '../types'
import { useStore } from '../store'
import { emptyPersistedData, normalizePersistedData } from './persistedData'
import { parseBackup, serializeBackup } from './backup'
import { bestAmrapE1RM } from './personalRecords'
import { buildAnalysisFiles } from './analysis'
import legacy from '../../test-fixtures/multi-cycle-with-prs.json'
import handoff from '../../test-fixtures/handoff-history.json'
import type { UserProfile } from '../types'
import older from '../../test-fixtures/legacy-sessions-no-variant.json'

const bench = plan[MainLift.BenchPress][0]
function history(reps = [8,8,8]) {
  const session: WorkoutSession = { id: 's', date: '2026-10-16T12:00:00Z', week: 1, cycleNumber: 2,
    durationSeconds: 3600, liftRawValue: 0, programType: ProgramType.ChestArms,
    programDay: 1, dayLabel: 'Upper A — Chest', prescription: plan[MainLift.BenchPress], workingSetsCompleted: true }
  const logs: SetLog[] = reps.map((r,i) => ({id: String(i), sessionId: 's', exerciseId: bench.id,
    exerciseName: bench.name, weightType: bench.weightType, isMainLift: false, setIndex: i, weight: 135,
    actualReps: r, targetReps: 6, repRangeMin: 6, repRangeMax: 8, rir: 2, techniqueConfirmed: true,
    isAMRAP: false, isCompleted: true, completedAt: session.date}))
  return {session, logs}
}

beforeEach(() => useStore.setState(emptyPersistedData()))

describe('Chest & Arms prescription', () => {
  it('loads all four ordered prescriptions without top sets or TM-based working weights', () => {
    const def = getProgram(ProgramType.ChestArms)
    const seed = seedProgram(def, {1: 300, 2: 225, 3: 400, 4: 135}, 'lbs')
    expect(seed.dayOrder).toEqual([2,1,4,3])
    expect(seed.hypertrophyTopSets).toEqual({})
    const expected = [
      [[3,6,8],[3,6,10],[3,8,12],[2,8,12],[3,10,15],[3,10,15]],
      [[3,5,8],[3,8,10],[2,8,12],[3,12,20],[3,6,12]],
      [[3,6,10],[3,8,12],[2,10,15],[3,12,20],[3,10,15],[3,12,20],[2,15,20],[2,6,10]],
      [[2,4,6],[3,6,10],[2,8,12],[3,12,20],[3,8,15]],
    ]
    seed.dayOrder.forEach((slot, i) => {
      expect(plan[slot].map(e => [e.sets,e.repRangeMin,e.repRangeMax])).toEqual(expected[i])
      expect(programMainLiftForDay(def, i+1)).toBeNull()
    })
    expect(plan[4].filter(e => e.optional).map(e => e.name)).toEqual(['Band Face Pull', 'Overhead Press'])
    expect(plan[2][3].notes).toContain('per arm')
    expect(plan[1][2].notes).toContain('per leg')
  })
  it('previews the correct day slots', () => {
    useStore.getState().createProfile(300,225,400,135,undefined,undefined,undefined,undefined,ProgramType.ChestArms)
    const upcoming = getUpcomingWorkouts(useStore.getState().profile!, null, null)
    expect(upcoming.slice(0,3).map(w => w.accessories[0].name)).toEqual(['Squat','Dips','Deadlift'])
    expect(upcoming.every(w => w.mainSets.length === 0 && w.supplementalSets.length === 0)).toBe(true)
  })
})

describe('strict optional double progression', () => {
  it.each([[8,7,6],[8,8,8]])('keeps or suggests for %j', (...reps) => {
    const {session, logs} = history(reps)
    const result = workingSetGuidance(bench,1,[session],logs)
    expect(result.weight).toBe(135)
    expect(result.suggestedWeight).toBe(reps.every(r => r === 8) ? 140 : 135)
  })
  it.each(['missing', 'uncompleted', 'effort', 'unlogged', 'mixedLoad', 'variant', 'failedSession', 'warmup', 'invalidReps'])('holds for %s', reason => {
    const {session,logs} = history()
    if (reason === 'missing') logs.pop()
    if (reason === 'uncompleted') logs[2].isCompleted = false
    if (reason === 'effort') logs[2].rir = 0
    if (reason === 'unlogged') logs[2].rir = null
    if (reason === 'mixedLoad') logs[2].weight = 140
    if (reason === 'variant') logs[2].exerciseId = 'other-bench'
    if (reason === 'failedSession') session.workingSetsCompleted = false
    if (reason === 'warmup') logs[2].isWarmup = true
    if (reason === 'invalidReps') logs[2].actualReps = 8.5
    expect(workingSetGuidance(bench,1,[session],logs).canAdd).toBe(false)
  })
  it('does not borrow another day, prescription, program or exercise variant', () => {
    const {session,logs} = history()
    expect(workingSetGuidance(bench,3,[session],logs).weight).toBe(0)
    expect(workingSetGuidance({...bench, sets: 2},1,[session],logs).canAdd).toBe(false)
    expect(workingSetGuidance({...bench, name: 'Close-Grip Bench Press'},1,[session],logs).canAdd).toBe(false)
    session.programType = ProgramType.UpperLower
    expect(workingSetGuidance(bench,1,[session],logs).weight).toBe(0)
  })
  it('uses the newest unfinished occurrence rather than an older success', () => {
    const {session,logs} = history()
    const latest = {...session, id: 'latest', date: '2026-10-20T12:00:00Z', workingSetsCompleted: false}
    const skipped = logs.map(l => ({...l,id: 'latest'+l.id,sessionId: 'latest',isCompleted:false,actualReps:null}))
    expect(workingSetGuidance(bench,1,[session,latest],[...logs,...skipped])).toEqual({weight:135,suggestedWeight:135,canAdd:false})
  })
  it('preserves fractional kg working loads and increments', () => {
    expect(workingWeightDisplay(toStorageLbs(62.5, 'kg'), 'kg')).toBe(62.5)
    expect(workingWeightDisplay(toStorageLbs(1.25, 'kg'), 'kg')).toBe(1.25)
  })
  it('respects configured increments and does not mutate logs', () => {
    const {session,logs} = history()
    const before = JSON.stringify(logs)
    expect(workingSetGuidance({...bench,incrementLbs:2.5},1,[session],logs).suggestedWeight).toBe(137.5)
    expect(JSON.stringify(logs)).toBe(before)
  })
})

describe('history, backups and additive snapshots', () => {
  it.each([legacy, older, handoff])('preserves representative legacy fixtures on activation, rollback and v2 roundtrip', fixture => {
    const state = normalizePersistedData(parseBackup(JSON.stringify(fixture)) as Record<string, unknown>)
    // Match implausible timer examples without changing their stored meaning.
    state.sessions[0].durationSeconds = 2919 * 60
    useStore.setState(state)
    const oldSessions = JSON.stringify(state.sessions), oldLogs = JSON.stringify(state.setLogs)
    const prs = [1,2,3,4].map(l => bestAmrapE1RM(state.setLogs, l as MainLift))
    const summary = buildAnalysisFiles(state)
    expect(useStore.getState().profile?.programType).toBe(state.profile?.programType)
    useStore.getState().switchProgram(ProgramType.ChestArms)
    expect(JSON.stringify(useStore.getState().sessions)).toBe(oldSessions)
    expect(JSON.stringify(useStore.getState().setLogs)).toBe(oldLogs)
    useStore.getState().switchProgram(state.profile!.programType)
    const restored = normalizePersistedData(parseBackup(useStore.getState().exportData()) as Record<string,unknown>)
    expect(JSON.stringify(restored.sessions)).toBe(oldSessions)
    expect(JSON.stringify(restored.setLogs)).toBe(oldLogs)
    expect([1,2,3,4].map(l => bestAmrapE1RM(restored.setLogs,l as MainLift))).toEqual(prs)
    // Profile counters reset on program switching; historical summary data stays stable.
    expect(buildAnalysisFiles({...state, sessions:restored.sessions,setLogs:restored.setLogs})).toEqual(summary)
  })
  it('retains new metadata and in-flight snapshot on local rehydration; backup keeps completed snapshots', () => {
    const {session,logs} = history()
    const state = {...emptyPersistedData(), sessions:[session],setLogs:logs}
    state.activeWorkout = {...state.activeWorkout,isActive:true,programType:ProgramType.ChestArms,
      prescription:structuredClone(plan[2]),accRir:{'Bench Press-0':2},technique:{[bench.id]:true},warmups:['ca-bench-0']}
    const reloaded = normalizePersistedData(JSON.parse(JSON.stringify(state)))
    expect(reloaded.activeWorkout).toEqual(state.activeWorkout)
    const restored = normalizePersistedData(parseBackup(serializeBackup(state)) as Record<string,unknown>)
    expect(restored.sessions).toEqual([session])
    expect(restored.setLogs).toEqual(logs)
    expect(restored.activeWorkout.isActive).toBe(false)
  })
})


describe('starting suggestions and warmups', () => {
  const profile = handoff.profile as UserProfile
  it('uses a conservative recent top set instead of copying it as three sets', () => {
    expect(startingWorkingWeight(bench,handoff.setLogs as SetLog[],profile)).toMatchObject({weight:130})
  })
  it('reuses recent accessory work by exact movement, excluding warmups and incomplete sets', () => {
    const incline = plan[2][2]
    const logs = [...handoff.setLogs as SetLog[], {...history().logs[0],exerciseName:incline.name,weight:999,isWarmup:true},
      {...history().logs[0],exerciseName:incline.name,weight:800,isCompleted:false}]
    expect(startingWorkingWeight(incline,logs,profile).weight).toBe(50)
    expect(startingWorkingWeight({...incline,name:'Flat DB Bench Press'},logs,profile).weight).toBe(0)
  })
  it('falls back to a transparent conservative TM estimate for main lifts only', () => {
    expect(startingWorkingWeight(bench,[],profile).weight).toBe(117.5)
    expect(startingWorkingWeight(plan[2][4],[],profile).weight).toBe(0)
  })
  it('uses native display units and respects the empty bar for warmups', () => {
    expect(workingWarmupWeight(135,0.5,'lbs')).toBe(67.5)
    expect(workingWarmupWeight(60,0.5,'lbs')).toBe(45)
    expect(workingWarmupWeight(25,0.5,'kg')).toBe(20)
    expect(workingWeightDisplay(startingWorkingWeight(bench,[],{...profile,units:'kg'}).weight,'kg')).toBe(53)
  })
  it('does not require a technique checkbox for an otherwise valid progression', () => {
    const {session,logs} = history()
    logs.forEach(l => {delete l.techniqueConfirmed})
    expect(workingSetGuidance(bench,1,[session],logs).canAdd).toBe(true)
  })
})


describe('Upper B band revision compatibility', () => {
  function oldPlan() {
    return {...structuredClone(plan), 4: [
      ...structuredClone(plan[4].slice(0,5)),
      {id:'ca-ez-triceps',name:'Lying EZ-Bar Triceps Extension',sets:3,reps:10,
        repRangeMin:10,repRangeMax:15,weightType:'standard' as const},
      structuredClone(plan[4].at(-1)!),
    ]}
  }
  it('reuses existing band identities with reps-only tracking and optional face pulls', () => {
    expect(plan[4][5]).toMatchObject({id:'ul-band-pushdown',name:'Band Triceps Pushdown',sets:3,
      repRangeMin:12,repRangeMax:20,weightType:'noWeight',progressionType:'reps_only'})
    expect(plan[4][6]).toMatchObject({id:'facepull',name:'Band Face Pull',sets:2,
      repRangeMin:15,repRangeMax:20,weightType:'noWeight',progressionType:'reps_only',optional:true})
  })
  it('changes only the replaced row and inserts face pulls; is pure and idempotent', () => {
    const original = oldPlan(), before = JSON.stringify(original)
    const revised = upgradeHypertrophyUpperB(original)
    expect(JSON.stringify(original)).toBe(before)
    expect(revised[4]).toEqual(plan[4])
    for (const slot of [1,2,3] as const) expect(revised[slot]).toBe(original[slot])
    expect(upgradeHypertrophyUpperB(revised)).toBe(revised)
    const withoutFace = {...revised,4:revised[4].filter(e => e.id !== 'facepull')}
    expect(upgradeHypertrophyUpperB(withoutFace)).toBe(withoutFace)
  })
  it('preserves completed history, active snapshots, other programs, and progression evidence', () => {
    const old = oldPlan(), {session,logs} = history()
    const oldUpperB = {...session,id:'old-upper-b',programDay:3,dayLabel:'Upper B — Chest & Arms',prescription:structuredClone(old[4])}
    const oldTriceps: SetLog = {...logs[0],id:'old-triceps',sessionId:oldUpperB.id,exerciseId:'ca-ez-triceps',
      exerciseName:'Lying EZ-Bar Triceps Extension',weightType:'standard',weight:40,actualReps:15,repRangeMin:10,repRangeMax:15}
    const state = {...emptyPersistedData(),_migratedUpperLowerPlan:true,profile:{...handoff.profile,programType:ProgramType.ChestArms} as UserProfile,
      customAccessories:old,sessions:[session,oldUpperB],setLogs:[...logs,oldTriceps],
      programAccessoryArchive:{[ProgramType.UpperLower]:structuredClone(old)},
      activeWorkout:{...emptyPersistedData().activeWorkout,isActive:true,day:3,liftRawValue:0,prescription:structuredClone(old[4])}}
    const before = JSON.stringify(state)
    const normalized = normalizePersistedData(state as unknown as Record<string,unknown>)
    expect(normalized.customAccessories?.[4]).toEqual(plan[4])
    expect(normalized.sessions).toBe(state.sessions)
    expect(normalized.setLogs).toBe(state.setLogs)
    expect(normalized.activeWorkout).toEqual(state.activeWorkout)
    expect(normalized.programAccessoryArchive).toEqual(state.programAccessoryArchive)
    expect(workingSetGuidance(bench,1,normalized.sessions,normalized.setLogs).canAdd).toBe(true)
    expect(JSON.stringify(state)).toBe(before)
  })
  it('upgrades an archived hypertrophy plan without changing the live other program', () => {
    const live = oldPlan(), archived = oldPlan()
    const state = {...emptyPersistedData(),_migratedUpperLowerPlan:true,profile:handoff.profile as UserProfile,customAccessories:live,
      programAccessoryArchive:{[ProgramType.ChestArms]:archived}}
    const normalized = normalizePersistedData(state as unknown as Record<string,unknown>)
    expect(normalized.customAccessories).toEqual(live)
    expect(normalized.programAccessoryArchive[ProgramType.ChestArms]?.[4]).toEqual(plan[4])
  })
  it('does not duplicate existing band rows or replace deliberate substitutions', () => {
    const old = oldPlan()
    old[4].push({...plan[4][5]}, {...plan[4][6], name:'Band Facepull'})
    const upgraded = upgradeHypertrophyUpperB(old)
    expect(upgraded[4].filter(e => e.id === 'ul-band-pushdown')).toHaveLength(1)
    expect(upgraded[4].filter(e => e.id === 'facepull')).toHaveLength(1)
    const customized = oldPlan()
    customized[4][5].name='Custom Triceps Exercise'
    expect(upgradeHypertrophyUpperB(customized)).toBe(customized)
  })
})
