import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { createSafeJSONStorage, STORAGE_KEY } from './logic/safeStorage'
import type { UserProfile, WorkoutSession, SetLog, WilksEntry, MainLift, AccessoryExercise, ProgramVariant, Units, DeloadType, CloudSyncConfig, SupplementalOverride, ExerciseDef, ProgramType } from './types'
import { liftFromDay, MAIN_LIFTS, PhaseType, ProgramType as PT, toStorageLbs, toDisplayWeight, trainingMaxFor } from './types'
import { roundWeight } from './logic/calculator'
import { getVariantConfig } from './logic/variants'
import { computeWeekAdvance, remainingDays } from './logic/weekOrder'
import { getProgram, getProgramAccessories, oneRepMaxes, seedProgram, usesTopSetEngine } from './logic/programs'
import { EMPTY_ACTIVE_WORKOUT, emptyPersistedData, normalizePersistedData, pickPersistedData } from './logic/persistedData'
import type { ActiveWorkout } from './logic/persistedData'
import { serializeBackup, parseBackup } from './logic/backup'

// Re-exported so existing importers (views, tests) keep working after the
// move to logic/persistedData.ts.
export { EMPTY_ACTIVE_WORKOUT } from './logic/persistedData'
export type { ActiveWorkout } from './logic/persistedData'

// ============================================================
// Helpers
// ============================================================

export function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8)
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
  customSupplemental: Record<number, SupplementalOverride> | null  // keyed by MainLift; missing key = use main lift
  // Per-program memory: each program keeps its own last-saved customizations so switching
  // programs (in Settings or at cycle completion) restores that program's edits instead
  // of wiping them. The current program's edits live in customAccessories/customSupplemental;
  // the OTHER program's last-known edits live here, keyed by ProgramType.
  programAccessoryArchive: Partial<Record<ProgramType, Record<number, AccessoryExercise[]>>>
  programSupplementalArchive: Partial<Record<ProgramType, Record<number, SupplementalOverride>>>
  savedExercises: ExerciseDef[]  // user's exercise library (identity only — sets/reps are per-use)
  restNotifyEnabled: boolean
  restNotifyMinutes: number
  cloudSync: CloudSyncConfig | null

  // Profile actions
  createProfile: (squatRM: number, benchRM: number, deadliftRM: number, pressRM: number, variant?: ProgramVariant, tmPercentage?: 85 | 90, sex?: 'male' | 'female', units?: Units, programType?: ProgramType) => void
  updateProfile: (partial: Partial<UserProfile>) => void
  recalculateTMs: () => void
  advanceDay: (finishedDay?: number) => boolean  // returns true if cycle completed
  selectNextWorkoutDay: (day: number) => void  // pick any remaining day of the current week
  resetCycle: () => void  // back to Week 1 Day 1, discarding any in-progress workout
  startNewCycle: (variant?: ProgramVariant) => void
  startDeload: (deloadType: DeloadType) => void
  advanceDeloadDay: () => void
  switchProgram: (programType: ProgramType) => void

  // Workout actions
  saveWorkout: (session: Omit<WorkoutSession, 'id'>, logs: Omit<SetLog, 'id' | 'sessionId'>[]) => string
  updateActiveWorkout: (partial: Partial<ActiveWorkout>) => void
  clearActiveWorkout: () => void
  
  // Wilks actions
  addWilksEntry: (entry: Omit<WilksEntry, 'id'>) => void

  // Accessory actions
  setCustomAccessories: (accessories: Record<number, AccessoryExercise[]>) => void
  addSavedExercise: (exercise: ExerciseDef) => void

  // Supplemental override actions
  setCustomSupplemental: (overrides: Record<number, SupplementalOverride> | null) => void

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
  // All field defaulting / one-time migrations live in normalizePersistedData
  // so backup import heals old shapes identically to rehydration.
  return { ...state, ...normalizePersistedData(state as unknown as Record<string, unknown>) }
}

// ============================================================
// Store Implementation
// ============================================================

