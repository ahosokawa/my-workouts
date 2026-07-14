// ============================================================
// Main Lift enum
// ============================================================

export const MainLift = {
  Squat: 1,
  BenchPress: 2,
  Deadlift: 3,
  ShoulderPress: 4,
} as const

export type MainLift = (typeof MainLift)[keyof typeof MainLift]

export const MAIN_LIFTS = [
  MainLift.Squat,
  MainLift.BenchPress,
  MainLift.Deadlift,
  MainLift.ShoulderPress,
] as const

export function liftDisplayName(lift: MainLift): string {
  switch (lift) {
    case MainLift.Squat: return 'Squat'
    case MainLift.BenchPress: return 'Bench Press'
    case MainLift.Deadlift: return 'Deadlift'
    case MainLift.ShoulderPress: return 'Overhead Press'
  }
}

export function liftShortName(lift: MainLift): string {
  switch (lift) {
    case MainLift.Squat: return 'SQ'
    case MainLift.BenchPress: return 'BP'
    case MainLift.Deadlift: return 'DL'
    case MainLift.ShoulderPress: return 'OHP'
  }
}

export function liftProgressionAmount(lift: MainLift, units: Units = 'lbs'): number {
  if (units === 'kg') {
    switch (lift) {
      case MainLift.Squat:
      case MainLift.Deadlift:
        return 5
      case MainLift.BenchPress:
      case MainLift.ShoulderPress:
        return 2.5
    }
  }
  switch (lift) {
    case MainLift.Squat:
    case MainLift.Deadlift:
      return 10
    case MainLift.BenchPress:
    case MainLift.ShoulderPress:
      return 5
  }
}

/** Map a training-week day (1-based) to its main lift.
 *  With `dayOrder` the day is resolved against the user's custom lift order;
 *  without it, days map directly to lifts (Squat/Bench/Deadlift/OHP).
 *  Note: callers passing a raw MainLift value (not a day) should omit `dayOrder`. */
export function liftFromDay(day: number, dayOrder?: readonly MainLift[]): MainLift | null {
  if (dayOrder) {
    return day >= 1 && day <= dayOrder.length ? dayOrder[day - 1] : null
  }
  if (day >= 1 && day <= 4) return day as MainLift
  return null
}

/** Default training-week order: Squat, Bench, Deadlift, Overhead Press. */
export const DEFAULT_DAY_ORDER: readonly MainLift[] = MAIN_LIFTS

/** True when `value` is a permutation of the four main lifts — a valid day order. */
export function isValidDayOrder(value: unknown): value is MainLift[] {
  if (!Array.isArray(value) || value.length !== MAIN_LIFTS.length) return false
  const seen = new Set<unknown>(value)
  return seen.size === MAIN_LIFTS.length && MAIN_LIFTS.every((l) => seen.has(l))
}

/** True when the current cycle hasn't started — week 1 with no days logged yet,
 *  not deloading. Day order is only safe to change at this boundary: reordering
 *  mid-cycle would change which lifts land in days not yet trained, skewing cycle
 *  evaluation (a lift could be trained twice or skipped within a week).
 *  Note: `currentDay` alone is no longer a reliable signal — with within-week
 *  reordering it can be non-1 at a fresh cycle start. */
export function isCycleStart(profile: {
  currentWeek: number
  completedDaysThisWeek?: number[]
  isDeloading: boolean
}): boolean {
  return (
    !profile.isDeloading &&
    profile.currentWeek === 1 &&
    (profile.completedDaysThisWeek?.length ?? 0) === 0
  )
}

// ============================================================
// Units
// ============================================================

export type Units = 'lbs' | 'kg'

// Conversion constants
export const KG_TO_LBS = 2.20462
export const LBS_TO_KG = 1 / KG_TO_LBS

/** Convert a weight stored in lbs to the user's display unit */
export function toDisplayWeight(storedLbs: number, units: Units): number {
  return units === 'kg' ? storedLbs * LBS_TO_KG : storedLbs
}

/** Convert a user-entered weight (in display units) to lbs for storage */
export function toStorageLbs(value: number, units: Units): number {
  return units === 'kg' ? value * KG_TO_LBS : value
}

/** Convert stored lbs to display units, rounded appropriately.
 *  lbs: round to nearest 0.5 (preserves plate-loadable precision).
 *  kg: round to nearest integer. */
