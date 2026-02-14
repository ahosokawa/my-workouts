import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, WorkoutSession, SetLog, WilksEntry, MainLift, AccessoryExercise } from './types'
import { liftFromDay } from './types'

// ============================================================
// Helpers
// ============================================================

function roundToNearest5(value: number): number {
  return Math.floor(value / 5) * 5
}

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
}

function trainingMax(profile: UserProfile, lift: MainLift): number {
  switch (lift) {
    case 1: return profile.squatTM
    case 2: return profile.benchTM
    case 3: return profile.deadliftTM
    case 4: return profile.pressTM
  }
}

// ============================================================
// Active Workout State (survives tab switches)
// ============================================================

export interface ActiveWorkout {
  isActive: boolean
  startTime: number | null
  completedMain: number[]      // stored as array, used as Set in component
  completedAccessory: string[] // stored as array, used as Set in component
  amrapReps: number
  accWeights: Record<string, string>
  accReps: Record<string, string>
  mainWeights: Record<number, string>  // per-set weight overrides, keyed by set index
  mainReps: Record<number, string>     // per-set rep overrides, keyed by set index
  lastSetTime: number | null
  showRestTimer: boolean
}

const EMPTY_ACTIVE_WORKOUT: ActiveWorkout = {
  isActive: false,
  startTime: null,
  completedMain: [],
  completedAccessory: [],
  amrapReps: 0,
  accWeights: {},
  accReps: {},
  mainWeights: {},
  mainReps: {},
  lastSetTime: null,
  showRestTimer: false,
}

// ============================================================
// Store Interface
// ============================================================

interface AppState {
  profile: UserProfile | null
  sessions: WorkoutSession[]
  setLogs: SetLog[]
  wilksEntries: WilksEntry[]
  activeWorkout: ActiveWorkout
  customAccessories: Record<number, AccessoryExercise[]> | null  // keyed by MainLift value
  savedExercises: AccessoryExercise[]  // user's exercise library for re-use

  // Profile actions
  createProfile: (squatRM: number, benchRM: number, deadliftRM: number, pressRM: number) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  recalculateTMs: () => void
  advanceDay: () => boolean  // returns true if cycle completed
  startNewCycle: () => void

  // Workout actions
  saveWorkout: (session: Omit<WorkoutSession, 'id'>, logs: Omit<SetLog, 'id' | 'sessionId'>[]) => string
  updateActiveWorkout: (partial: Partial<ActiveWorkout>) => void
  clearActiveWorkout: () => void
  
  // Wilks actions
  addWilksEntry: (entry: Omit<WilksEntry, 'id'>) => void

  // Accessory actions
  setCustomAccessories: (accessories: Record<number, AccessoryExercise[]>) => void
  addSavedExercise: (exercise: AccessoryExercise) => void

  // Data management
  resetAll: () => void
  exportData: () => string
  importData: (json: string) => void

  // Helpers
  getTrainingMax: (lift: MainLift) => number
  getCurrentLift: () => MainLift | null
}

