// ============================================================
// Main Lift enum
// ============================================================

export enum MainLift {
  Squat = 1,
  BenchPress = 2,
  Deadlift = 3,
  ShoulderPress = 4,
}

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
    case MainLift.ShoulderPress: return 'Shoulder Press'
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

export function liftProgressionAmount(lift: MainLift): number {
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
// Accessory Weight Type
// ============================================================

export enum AccessoryWeightType {
  Standard = 'standard',
  Bodyweight = 'bodyweight',
  NoWeight = 'noWeight',
}

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