export function displayRound(storedLbs: number, units: Units): number {
  const val = toDisplayWeight(storedLbs, units)
  if (units === 'kg') return Math.round(val)
  // Round to nearest 0.5 for lbs (handles floating point from conversions)
  return Math.round(val * 2) / 2
}

// ============================================================
// Accessory Weight Type
// ============================================================

export const AccessoryWeightType = {
  Standard: 'standard',
  Bodyweight: 'bodyweight',
  NoWeight: 'noWeight',
  Barbell: 'barbell',
} as const

export type AccessoryWeightType = (typeof AccessoryWeightType)[keyof typeof AccessoryWeightType]

// ============================================================
// Program Variant & Phase
// ============================================================

export const ProgramVariant = { FSL: 'fsl', BBB: 'bbb', SSL: 'ssl', BBS: 'bbs' } as const
export type ProgramVariant = (typeof ProgramVariant)[keyof typeof ProgramVariant]

export const PhaseType = { Leader: 'leader', Anchor: 'anchor' } as const
export type PhaseType = (typeof PhaseType)[keyof typeof PhaseType]

export const DeloadType = { TMTest: 'tm_test', Deload: 'deload' } as const
export type DeloadType = (typeof DeloadType)[keyof typeof DeloadType]

// ============================================================
// Program Type (5/3/1 vs 4-Day Hypertrophy)
// ============================================================

export const ProgramType = { FiveThreeOne: '531', Hypertrophy: 'hypertrophy', UpperLower: 'upper_lower' } as const
export type ProgramType = (typeof ProgramType)[keyof typeof ProgramType]

/** Per-exercise progression strategy. Spec §5. */
export const ProgressionType = {
  Fixed: 'fixed',
  Double: 'double_progression',
  RepsThenLoad: 'reps_then_load',
  RepsOnly: 'reps_only',
  RomStages: 'rom_stages',
} as const
export type ProgressionType = (typeof ProgressionType)[keyof typeof ProgressionType]

// ============================================================
// Data Models
// ============================================================

export interface UserProfile {
  squatOneRepMax: number
  benchOneRepMax: number
  deadliftOneRepMax: number
  pressOneRepMax: number
  squatTM: number
  benchTM: number
  deadliftTM: number
  pressTM: number
  currentWeek: number   // 1-cycleWeeks
  currentDay: number    // 1-4
  cycleNumber: number
  isCycleComplete: boolean
  currentVariant: ProgramVariant
  leaderCycleCount: number
  anchorCycleCount: number
  tmPercentage: 85 | 90
  sex: 'male' | 'female'
  units: Units
  isDeloading: boolean
  deloadType: DeloadType | null
  deloadDay: number  // 1-4 during deload
  bodyWeightLbs: number | null
  bodyWeightLastUpdated: string | null  // ISO date
  createdAt: string                     // ISO date
  // Program selection (added later — existing profiles migrate to '531' / 3)
  programType: ProgramType
  cycleWeeks: number  // 3 for 5/3/1, 7 for hypertrophy (default)
  // Order of the 4 main lifts across the training week — a permutation of MAIN_LIFTS.
  // Optional: legacy profiles migrate to DEFAULT_DAY_ORDER. Applies to 5/3/1 only;
  // hypertrophy days have fixed Lower/Upper-focus semantics and ignore this.
  dayOrder?: MainLift[]
  // Day numbers (1–4) completed in the current week of the current cycle. Lets the
  // week's 4 lifts be done in any order; reset to [] at each new week/cycle.
  // Optional: legacy profiles migrate from currentDay (days before it were linear).
  completedDaysThisWeek?: number[]
  // Current top-set weight (stored in lbs) per main lift for hypertrophy program.
  // Drives next-session prescription; updated after each session via progression algo.
  hypertrophyTopSets?: Partial<Record<MainLift, number>>
  // ISO date the last deload/TM-test week finished. Migrated from the newest
  // week-0 session when absent; null = never deloaded (time-based deload
  // suggestions then measure from createdAt).
  lastDeloadEndedAt?: string | null
  // Weeks between deload suggestions (time-based trigger). Default 7.
  deloadCadenceWeeks?: number
}

/** The stored training max (lbs) for a main lift. Single source for the
 *  lift → TM-field mapping. */
