import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { UserProfile, WorkoutSession, SetLog, WilksEntry, MainLift, AccessoryExercise, ProgramVariant, Units, DeloadType, CloudSyncConfig, SupplementalOverride, ExerciseDef, ProgramType } from './types'
import { liftFromDay, MAIN_LIFTS, PhaseType, ProgramType as PT, toStorageLbs, toDisplayWeight, isValidDayOrder } from './types'
import { roundWeight } from './logic/calculator'
import { getVariantConfig } from './logic/variants'
import { getAccessories, getHypertrophyAccessories } from './logic/accessories'
import { computeWeekAdvance, remainingDays } from './logic/weekOrder'
import { mainLiftForDay } from './logic/hypertrophyCalculator'

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
  // Identity of the workout in progress, pinned at startSession so a mid-session
  // profile change (settings, cloud sync) can't silently re-point it to another lift.
  // Both null when no workout is active. liftRawValue is the MainLift value (1-4),
  // or 0 when the day has no top-set main lift (hypertrophy Pull day).
  day: number | null
  liftRawValue: number | null
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
  day: null,
  liftRawValue: null,
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
  if (state.customSupplemental === undefined) state.customSupplemental = null
  if (!state.programAccessoryArchive || typeof state.programAccessoryArchive !== 'object') state.programAccessoryArchive = {}
  if (!state.programSupplementalArchive || typeof state.programSupplementalArchive !== 'object') state.programSupplementalArchive = {}
  if (!Array.isArray(state.savedExercises)) state.savedExercises = []

  // Normalize the exercise library to context-free ExerciseDef and union in any
  // exercises currently in use across customAccessories / customSupplemental so
  // anything the user has ever defined shows up wherever they pick an exercise.
  {
    const byName = new Map<string, ExerciseDef>()
    const add = (ex: { id: string; name: string; weightType: AccessoryExercise['weightType'] } | undefined) => {
      if (!ex || !ex.name) return
      const key = ex.name.toLowerCase()
      if (byName.has(key)) return
      byName.set(key, { id: ex.id, name: ex.name, weightType: ex.weightType })
    }
    for (const ex of state.savedExercises) add(ex)
    if (state.customAccessories) {
      for (const k of Object.keys(state.customAccessories)) {
        for (const ex of state.customAccessories[Number(k)] ?? []) add(ex)
      }
    }
    if (state.customSupplemental) {
      for (const k of Object.keys(state.customSupplemental)) {
        const o = state.customSupplemental[Number(k)]
        if (o) add(o.exercise)
      }
    }
    state.savedExercises = Array.from(byName.values())
  }
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
    if (!state.profile.programType) updates.programType = PT.FiveThreeOne
    if (state.profile.cycleWeeks === undefined) updates.cycleWeeks = 3
    if (!isValidDayOrder(state.profile.dayOrder)) updates.dayOrder = [...MAIN_LIFTS]
    if (!Array.isArray(state.profile.completedDaysThisWeek)) {
      // Pre-feature completion was strictly linear, so days before currentDay are done.
      const cd = state.profile.currentDay ?? 1
      updates.completedDaysThisWeek = Array.from({ length: Math.max(0, cd - 1) }, (_, i) => i + 1)
    }
    if (Object.keys(updates).length > 0) {
      state.profile = { ...state.profile, ...updates }
    }
  }

  // Heal a workout that was already in progress before the day/lift pin fields
  // existed: pin it to the profile's current position. Best-effort — it matches
  // the pre-pin behavior and self-corrects on the next startSession.
  if (state.activeWorkout.isActive && state.activeWorkout.day == null && state.profile) {
    const pt = state.profile.programType ?? PT.FiveThreeOne
    state.activeWorkout.day = state.profile.currentDay
    state.activeWorkout.liftRawValue =
      mainLiftForDay(pt, state.profile.currentDay, state.profile.dayOrder) ?? 0
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
      customSupplemental: null,
      programAccessoryArchive: {},
      programSupplementalArchive: {},
      savedExercises: [],
      restNotifyEnabled: true,
      restNotifyMinutes: 3,
      cloudSync: null,

      createProfile: (squatRM, benchRM, deadliftRM, pressRM, variant, tmPercentage, sex, units, programType) => {
        const program = programType ?? PT.FiveThreeOne
        // Hypertrophy locks tmPercentage to 85; 5/3/1 defaults to 90 when unspecified.
        const effectiveTmPct: 85 | 90 = program === PT.Hypertrophy ? 85 : (tmPercentage ?? 90)
        const pct = effectiveTmPct / 100
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
        // Hypertrophy seeds initial top sets at ~85% of TM (≈72% of 1RM)
        const hypertrophyTopSets = program === PT.Hypertrophy
          ? {
              1: toStorageLbs(roundWeight(toDisplayWeight(sqTM, u) * 0.85, u), u),
              2: toStorageLbs(roundWeight(toDisplayWeight(bpTM, u) * 0.85, u), u),
              3: toStorageLbs(roundWeight(toDisplayWeight(dlTM, u) * 0.85, u), u),
            }
          : undefined
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
          tmPercentage: effectiveTmPct,
          sex: sex ?? 'male',
          units: u,
          isDeloading: false,
          deloadType: null,
          deloadDay: 1,
          bodyWeightLbs: null,
          bodyWeightLastUpdated: null,
          createdAt: new Date().toISOString(),
          programType: program,
          cycleWeeks: program === PT.Hypertrophy ? 7 : 3,
          dayOrder: [...MAIN_LIFTS],
          completedDaysThisWeek: [],
          hypertrophyTopSets,
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
            const defaults = programType === PT.Hypertrophy
              ? getHypertrophyAccessories(lift)
              : getAccessories(lift)
            nextAccessories[lift] = defaults.map((ex) => ({ ...ex }))
          }
        }
        // Supplemental overrides only apply to 5/3/1; hypertrophy has no supplemental.
        const nextSupplemental =
          programType === PT.Hypertrophy ? null : (nextSupplementalArchive[programType] ?? null)
        // Once the new program's archive has been consumed, clear it so a later switch back
        // doesn't restore stale data — fresh edits will repopulate it.
        delete nextAccessoryArchive[programType]
        delete nextSupplementalArchive[programType]
        // tmPercentage convention: hypertrophy = 85, 5/3/1 preserves current (default 90).
        const newTmPct: 85 | 90 = programType === PT.Hypertrophy ? 85 : profile.tmPercentage
        const u = profile.units ?? 'lbs'
        const computeTM = (rmLbs: number) =>
          toStorageLbs(roundWeight(toDisplayWeight(rmLbs, u) * (newTmPct / 100), u), u)
        const sqTM = computeTM(profile.squatOneRepMax)
        const bpTM = computeTM(profile.benchOneRepMax)
        const dlTM = computeTM(profile.deadliftOneRepMax)
        const prTM = computeTM(profile.pressOneRepMax)
        // Seed hypertrophy top sets at ~85% of TM (≈ spec week-1 starting top sets).
        const hypertrophyTopSets =
          programType === PT.Hypertrophy
            ? {
                1: toStorageLbs(roundWeight(toDisplayWeight(sqTM, u) * 0.85, u), u),
                2: toStorageLbs(roundWeight(toDisplayWeight(bpTM, u) * 0.85, u), u),
                3: toStorageLbs(roundWeight(toDisplayWeight(dlTM, u) * 0.85, u), u),
              }
            : undefined
        set({
          profile: {
            ...profile,
            programType,
            cycleWeeks: programType === PT.Hypertrophy ? 7 : 3,
            tmPercentage: newTmPct,
            squatTM: sqTM,
            benchTM: bpTM,
            deadliftTM: dlTM,
            pressTM: prTM,
            currentWeek: 1,
            currentDay: 1,
            completedDaysThisWeek: [],
            isCycleComplete: false,
            isDeloading: false,
            deloadType: null,
            deloadDay: 1,
            hypertrophyTopSets,
          },
          customAccessories: nextAccessories,
          customSupplemental: nextSupplemental,
          programAccessoryArchive: nextAccessoryArchive,
          programSupplementalArchive: nextSupplementalArchive,
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
        set({ profile: null, sessions: [], setLogs: [], wilksEntries: [], activeWorkout: { ...EMPTY_ACTIVE_WORKOUT }, customAccessories: null, customSupplemental: null, savedExercises: [], cloudSync: null })
      },

      exportData: () => {
        // NOTE: cloudSync is intentionally excluded — it contains a GitHub PAT
        const { profile, sessions, setLogs, wilksEntries, customAccessories, customSupplemental, savedExercises } = get()
        return JSON.stringify(
          { version: 1, exportedAt: new Date().toISOString(), profile, sessions, setLogs, wilksEntries, customAccessories, customSupplemental, savedExercises },
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
          customSupplemental: data.customSupplemental ?? null,
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
        return liftFromDay(profile.currentDay, profile.dayOrder)
      },
    }),
    {
      name: 'my-workouts-storage',
      merge: mergePersistedState,
    },
  ),
)
