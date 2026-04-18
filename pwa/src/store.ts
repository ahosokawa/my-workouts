import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, WorkoutSession, SetLog, WilksEntry, MainLift, AccessoryExercise, ProgramVariant, Units, DeloadType, CloudSyncConfig } from './types'
import { liftFromDay, MAIN_LIFTS, PhaseType, toStorageLbs, toDisplayWeight } from './types'
import { roundWeight } from './logic/calculator'
import { getVariantConfig } from './logic/variants'
import { getAccessories } from './logic/accessories'

// ============================================================
// Helpers
// ============================================================

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
  cloudSync: CloudSyncConfig | null

  // Profile actions
  createProfile: (squatRM: number, benchRM: number, deadliftRM: number, pressRM: number, variant?: ProgramVariant, tmPercentage?: 85 | 90, sex?: 'male' | 'female', units?: Units) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  recalculateTMs: () => void
  advanceDay: () => boolean  // returns true if cycle completed
  startNewCycle: (variant?: ProgramVariant) => void
  startDeload: (deloadType: DeloadType) => void
  advanceDeloadDay: () => void

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

  // Cloud sync actions
  setCloudSync: (config: CloudSyncConfig | null) => void
  setCloudSyncStatus: (partial: Partial<Pick<CloudSyncConfig, 'gistId' | 'lastSyncAt' | 'lastError'>>) => void

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
  if (state.cloudSync === undefined) state.cloudSync = null
  // Ensure new profile fields have defaults (variant support)
  if (state.profile) {
    const updates: Partial<UserProfile> = {}
    if (!state.profile.currentVariant) updates.currentVariant = 'fsl'
    if (state.profile.leaderCycleCount === undefined) updates.leaderCycleCount = 0
    if (state.profile.anchorCycleCount === undefined) updates.anchorCycleCount = 0
    if (state.profile.tmPercentage === undefined) updates.tmPercentage = 90
    if (!state.profile.sex) updates.sex = 'male'
    if (!state.profile.units) updates.units = 'lbs'
    if (state.profile.isDeloading === undefined) updates.isDeloading = false
    if (state.profile.deloadType === undefined) updates.deloadType = null
    if (state.profile.deloadDay === undefined) updates.deloadDay = 1
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
      cloudSync: null,

      createProfile: (squatRM, benchRM, deadliftRM, pressRM, variant, tmPercentage, sex, units) => {
        const pct = (tmPercentage ?? 90) / 100
        const u = units ?? 'lbs'
        // User enters values in their units — convert to lbs for storage
        const sqLbs = toStorageLbs(squatRM, u)
        const bpLbs = toStorageLbs(benchRM, u)
        const dlLbs = toStorageLbs(deadliftRM, u)
        const prLbs = toStorageLbs(pressRM, u)
        // Compute TMs in user units (round nicely), then convert to lbs
        const sqTM = toStorageLbs(roundWeight(squatRM * pct, u), u)
        const bpTM = toStorageLbs(roundWeight(benchRM * pct, u), u)
        const dlTM = toStorageLbs(roundWeight(deadliftRM * pct, u), u)
        const prTM = toStorageLbs(roundWeight(pressRM * pct, u), u)
        const profile: UserProfile = {
          squatOneRepMax: sqLbs,
          benchOneRepMax: bpLbs,
          deadliftOneRepMax: dlLbs,
          pressOneRepMax: prLbs,
          squatTM: sqTM,
          benchTM: bpTM,
          deadliftTM: dlTM,
          pressTM: prTM,
          currentWeek: 1,
          currentDay: 1,
          cycleNumber: 1,
          isCycleComplete: false,
          currentVariant: variant ?? 'fsl',
          leaderCycleCount: 0,
          anchorCycleCount: 0,
          tmPercentage: tmPercentage ?? 90,
          sex: sex ?? 'male',
          units: u,
          isDeloading: false,
          deloadType: null,
          deloadDay: 1,
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
        const pct = (profile.tmPercentage ?? 90) / 100
        const u = profile.units ?? 'lbs'
        // Convert stored lbs 1RMs to display units, compute TM, round, convert back
        const computeTM = (rmLbs: number) => toStorageLbs(roundWeight(toDisplayWeight(rmLbs, u) * pct, u), u)
        set({
          profile: {
            ...profile,
            squatTM: computeTM(profile.squatOneRepMax),
            benchTM: computeTM(profile.benchOneRepMax),
            deadliftTM: computeTM(profile.deadliftOneRepMax),
            pressTM: computeTM(profile.pressOneRepMax),
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
            isDeloading: false,
            deloadType: null,
            deloadDay: 1,
          },
        })
      },

      startDeload: (deloadType: DeloadType) => {
        const { profile } = get()
        if (!profile) return
        set({
          profile: {
            ...profile,
            isDeloading: true,
            deloadType,
            deloadDay: 1,
            isCycleComplete: false,
          },
        })
      },

      advanceDeloadDay: () => {
        const { profile } = get()
        if (!profile || !profile.isDeloading) return
        const nextDay = profile.deloadDay + 1
        if (nextDay > 4) {
          // Deload complete — start next cycle automatically
          // The variant was already saved to profile before deload started
          get().startNewCycle(profile.currentVariant)
        } else {
          set({
            profile: { ...profile, deloadDay: nextDay },
          })
        }
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

      setCloudSync: (config) => set({ cloudSync: config }),

      setCloudSyncStatus: (partial) => {
        const { cloudSync } = get()
        if (!cloudSync) return
        set({ cloudSync: { ...cloudSync, ...partial } })
      },

      resetAll: () => {
        set({ profile: null, sessions: [], setLogs: [], wilksEntries: [], activeWorkout: { ...EMPTY_ACTIVE_WORKOUT }, customAccessories: null, savedExercises: [], cloudSync: null })
      },

      exportData: () => {
        // NOTE: cloudSync is intentionally excluded — it contains a GitHub PAT
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
        // Any cloudSync key in the backup is ignored; current sync config is preserved.
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
