import { MainLift, AccessoryWeightType, ProgressionType, ProgramType } from '../types'
import type { AccessoryExercise, ProgramType as ProgramTypeT } from '../types'

// ============================================================
// Accessory Definitions
// ============================================================

/** Day 1: Squat accessories */
const SQUAT_ACCESSORIES: AccessoryExercise[] = [
  { id: 'rdl', name: 'Romanian Deadlift', sets: 3, reps: 8, weightType: AccessoryWeightType.Barbell },
  { id: 'calf', name: 'DB Standing Calf Raise', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'wheel', name: 'Wheel Rollout', sets: 3, reps: 10, weightType: AccessoryWeightType.NoWeight },
]

/** Day 2: Bench Press accessories */
const BENCH_ACCESSORIES: AccessoryExercise[] = [
  { id: 'incline', name: 'Incline DB Bench Press', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'lateral', name: 'DB Lateral Raise', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'tricep', name: 'Standing Tricep Extension', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'extrot', name: 'Lying Shoulder External Rotation', sets: 3, reps: 10, weightType: AccessoryWeightType.Standard },
]

/** Day 3: Deadlift accessories */
const DEADLIFT_ACCESSORIES: AccessoryExercise[] = [
  { id: 'hammer', name: 'DB Hammer Curl', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'bicep', name: 'DB Bicep Curl', sets: 3, reps: 12, weightType: AccessoryWeightType.Standard },
  { id: 'facepull', name: 'Band Face Pull', sets: 3, reps: 12, weightType: AccessoryWeightType.NoWeight },
]

/** Day 4: Overhead Press accessories */
const SHOULDER_PRESS_ACCESSORIES: AccessoryExercise[] = [
  { id: 'pullup', name: 'Pull Up', sets: 3, reps: 8, weightType: AccessoryWeightType.Bodyweight },
  { id: 'row', name: 'DB Bent Over Row', sets: 3, reps: 8, weightType: AccessoryWeightType.Standard },
]

/** Get accessories for a given main lift / day */
export function getAccessories(lift: MainLift): AccessoryExercise[] {
  switch (lift) {
    case MainLift.Squat: return SQUAT_ACCESSORIES
    case MainLift.BenchPress: return BENCH_ACCESSORIES
    case MainLift.Deadlift: return DEADLIFT_ACCESSORIES
    case MainLift.ShoulderPress: return SHOULDER_PRESS_ACCESSORIES
  }
}

// ============================================================
// Hypertrophy default accessories (4-day lifting program — cardio days not tracked)
// Mapping (see plan): MainLift slot ↔ spec day
//   Squat        → Mon (Lower Squat Focus)
//   BenchPress   → Tue (Upper Push Focus, OHP appears here as a barbell accessory)
//   Deadlift     → Thu (Lower Hinge Focus)
//   ShoulderPress→ Fri (Upper Pull Focus — no top-set main lift; pull-ups are focal)
// ============================================================

