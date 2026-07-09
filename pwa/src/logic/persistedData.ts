// ============================================================
// Persisted data slice — shared shape, defaults, and normalization
// ============================================================
//
// One reusable primitive owns "what the persisted data looks like and how any
// historical shape is healed into the current one". Both rehydration (the
// zustand persist `merge`) and backup import compose it, so an old backup or
// an old localStorage blob get identical field defaulting.

import type {
  UserProfile,
  WorkoutSession,
  SetLog,
  WilksEntry,
  AccessoryExercise,
  SupplementalOverride,
  ExerciseDef,
  CloudSyncConfig,
  ProgramType,
} from '../types'
import { MAIN_LIFTS, ProgramType as PT, isValidDayOrder } from '../types'
import { getProgramAccessories, mainLiftForDay } from './programs'

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
  // Snapshot of the prescription inputs at startSession, so a mid-session
  // profile change (cloud sync, settings TM edits) can't shift the weights
  // under the user. All null when not captured — including for workouts that
  // were in flight before these fields existed — and readers fall back to
  // live profile values, matching the pre-snapshot behavior.
  week: number | null
  tmLbs: number | null
  topSetLbs: number | null
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

export const EMPTY_ACTIVE_WORKOUT: ActiveWorkout = {
  isActive: false,
  startTime: null,
  day: null,
  liftRawValue: null,
  week: null,
  tmLbs: null,
  topSetLbs: null,
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
// Persisted data slice
// ============================================================

export interface PersistedData {
  profile: UserProfile | null
  sessions: WorkoutSession[]
  setLogs: SetLog[]
  wilksEntries: WilksEntry[]
  activeWorkout: ActiveWorkout
  customAccessories: Record<number, AccessoryExercise[]> | null
  customSupplemental: Record<number, SupplementalOverride> | null
  programAccessoryArchive: Partial<Record<ProgramType, Record<number, AccessoryExercise[]>>>
  programSupplementalArchive: Partial<Record<ProgramType, Record<number, SupplementalOverride>>>
  savedExercises: ExerciseDef[]
  restNotifyEnabled: boolean
  restNotifyMinutes: number
  cloudSync: CloudSyncConfig | null
  // One-time marker persisted alongside the data: default accessories have
  // been seeded for a pre-accessory-feature profile (see normalize below).
  _migratedAccessories?: boolean
  // One-time marker: the 4-Day Upper/Lower accessory revision (add One-Arm DB
  // Row + Band Triceps Pushdown, drop Lower A lateral raise, Front Squat to
  // 6-8) has been applied to stored plans (see normalize below).
  _migratedUpperLowerPlan?: boolean
}

/** Fresh initial values for the data slice. A function (not a shared constant)
 *  so callers can't accidentally alias the inner arrays/objects. */
export function emptyPersistedData(): PersistedData {
  return {
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
  }
}

/** Pick the data slice out of a larger state object (drops store actions). */
export function pickPersistedData(s: PersistedData): PersistedData {
  return {
    profile: s.profile,
    sessions: s.sessions,
    setLogs: s.setLogs,
    wilksEntries: s.wilksEntries,
    activeWorkout: s.activeWorkout,
    customAccessories: s.customAccessories,
    customSupplemental: s.customSupplemental,
    programAccessoryArchive: s.programAccessoryArchive,
    programSupplementalArchive: s.programSupplementalArchive,
    savedExercises: s.savedExercises,
    restNotifyEnabled: s.restNotifyEnabled,
    restNotifyMinutes: s.restNotifyMinutes,
    cloudSync: s.cloudSync,
  }
}

/** Heal any historical persisted/backup shape into the current one: fill new
 *  fields with defaults, run one-time migrations, and repair invalid values.
 *  Pure — does not mutate `raw`. */
export function normalizePersistedData(raw: Record<string, unknown>): PersistedData {
  const state = { ...(raw as unknown as Partial<PersistedData>) } as PersistedData

  // Ensure activeWorkout always has every expected field (handles old persisted shapes)
  state.activeWorkout = { ...EMPTY_ACTIVE_WORKOUT, ...state.activeWorkout }

  // Core collections must be arrays even if the source blob was mangled
  if (!Array.isArray(state.sessions)) state.sessions = []
  if (!Array.isArray(state.setLogs)) state.setLogs = []
  if (!Array.isArray(state.wilksEntries)) state.wilksEntries = []

  // One-time migration: populate default accessories for existing users who never customized
  if (state.profile && !state._migratedAccessories && (state.customAccessories === undefined || state.customAccessories === null)) {
    const m: Record<number, AccessoryExercise[]> = {}
    const pt = state.profile.programType ?? PT.FiveThreeOne
    for (const lift of MAIN_LIFTS) {
      m[lift] = getProgramAccessories(pt, lift).map((ex) => ({ ...ex }))
    }
    state.customAccessories = m
  }
  if (state.profile && state.customAccessories !== undefined && state.customAccessories !== null) {
    state._migratedAccessories = true
  }
  if (state.customAccessories === undefined) state.customAccessories = null
  if (state.customSupplemental === undefined) state.customSupplemental = null

  // One-time migration: 4-Day Upper/Lower accessory revision. Surgical — each
  // change applies only where the stored entry still matches the old default
  // (id AND name), so user-customized entries always win. Insertions are
  // skipped when an exercise of the same name already exists anywhere in the
  // list. User-edited sets/reps on retargeted entries are preserved except for
  // the rep-range change itself.
  {
    const insertAfter = (
      list: AccessoryExercise[],
      afterName: string,
      entry: AccessoryExercise,
    ): AccessoryExercise[] => {
      if (list.some((ex) => ex.name.toLowerCase() === entry.name.toLowerCase())) return list
      const i = list.findIndex((ex) => ex.name === afterName)
      const next = [...list]
      next.splice(i >= 0 ? i + 1 : next.length, 0, { ...entry })
      return next
    }
    const reviseUpperLower = (rec: Record<number, AccessoryExercise[]>): Record<number, AccessoryExercise[]> => {
      const next: Record<number, AccessoryExercise[]> = {}
      for (const k of Object.keys(rec)) next[Number(k)] = [...(rec[Number(k)] ?? [])]
      // Upper A (Bench slot): add One-Arm DB Row after Incline DB Bench Press.
      if (next[2]) {
        next[2] = insertAfter(next[2], 'Incline DB Bench Press', {
          id: 'ul-oa-row', name: 'One-Arm DB Row', weightType: 'standard',
          sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
          progressionType: 'double_progression',
          notes: 'Per side. Brace free hand on bench, pull elbow toward hip.',
        })
      }
      // Lower A (Squat slot): drop the unmodified default DB Lateral Raise.
      if (next[1]) {
        next[1] = next[1].filter((ex) => !(ex.id === 'ul-lat-raise-l' && ex.name === 'DB Lateral Raise'))
      }
      // Upper B (OHP slot): add Band Triceps Pushdown after DB Lateral Raise.
      if (next[4]) {
        next[4] = insertAfter(next[4], 'DB Lateral Raise', {
          id: 'ul-band-pushdown', name: 'Band Triceps Pushdown', weightType: 'noWeight',
          sets: 3, reps: 13, repRangeMin: 12, repRangeMax: 15,
          progressionType: 'reps_only',
          notes: 'Elbows pinned to sides, full lockout.',
        })
      }
      // Lower B (Deadlift slot): retarget the unmodified default Front Squat to 6-8.
      if (next[3]) {
        next[3] = next[3].map((ex) =>
          ex.id === 'ul-front-sq' && ex.name === 'Front Squat' && ex.repRangeMin === 10 && ex.repRangeMax === 12
            ? { ...ex, reps: 7, repRangeMin: 6, repRangeMax: 8 }
            : ex,
        )
      }
      return next
    }
    if (state.profile && !state._migratedUpperLowerPlan) {
      // The archived Upper/Lower plan is never mid-workout — always safe to revise.
      const archived = state.programAccessoryArchive?.[PT.UpperLower]
      if (archived) {
        state.programAccessoryArchive = {
          ...state.programAccessoryArchive,
          [PT.UpperLower]: reviseUpperLower(archived),
        }
      }
      // The live plan is revised only when Upper/Lower is the current program.
      // Skip while a workout is in flight — active-workout accessory state is
      // keyed by exercise name, so changing the list mid-session would confuse
      // it. The flag stays unset so the revision retries on the next load.
      if (state.profile.programType === PT.UpperLower && state.activeWorkout.isActive) {
        // retry later
      } else {
        if (state.profile.programType === PT.UpperLower && state.customAccessories) {
          state.customAccessories = reviseUpperLower(state.customAccessories)
        }
        state._migratedUpperLowerPlan = true
      }
    }
  }
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
  if (state.profile === undefined) state.profile = null

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
    state.activeWorkout = {
      ...state.activeWorkout,
      day: state.profile.currentDay,
      liftRawValue: mainLiftForDay(pt, state.profile.currentDay, state.profile.dayOrder) ?? 0,
    }
  }

  return {
    ...pickPersistedData(state),
    ...(state._migratedAccessories !== undefined ? { _migratedAccessories: state._migratedAccessories } : {}),
    ...(state._migratedUpperLowerPlan !== undefined ? { _migratedUpperLowerPlan: state._migratedUpperLowerPlan } : {}),
  }
}