// ============================================================
// Store Implementation
// ============================================================

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      profile: null,
      sessions: [],
      setLogs: [],
      wilksEntries: [],
      activeWorkout: { ...EMPTY_ACTIVE_WORKOUT },
      customAccessories: null,
      savedExercises: [],

      createProfile: (squatRM, benchRM, deadliftRM, pressRM) => {
        const profile: UserProfile = {
          squatOneRepMax: squatRM,
          benchOneRepMax: benchRM,
          deadliftOneRepMax: deadliftRM,
          pressOneRepMax: pressRM,
          squatTM: roundToNearest5(squatRM * 0.9),
          benchTM: roundToNearest5(benchRM * 0.9),
          deadliftTM: roundToNearest5(deadliftRM * 0.9),
          pressTM: roundToNearest5(pressRM * 0.9),
          currentWeek: 1,
          currentDay: 1,
          cycleNumber: 1,
          isCycleComplete: false,
          bodyWeightLbs: null,
          bodyWeightLastUpdated: null,
          createdAt: new Date().toISOString(),
        }
        set({ profile })
      },

      updateProfile: (partial) => {
        const { profile } = get()
        if (!profile) return
        set({ profile: { ...profile, ...partial } })
      },

      recalculateTMs: () => {
        const { profile } = get()
        if (!profile) return
        set({
          profile: {
            ...profile,
            squatTM: roundToNearest5(profile.squatOneRepMax * 0.9),
            benchTM: roundToNearest5(profile.benchOneRepMax * 0.9),
            deadliftTM: roundToNearest5(profile.deadliftOneRepMax * 0.9),
            pressTM: roundToNearest5(profile.pressOneRepMax * 0.9),
          },
        })
      },

      advanceDay: () => {
        const { profile } = get()
        if (!profile) return false

        let { currentDay, currentWeek } = profile
        currentDay++

        if (currentDay > 4) {
          currentDay = 1
          currentWeek++
        }

        if (currentWeek > 3) {
          // Cycle complete
          set({
            profile: {
              ...profile,
              currentDay,
              currentWeek,
              isCycleComplete: true,
            },
          })
          return true
        }

        set({
          profile: { ...profile, currentDay, currentWeek },
        })
        return false
      },

      startNewCycle: () => {
        const { profile } = get()
        if (!profile) return
        set({
          profile: {
            ...profile,
            currentWeek: 1,
            currentDay: 1,
            cycleNumber: profile.cycleNumber + 1,
            isCycleComplete: false,
          },
        })
      },

      saveWorkout: (session, logs) => {
        const sessionId = generateId()
        const fullSession: WorkoutSession = { ...session, id: sessionId }
        const fullLogs: SetLog[] = logs.map((log) => ({
          ...log,
          id: generateId(),
          sessionId,
        }))

        set((state) => ({
          sessions: [...state.sessions, fullSession],
          setLogs: [...state.setLogs, ...fullLogs],
        }))

        return sessionId
      },

      updateActiveWorkout: (partial) => {
        set((state) => ({
          activeWorkout: { ...state.activeWorkout, ...partial },
        }))
      },

      clearActiveWorkout: () => {
        set({ activeWorkout: { ...EMPTY_ACTIVE_WORKOUT } })
      },

      addWilksEntry: (entry) => {
        const full: WilksEntry = { ...entry, id: generateId() }
        set((state) => ({
          wilksEntries: [...state.wilksEntries, full],
        }))
      },

      setCustomAccessories: (accessories) => {
        set({ customAccessories: accessories })
      },

      addSavedExercise: (exercise) => {
        set((state) => {
          // Avoid duplicates by name (case-insensitive)
          const exists = state.savedExercises.some(
            (e) => e.name.toLowerCase() === exercise.name.toLowerCase(),
          )
          if (exists) return state
          return { savedExercises: [...state.savedExercises, exercise] }
        })
      },

      resetAll: () => {
        set({ profile: null, sessions: [], setLogs: [], wilksEntries: [], activeWorkout: { ...EMPTY_ACTIVE_WORKOUT }, customAccessories: null, savedExercises: [] })
      },

      exportData: () => {
        const { profile, sessions, setLogs, wilksEntries, customAccessories, savedExercises } = get()
        return JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), profile, sessions, setLogs, wilksEntries, customAccessories, savedExercises },
          null,
          2,
        )
      },

      importData: (json: string) => {
        const data = JSON.parse(json)
        if (data.version !== 1) throw new Error('Unsupported backup version')
        set({
          profile: data.profile,
          sessions: data.sessions ?? [],
          setLogs: data.setLogs ?? [],
          wilksEntries: data.wilksEntries ?? [],
          customAccessories: data.customAccessories ?? null,
          savedExercises: data.savedExercises ?? [],
        })
      },

      getTrainingMax: (lift) => {
        const { profile } = get()
        if (!profile) return 0
        return trainingMax(profile, lift)
      },

      getCurrentLift: () => {
        const { profile } = get()
        if (!profile) return null
        return liftFromDay(profile.currentDay)
      },
    }),
    {
      name: 'my-workouts-storage',
      merge: (persisted, current) => {
        const state = { ...current, ...(persisted as Partial<AppState>) }
        // Ensure activeWorkout always has every expected field (handles old persisted shapes)
        state.activeWorkout = { ...EMPTY_ACTIVE_WORKOUT, ...state.activeWorkout }
        // Ensure new top-level fields have defaults
        if (state.customAccessories === undefined) state.customAccessories = null
        if (!Array.isArray(state.savedExercises)) state.savedExercises = []
        return state
      },
    },
  ),
)
