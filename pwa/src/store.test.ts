import { describe, it, expect, beforeEach } from 'vitest'
import { useStore } from './store'
import { emptyPersistedData, pickPersistedData, EMPTY_ACTIVE_WORKOUT } from './logic/persistedData'
import type { ActiveWorkout } from './logic/persistedData'
import type { UserProfile } from './types'
import { ProgramType } from './types'

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
    const sync = { enabled: true, token: 'ghp_device_secret', gistId: 'g1', lastSyncAt: null, lastError: null }
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
      cloudSync: { enabled: true, token: 't', gistId: null, lastSyncAt: null, lastError: null },
    })

    useStore.getState().resetAll()

    expect(pickPersistedData(useStore.getState())).toEqual(emptyPersistedData())
  })
})