export const useStore = create<AppState>()(
  persist(
    (set, get) => ({
      ...emptyPersistedData(),

      createProfile: (squatRM, benchRM, deadliftRM, pressRM, variant, tmPercentage, sex, units, programType) => {
        const program = programType ?? PT.FiveThreeOne
        const u = units ?? 'lbs'
        // User enters values in their units — convert to lbs for storage
        const sqLbs = toStorageLbs(squatRM, u)
        const bpLbs = toStorageLbs(benchRM, u)
        const dlLbs = toStorageLbs(deadliftRM, u)
        const prLbs = toStorageLbs(pressRM, u)
        // TM%, TMs, cycle length, day order, and seeded top sets all come from
        // the program definition. 5/3/1 defaults to 90% when unspecified.
        const seed = seedProgram(
          getProgram(program),
          { 1: sqLbs, 2: bpLbs, 3: dlLbs, 4: prLbs },
          u,
          { currentTmPercentage: tmPercentage ?? 90 },
        )
        const profile: UserProfile = {
          squatOneRepMax: sqLbs,
          benchOneRepMax: bpLbs,
          deadliftOneRepMax: dlLbs,
          pressOneRepMax: prLbs,
          squatTM: seed.squatTM,
          benchTM: seed.benchTM,
          deadliftTM: seed.deadliftTM,
          pressTM: seed.pressTM,
          currentWeek: 1,
          currentDay: 1,
          cycleNumber: 1,
          isCycleComplete: false,
          currentVariant: variant ?? 'fsl',
          leaderCycleCount: 0,
          anchorCycleCount: 0,
          tmPercentage: seed.tmPercentage,
          sex: sex ?? 'male',
          units: u,
          isDeloading: false,
          deloadType: null,
          deloadDay: 1,
          bodyWeightLbs: null,
          bodyWeightLastUpdated: null,
          createdAt: new Date().toISOString(),
          programType: program,
          cycleWeeks: seed.cycleWeeks,
          dayOrder: seed.dayOrder,
          completedDaysThisWeek: [],
          hypertrophyTopSets: seed.hypertrophyTopSets,
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

      advanceDay: (finishedDay) => {
        const { profile } = get()
        if (!profile) return false

        // Mark the just-finished day done; the week rolls over only once all 4
        // of its days are complete — in whatever order they were done.
        // `finishedDay` is the day the active workout was pinned to; it falls
        // back to currentDay for callers that don't track a pinned day.
        const result = computeWeekAdvance({
          completedDaysThisWeek: profile.completedDaysThisWeek ?? [],
          finishedDay: finishedDay ?? profile.currentDay,
          currentWeek: profile.currentWeek,
          cycleWeeks: profile.cycleWeeks ?? 3,
        })

        set({
          profile: {
            ...profile,
            currentDay: result.currentDay,
            currentWeek: result.currentWeek,
            completedDaysThisWeek: result.completedDaysThisWeek,
            isCycleComplete: result.isCycleComplete,
          },
        })
        return result.isCycleComplete
      },

      selectNextWorkoutDay: (day) => {
        const { profile } = get()
        if (!profile) return
        // Only a day that's still pending this week can be selected as next.
        if (!remainingDays(profile.completedDaysThisWeek ?? []).includes(day)) return
        set({ profile: { ...profile, currentDay: day } })
      },

      resetCycle: () => {
        const { profile } = get()
        if (!profile) return
        // An in-progress workout is pinned to the old cycle position — it
        // can't survive the reset, so discard it rather than orphan it.
        set({
          profile: { ...profile, currentWeek: 1, currentDay: 1, completedDaysThisWeek: [], isCycleComplete: false },
          activeWorkout: { ...EMPTY_ACTIVE_WORKOUT },
        })
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
            completedDaysThisWeek: [],
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
          // A deload can now start mid-cycle (trigger banner) — a workout in
          // progress belongs to the abandoned cycle position, so discard it.
          activeWorkout: { ...EMPTY_ACTIVE_WORKOUT },
        })
      },

      advanceDeloadDay: () => {
        const { profile } = get()
        if (!profile || !profile.isDeloading) return
        const nextDay = profile.deloadDay + 1
        if (nextDay > 4) {
          // Deload complete — stamp it (feeds the time-based deload trigger),
          // then start the next cycle automatically. The variant was already
          // saved to the profile before the deload started.
          set({ profile: { ...profile, lastDeloadEndedAt: new Date().toISOString() } })
          get().startNewCycle(profile.currentVariant)
        } else {
          set({
            profile: { ...profile, deloadDay: nextDay },
          })
        }
      },

      switchProgram: (programType) => {
        const { profile, customAccessories, customSupplemental, programAccessoryArchive, programSupplementalArchive } = get()
        if (!profile) return
        const oldProgram = profile.programType ?? PT.FiveThreeOne
        // Archive the OLD program's current customizations so they're restored next time the
        // user switches back. The archive is keyed by program, so each program remembers its
        // own state across switches.
        const nextAccessoryArchive: Partial<Record<ProgramType, Record<number, AccessoryExercise[]>>> = {
          ...programAccessoryArchive,
        }
        if (customAccessories) nextAccessoryArchive[oldProgram] = customAccessories
        const nextSupplementalArchive: Partial<Record<ProgramType, Record<number, SupplementalOverride>>> = {
          ...programSupplementalArchive,
        }
        if (customSupplemental) nextSupplementalArchive[oldProgram] = customSupplemental
        // Restore the NEW program's archived state, falling back to defaults on first encounter.
        const archivedAccessories = nextAccessoryArchive[programType]
        const nextAccessories: Record<number, AccessoryExercise[]> = {}
        for (const lift of MAIN_LIFTS) {
          if (archivedAccessories?.[lift]) {
            nextAccessories[lift] = archivedAccessories[lift].map((ex) => ({ ...ex }))
          } else {
            nextAccessories[lift] = getProgramAccessories(programType, lift).map((ex) => ({ ...ex }))
          }
        }
        // Supplemental overrides only apply to 5/3/1; top-set-engine programs have no supplemental.
        const nextSupplemental =
          usesTopSetEngine(programType) ? null : (nextSupplementalArchive[programType] ?? null)
        // Once the new program's archive has been consumed, clear it so a later switch back
        // doesn't restore stale data — fresh edits will repopulate it.
        delete nextAccessoryArchive[programType]
        delete nextSupplementalArchive[programType]
        // TM%, TMs, cycle length, day order, and seeded top sets all come from the
        // program definition; 5/3/1 preserves the user's current TM% and day order.
        const seed = seedProgram(getProgram(programType), oneRepMaxes(profile), profile.units ?? 'lbs', {
          currentTmPercentage: profile.tmPercentage,
          currentDayOrder: profile.dayOrder,
        })
        set({
          profile: {
            ...profile,
            programType,
            cycleWeeks: seed.cycleWeeks,
            tmPercentage: seed.tmPercentage,
            squatTM: seed.squatTM,
            benchTM: seed.benchTM,
            deadliftTM: seed.deadliftTM,
            pressTM: seed.pressTM,
            currentWeek: 1,
            currentDay: 1,
            completedDaysThisWeek: [],
            dayOrder: seed.dayOrder,
            isCycleComplete: false,
            isDeloading: false,
            deloadType: null,
            deloadDay: 1,
            hypertrophyTopSets: seed.hypertrophyTopSets,
          },
          customAccessories: nextAccessories,
          customSupplemental: nextSupplemental,
          programAccessoryArchive: nextAccessoryArchive,
          programSupplementalArchive: nextSupplementalArchive,
          // A workout in progress belongs to the old program — discard it so
          // it can't render against the new program's prescriptions.
          activeWorkout: { ...EMPTY_ACTIVE_WORKOUT },
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

      setCustomSupplemental: (overrides) => {
        set({ customSupplemental: overrides })
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
        // Structurally complete: every persisted data field returns to its
        // initial value (archives and rest-notify settings included).
        set({ ...emptyPersistedData() })
      },

      exportData: () => serializeBackup(pickPersistedData(get())),

      importData: (json: string) => {
        // parseBackup throws on malformed/unsupported files; cloudSync in the
        // file is dropped there, so the device's sync config is never touched.
        const data = parseBackup(json)
        // Base on the current data slice so fields a v1 backup doesn't carry
        // (archives, rest-notify settings) keep their device-local values,
        // then normalize so an old backup gains every newer field default
        // immediately — no reload needed. Import always discards any
        // in-flight workout: it likely doesn't match the imported profile.
        set(
          normalizePersistedData({
            ...pickPersistedData(get()),
            ...data,
            activeWorkout: { ...EMPTY_ACTIVE_WORKOUT },
          } as unknown as Record<string, unknown>),
        )
      },

      getTrainingMax: (lift) => {
        const { profile } = get()
        if (!profile) return 0
        return trainingMaxFor(profile, lift)
      },

      getCurrentLift: () => {
        const { profile } = get()
        if (!profile) return null
        return liftFromDay(profile.currentDay, profile.dayOrder)
      },
    }),
    {
      name: STORAGE_KEY,
      // Catches corrupt-blob parse failures and preserves the raw data for the
      // recovery screen instead of silently booting empty (see safeStorage.ts).
      storage: createSafeJSONStorage(),
      // Blobs written before versioning carry zustand's default version 0;
      // the identity migrate accepts them and merge normalizes every
      // historical shape. version exists so future breaking changes can
      // migrate explicitly.
      version: 1,
      migrate: (persisted) => persisted as AppState,
      merge: mergePersistedState,
    },
  ),
)
