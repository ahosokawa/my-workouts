import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { emptyPersistedData, pickPersistedData, EMPTY_ACTIVE_WORKOUT } from './logic/persistedData'
import type { ActiveWorkout } from './logic/persistedData'
import type { UserProfile } from './types'
import { DeloadType, ProgramType } from './types'

const PROFILE: UserProfile = {
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
  createdAt: '2025-12-01T00:00:00.000Z',
  programType: ProgramType.FiveThreeOne,
  cycleWeeks: 3,
  dayOrder: [1, 2, 3, 4],
  completedDaysThisWeek: [1, 2],
}

const IN_FLIGHT: ActiveWorkout = {
  ...EMPTY_ACTIVE_WORKOUT,
  isActive: true,
  startTime: 123456,
  day: 3,
  liftRawValue: 3,
  week: 2,
  tmLbs: 360,
  completedMain: [0, 1],
}

beforeEach(() => {
  useStore.setState({ ...emptyPersistedData(), profile: { ...PROFILE }, activeWorkout: { ...IN_FLIGHT } })
})

describe('destructive actions discard an in-progress workout', () => {
  it('switchProgram clears activeWorkout', () => {
    useStore.getState().switchProgram(ProgramType.Hypertrophy)
    expect(useStore.getState().activeWorkout.isActive).toBe(false)
    expect(useStore.getState().profile!.programType).toBe(ProgramType.Hypertrophy)
  })

  it('resetCycle clears activeWorkout and returns to Week 1 Day 1', () => {
    useStore.getState().resetCycle()
    const s = useStore.getState()
    expect(s.activeWorkout.isActive).toBe(false)
    expect(s.profile!.currentWeek).toBe(1)
    expect(s.profile!.currentDay).toBe(1)
    expect(s.profile!.completedDaysThisWeek).toEqual([])
    // TMs untouched.
    expect(s.profile!.deadliftTM).toBe(360)
  })

  it('importData clears activeWorkout and never touches cloudSync', () => {
    const sync = { enabled: true, bridgeUrl: 'https://script.google.com/macros/s/X/exec', secret: 'ghp_device_secret', lastSyncAt: null, lastError: null }
    useStore.setState({ cloudSync: sync })
    const backup = useStore.getState().exportData()

    useStore.getState().importData(backup)

    const s = useStore.getState()
    expect(s.activeWorkout.isActive).toBe(false)
    expect(s.cloudSync).toEqual(sync)
    expect(s.profile!.deadliftTM).toBe(360)
  })
})

describe('resetAll', () => {
  it('returns every persisted data field to its initial value', () => {
    useStore.setState({
      programAccessoryArchive: { hypertrophy: {} },
      programSupplementalArchive: { '531': {} },
      restNotifyEnabled: false,
      restNotifyMinutes: 7,
      savedExercises: [{ id: 'x', name: 'Row', weightType: 'standard' as never }],
      cloudSync: { enabled: true, bridgeUrl: 'https://script.google.com/macros/s/X/exec', secret: 't', lastSyncAt: null, lastError: null },
    })

    useStore.getState().resetAll()

    expect(pickPersistedData(useStore.getState())).toEqual(emptyPersistedData())
  })
})

describe('deload week', () => {
  beforeEach(() => {
    useStore.setState({ activeWorkout: { ...EMPTY_ACTIVE_WORKOUT } })
    useStore.getState().startDeload(DeloadType.Deload)
  })

  it('startDeload begins with no days done', () => {
    const p = useStore.getState().profile!
    expect(p.isDeloading).toBe(true)
    expect(p.deloadDay).toBe(1)
    expect(p.deloadCompletedDays).toEqual([])
  })

  it('days can be picked and finished in any order', () => {
    const s = useStore.getState()
    s.selectNextWorkoutDay(3)
    expect(useStore.getState().profile!.deloadDay).toBe(3)
    useStore.getState().advanceDeloadDay(3)
    let p = useStore.getState().profile!
    expect(p.deloadCompletedDays).toEqual([3])
    expect(p.deloadDay).toBe(1)
    // A finished day can't be re-selected; the normal week position is untouched.
    useStore.getState().selectNextWorkoutDay(3)
    p = useStore.getState().profile!
    expect(p.deloadDay).toBe(1)
    expect(p.currentDay).toBe(PROFILE.currentDay)
    expect(p.completedDaysThisWeek).toEqual(PROFILE.completedDaysThisWeek)
  })

  it('finishing all four days ends the deload and starts the next cycle', () => {
    for (const d of [2, 4, 1, 3]) useStore.getState().advanceDeloadDay(d)
    const p = useStore.getState().profile!
    expect(p.isDeloading).toBe(false)
    expect(p.cycleNumber).toBe(PROFILE.cycleNumber + 1)
    expect(p.deloadCompletedDays).toEqual([])
    expect(p.lastDeloadEndedAt).toBeTruthy()
  })

  it('endDeload ends early, discarding an unfinished deload workout', () => {
    useStore.getState().advanceDeloadDay(1)
    useStore.setState({ activeWorkout: { ...IN_FLIGHT, deloadType: DeloadType.Deload } })
    useStore.getState().endDeload()
    const st = useStore.getState()
    expect(st.profile!.isDeloading).toBe(false)
    expect(st.profile!.cycleNumber).toBe(PROFILE.cycleNumber + 1)
    expect(st.profile!.lastDeloadEndedAt).toBeTruthy()
    expect(st.activeWorkout.isActive).toBe(false)
  })
})