export function trainingMaxFor(profile: UserProfile, lift: MainLift): number {
  switch (lift) {
    case MainLift.Squat: return profile.squatTM
    case MainLift.BenchPress: return profile.benchTM
    case MainLift.Deadlift: return profile.deadliftTM
    case MainLift.ShoulderPress: return profile.pressTM
  }
}

export interface WorkoutSession {
  id: string
  date: string             // ISO date
  liftRawValue: number     // MainLift raw value
  week: number
  cycleNumber: number
  durationSeconds: number
  variant?: ProgramVariant
}

export interface SetLog {
  id: string
  sessionId: string
  exerciseName: string
  isMainLift: boolean
  setIndex: number
  weight: number
  targetReps: number
  actualReps: number | null
  isAMRAP: boolean
  isCompleted: boolean
  completedAt: string | null  // ISO date
  /** Reps-in-reserve self-report. 0/1/2/3 where 3 means "3 or more". Hypertrophy top sets only. */
  rir?: number | null
  /** Prescribed rep-range for top sets (copied from PrescribedSet at save). Absent on 5/3/1 AMRAP and older logs. */
  repRangeMin?: number
  repRangeMax?: number
}

/** True when an isAMRAP log is a rep-range top set (hypertrophy/UL/TM-retest), not a true
 *  5/3/1 AMRAP. New logs carry repRangeMin; older completed top sets are identified by the
 *  presence of the `rir` key, which the top-set save paths attach (even when its value is
 *  null) and the 5/3/1 save path never does. */
export function isTopSetLog(log: SetLog): boolean {
  return log.isAMRAP && (log.repRangeMin != null || log.rir !== undefined)
}

export interface WilksEntry {
  id: string
  date: string             // ISO date
  bodyWeightLbs: number
  squatE1RM: number
  benchE1RM: number
  deadliftE1RM: number
  total: number
  wilksScore: number
}

// ============================================================
// Prescribed Set (for calculator output)
// ============================================================

export interface PrescribedSet {
  id: string
  setNumber: number        // 1-based
  percentage: number
  targetReps: number
  isWarmup: boolean
  isAMRAP: boolean
  isSupplemental: boolean  // 5x5 FSL sets after AMRAP
  weight: number
  /** Hypertrophy: prescribed rep-range bounds for the top set (e.g. 5-6). Both undefined for 5/3/1. */
  repRangeMin?: number
  repRangeMax?: number
}

// ============================================================
// Exercise Definition (reusable)
// ============================================================

/** Identity of an exercise — name and how it's weighted.
 *  Reusable wherever we need to refer to an exercise (accessories, supplemental swaps, etc.). */
export interface ExerciseDef {
  id: string
  name: string
  weightType: AccessoryWeightType
}

// ============================================================
// Muscle groups (weekly-volume metrics)
// ============================================================

export const MUSCLE_GROUPS = [
  'quads', 'hamstrings', 'glutes', 'chest', 'back',
  'shoulders', 'biceps', 'triceps', 'calves', 'core', 'other',
] as const
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number]

/** Accessory-specific exercise: an ExerciseDef plus sets/reps prescription.
 *  Optional `repRangeMin`/`repRangeMax` enable rep-range prescriptions (e.g. "8-10").
 *  When absent, `reps` is the fixed target. `progressionType` drives autoprogression.
 *  `muscleGroups` optionally overrides the name-based inference used by the
 *  weekly-volume metrics. */
export interface AccessoryExercise extends ExerciseDef {
  sets: number
  reps: number
  repRangeMin?: number
  repRangeMax?: number
  progressionType?: ProgressionType
  notes?: string
  muscleGroups?: MuscleGroup[]
}

/** Per-day override that swaps the supplemental lift for a different exercise.
 *  The variant's sets/reps/percentage still apply, but to a different exercise + TM. */
export interface SupplementalOverride {
  exercise: ExerciseDef
  trainingMaxLbs: number  // basis for the variant percentage; user-entered, stored in lbs
}

// ============================================================
// Cloud Sync (GitHub Gist)
// ============================================================

export interface CloudSyncConfig {
  enabled: boolean
  token: string          // GitHub classic PAT, gist scope only
  gistId: string | null  // null until first successful sync
  lastSyncAt: string | null  // ISO date of last successful sync
  lastError: string | null   // human-readable error from last attempt
}
