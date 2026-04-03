import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, WorkoutSession, SetLog, WilksEntry, MainLift, AccessoryExercise, ProgramVariant } from './types'
import { liftFromDay, MAIN_LIFTS, PhaseType } from './types'
import { getVariantConfig } from './logic/variants'
import { getAccessories } from './logic/accessories'

// ============================================================
// Helpers
// ============================================================

function roundToNearest2_5(value: number): number {
  return Math.round(value / 2.5) * 2.5
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
    default: return profile.squatTM
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
  restNotifyEnabled: boolean
  restNotifyMinutes: number

  // Profile actions
  createProfile: (squatRM: number, benchRM: number, deadliftRM: number, pressRM: number, variant?: ProgramVariant) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  recalculateTMs: () => void
  advanceDay: () => boolean  // returns true if cycle completed
  startNewCycle: (variant?: ProgramVariant) => void

  // Workout actions
  saveWorkout: (session: Omit<WorkoutSession, 'id'>, logs: Omit<SetLog, 'id' | 'sessionId'>[]) => string
  updateActiveWorkout: (partial: Partial<ActiveWorkout>) => void
  clearActiveWorkout: () => void
  
  // Wilks actions
  addWilksEntry: (entry: Omit<WilksEntry, 'id'>) => void

  // Accessory actions
  setCustomAccessories: (accessories: Record<number, AccessoryExercise[]>) => void
  addSavedExercise: (exercise: AccessoryExercise) => void

  // Notification actions
  setRestNotifyEnabled: (enabled: boolean) => void
  setRestNotifyMinutes: (minutes: number) => void

  // Data management
  resetAll: () => void
  exportData: () => string
  importData: (json: string) => void

  // Helpers
  getTrainingMax: (lift: MainLift) => number
  getCurrentLift: () => MainLift | null
}

// ============================================================
// Merge (exported for testing)
// ============================================================

export function mergePersistedState(persisted: unknown, current: AppState): AppState {
  const state = { ...current, ...(persisted as Partial<AppState>) }
  // Ensure activeWorkout always has every expected field (handles old persisted shapes)
  state.activeWorkout = { ...EMPTY_ACTIVE_WORKOUT, ...state.activeWorkout }
  // Ensure new top-level fields have defaults
  // One-time migration: populate default accessories for existing users who never customized
  if (state.profile && !(state as Record<string, unknown>)._migratedAccessories && (state.customAccessories === undefined || state.customAccessories === null)) {
    const m: Record<number, AccessoryExercise[]> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = getAccessories(lift).map((ex) => ({ ...ex }))
    }
    state.customAccessories = m
  }
  if (state.profile && state.customAccessories !== undefined && state.customAccessories !== null) {
    (state as Record<string, unknown>)._migratedAccessories = true
  }
  if (state.customAccessories === undefined) state.customAccessories = null
  if (!Array.isArray(state.savedExercises)) state.savedExercises = []
  if (state.restNotifyEnabled === undefined) state.restNotifyEnabled = true
  if (state.restNotifyMinutes === undefined) state.restNotifyMinutes = 3
  // Ensure new profile fields have defaults (variant support)
  if (state.profile) {
    const updates: Partial<UserProfile> = {}
    if (!state.profile.currentVariant) updates.currentVariant = 'fsl'
    if (state.profile.leaderCycleCount === undefined) updates.leaderCycleCount = 0
    if (state.profile.anchorCycleCount === undefined) updates.anchorCycleCount = 0
    if (Object.keys(updates).length > 0) {
      state.profile = { ...state.profile, ...updates }
    }
  }
  return state
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
      restNotifyEnabled: true,
      restNotifyMinutes: 3,

      createProfile: (squatRM, benchRM, deadliftRM, pressRM, variant) => {
        const profile: UserProfile = {
          squatOneRepMax: squatRM,
          benchOneRepMax: benchRM,
          deadliftOneRepMax: deadliftRM,
          pressOneRepMax: pressRM,
          squatTM: roundToNearest2_5(squatRM * 0.9),
          benchTM: roundToNearest2_5(benchRM * 0.9),
          deadliftTM: roundToNearest2_5(deadliftRM * 0.9),
          pressTM: roundToNearest2_5(pressRM * 0.9),
          currentWeek: 1,
          currentDay: 1,
          cycleNumber: 1,
          isCycleComplete: false,
          currentVariant: variant ?? 'fsl',
          leaderCycleCount: 0,
          anchorCycleCount: 0,
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
            squatTM: roundToNearest2_5(profile.squatOneRepMax * 0.9),
            benchTM: roundToNearest2_5(profile.benchOneRepMax * 0.9),
            deadliftTM: roundToNearest2_5(profile.deadliftOneRepMax * 0.9),
            pressTM: roundToNearest2_5(profile.pressOneRepMax * 0.9),
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

      startNewCycle: (variant?: ProgramVariant) => {
        const { profile } = get()
        if (!profile) return

        const currentVariant = profile.currentVariant ?? 'fsl'
        const newVariant = variant ?? currentVariant
        const oldPhase = getVariantConfig(currentVariant).phase
        const newPhase = getVariantConfig(newVariant).phase

        let leaderCycleCount = profile.leaderCycleCount ?? 0
        let anchorCycleCount = profile.anchorCycleCount ?? 0

        // The just-completed cycle used oldPhase; increment its counter
        if (oldPhase === PhaseType.Leader) {
          leaderCycleCount++
        } else {
          anchorCycleCount++
        }

        // If switching phase type, reset the old counter
        if (newPhase !== oldPhase) {
          if (newPhase === PhaseType.Leader) {
            anchorCycleCount = 0
          } else {
            leaderCycleCount = 0
          }
        }

        set({
          profile: {
            ...profile,
            currentWeek: 1,
            currentDay: 1,
            cycleNumber: profile.cycleNumber + 1,
            isCycleComplete: false,
            currentVariant: newVariant,
            leaderCycleCount,
            anchorCycleCount,
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

      setRestNotifyEnabled: (enabled) => set({ restNotifyEnabled: enabled }),
      setRestNotifyMinutes: (minutes) => set({ restNotifyMinutes: Math.max(1, Math.min(10, minutes)) }),

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
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        let data: any
        try {
          data = JSON.parse(json)
        } catch {
          throw new Error('Invalid backup file')
        }
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
      merge: mergePersistedState,
    },
  ),
)
