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

export function liftFromDay(day: number): MainLift | null {
  if (day >= 1 && day <= 4) return day as MainLift
  return null
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
  currentWeek: number   // 1-3
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
}

// ============================================================
// Accessory Exercise Definition
// ============================================================

export interface AccessoryExercise {
  id: string
  name: string
  sets: number
  reps: number
  weightType: AccessoryWeightType
}