const HYPERTROPHY_SQUAT_DAY: AccessoryExercise[] = [
  { id: 'h-front-sq', name: 'Front Squat', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 12, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Quad-focused. Full depth, upright torso, elbows up.' },
  { id: 'h-bss', name: 'Bulgarian Split Squat', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Each leg. Back knee close to floor. Start light.' },
  { id: 'h-sl-rdl', name: 'Single-Leg DB RDL', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Slow and controlled. Balance and hamstring stretch.' },
  { id: 'h-std-calf', name: 'Standing Calf Raise', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 12, repRangeMin: 10, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Pause at top, slow eccentric. Gastroc focus.' },
  { id: 'h-ab-wheel', name: 'Ab Wheel Rollout', weightType: AccessoryWeightType.NoWeight,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 12,
    progressionType: ProgressionType.RomStages,
    notes: 'Knees on pad. Progress ROM before load.' },
]

const HYPERTROPHY_BENCH_DAY: AccessoryExercise[] = [
  // Overhead Press appears here as a heavy barbell accessory per spec §4.2 — feeds OHP e1RM tracking.
  { id: 'h-ohp', name: 'Overhead Press', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 7, repRangeMin: 6, repRangeMax: 8,
    progressionType: ProgressionType.Double,
    notes: 'Strict standing press. No leg drive.' },
  { id: 'h-incline-db', name: 'Incline DB Bench Press', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Bench at 30-45°.' },
  { id: 'h-dips', name: 'Dips', weightType: AccessoryWeightType.Bodyweight,
    sets: 3, reps: 8, repRangeMin: 6, repRangeMax: 12,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Forward lean = chest, upright = triceps. Add weight when 12 BW reps is easy.' },
  { id: 'h-lat-raise', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Slight forward lean, lead with elbows.' },
  { id: 'h-ext-rot', name: 'Lying Shoulder External Rotation', weightType: AccessoryWeightType.Standard,
    sets: 2, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.RepsOnly,
    notes: 'Side-lying, elbow pinned to ribs. Shoulder health.' },
]

const HYPERTROPHY_DEADLIFT_DAY: AccessoryExercise[] = [
  { id: 'h-rdl', name: 'Romanian Deadlift', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: "Hinge at hips, slight knee bend. Don't round back." },
  { id: 'h-front-dl', name: 'Front Squat', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Quad work without taxing the lower back further.' },
  { id: 'h-hlr', name: 'Hanging Leg Raise', weightType: AccessoryWeightType.Bodyweight,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 12,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Bend knees if straight legs are too hard. No swinging.' },
  { id: 'h-seated-calf', name: 'Seated DB Calf Raise', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'DB vertically on quad above knee. Soleus focus.' },
]

const HYPERTROPHY_OHP_DAY: AccessoryExercise[] = [
  // Friday — Upper Pull Focus. No top-set RPE main lift; pull-ups are the focal exercise.
  { id: 'h-pullup', name: 'Pull-Ups', weightType: AccessoryWeightType.Bodyweight,
    sets: 4, reps: 7, repRangeMin: 6, repRangeMax: 8,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Strict, full ROM. Add weight via DB between feet when 4×8 BW is easy.' },
  { id: 'h-csr', name: 'Chest-Supported DB Row', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Chest-down on incline bench. Pull elbows toward hips.' },
  { id: 'h-db-row', name: 'DB Bent-Over Row', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Hinge over, neutral spine. Pull to lower ribs.' },
  { id: 'h-hammer', name: 'DB Hammer Curl', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Neutral grip. Brachialis + forearms.' },
  { id: 'h-curl', name: 'DB Bicep Curl', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Supinated. Full ROM, no swinging.' },
  { id: 'h-facepull', name: 'Band Facepull', weightType: AccessoryWeightType.NoWeight,
    sets: 3, reps: 17, repRangeMin: 15, repRangeMax: 20,
    progressionType: ProgressionType.RepsOnly,
    notes: 'Pull to face, elbows high. Rear delts.' },
]

/** Hypertrophy default accessories for a given MainLift slot. */
export function getHypertrophyAccessories(lift: MainLift): AccessoryExercise[] {
  switch (lift) {
    case MainLift.Squat: return HYPERTROPHY_SQUAT_DAY
    case MainLift.BenchPress: return HYPERTROPHY_BENCH_DAY
    case MainLift.Deadlift: return HYPERTROPHY_DEADLIFT_DAY
    case MainLift.ShoulderPress: return HYPERTROPHY_OHP_DAY
  }
}

// ============================================================
// 4-Day Upper/Lower default accessories. Every day has a top-set main lift; the arrays
// below are keyed by the main lift's MainLift slot:
//   BenchPress (2)    → Upper A (Chest/Horizontal) — main lift Bench Press
//   Squat (1)         → Lower A (Squat)            — main lift Back Squat
//   ShoulderPress (4) → Upper B (Back/Vertical)    — main lift Overhead Press
//   Deadlift (3)      → Lower B (Hinge)            — main lift Deadlift
// ============================================================

const UPPER_LOWER_BENCH_DAY: AccessoryExercise[] = [
  { id: 'ul-pullup', name: 'Pull-Ups', weightType: AccessoryWeightType.Bodyweight,
    sets: 4, reps: 7, repRangeMin: 6, repRangeMax: 8,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Strict, full ROM. Add weight via DB between feet when 4×8 BW is easy.' },
  { id: 'ul-incline-db', name: 'Incline DB Bench Press', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Bench at 30-45°.' },
  { id: 'ul-lat-raise-a', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Slight forward lean, lead with elbows.' },
  { id: 'ul-oh-tri', name: 'Overhead DB Triceps Extension', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Elbows tucked, full stretch overhead.' },
  { id: 'ul-curl', name: 'DB Bicep Curl', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Supinated. Full ROM, no swinging.' },
]

const UPPER_LOWER_SQUAT_DAY: AccessoryExercise[] = [
  { id: 'ul-rdl', name: 'Romanian Deadlift', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: "Hinge at hips, slight knee bend. Don't round back." },
  { id: 'ul-bss', name: 'Bulgarian Split Squat', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Each leg. Back knee close to floor. Start light.' },
  { id: 'ul-std-calf', name: 'Standing Calf Raise', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 12, repRangeMin: 10, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Pause at top, slow eccentric. Gastroc focus.' },
  { id: 'ul-lat-raise-l', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Slight forward lean, lead with elbows.' },
  { id: 'ul-ab-wheel', name: 'Ab Wheel Rollout', weightType: AccessoryWeightType.NoWeight,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 12,
    progressionType: ProgressionType.RomStages,
    notes: 'Knees on pad. Progress ROM before load.' },
]

const UPPER_LOWER_OHP_DAY: AccessoryExercise[] = [
  { id: 'ul-csr', name: 'Chest-Supported DB Row', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Chest-down on incline bench. Pull elbows toward hips.' },
  { id: 'ul-dips', name: 'Dips', weightType: AccessoryWeightType.Bodyweight,
    sets: 3, reps: 8, repRangeMin: 6, repRangeMax: 12,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Forward lean = chest, upright = triceps. Add weight when 12 BW reps is easy.' },
  { id: 'ul-lat-raise-b', name: 'DB Lateral Raise', weightType: AccessoryWeightType.Standard,
    sets: 4, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'Slight forward lean, lead with elbows.' },
  { id: 'ul-hammer', name: 'DB Hammer Curl', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Neutral grip. Brachialis + forearms.' },
  { id: 'ul-facepull', name: 'Band Facepull', weightType: AccessoryWeightType.NoWeight,
    sets: 3, reps: 17, repRangeMin: 15, repRangeMax: 20,
    progressionType: ProgressionType.RepsOnly,
    notes: 'Pull to face, elbows high. Rear delts.' },
]

const UPPER_LOWER_DEADLIFT_DAY: AccessoryExercise[] = [
  { id: 'ul-front-sq', name: 'Front Squat', weightType: AccessoryWeightType.Barbell,
    sets: 3, reps: 11, repRangeMin: 10, repRangeMax: 12,
    progressionType: ProgressionType.Double,
    notes: 'Quad work without taxing the lower back further.' },
  { id: 'ul-sl-rdl', name: 'Single-Leg DB RDL', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 9, repRangeMin: 8, repRangeMax: 10,
    progressionType: ProgressionType.Double,
    notes: 'Slow and controlled. Balance and hamstring stretch.' },
  { id: 'ul-seated-calf', name: 'Seated DB Calf Raise', weightType: AccessoryWeightType.Standard,
    sets: 3, reps: 13, repRangeMin: 12, repRangeMax: 15,
    progressionType: ProgressionType.Double,
    notes: 'DB vertically on quad above knee. Soleus focus.' },
  { id: 'ul-hlr', name: 'Hanging Leg Raise', weightType: AccessoryWeightType.Bodyweight,
    sets: 3, reps: 10, repRangeMin: 8, repRangeMax: 12,
    progressionType: ProgressionType.RepsThenLoad,
    notes: 'Bend knees if straight legs are too hard. No swinging.' },
]

/** 4-Day Upper/Lower default accessories for a given MainLift slot. */
export function getUpperLowerAccessories(lift: MainLift): AccessoryExercise[] {
  switch (lift) {
    case MainLift.Squat: return UPPER_LOWER_SQUAT_DAY
    case MainLift.BenchPress: return UPPER_LOWER_BENCH_DAY
    case MainLift.Deadlift: return UPPER_LOWER_DEADLIFT_DAY
    case MainLift.ShoulderPress: return UPPER_LOWER_OHP_DAY
  }
}

/** Program-aware default accessories for a MainLift slot. */
export function getProgramAccessories(programType: ProgramTypeT, lift: MainLift): AccessoryExercise[] {
  switch (programType) {
    case ProgramType.Hypertrophy: return getHypertrophyAccessories(lift)
    case ProgramType.UpperLower: return getUpperLowerAccessories(lift)
    default: return getAccessories(lift)
  }
}
