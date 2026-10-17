import { FIVE_THREE_ONE_ACCESSORIES, UPPER_LOWER_ACCESSORIES } from './accessories'
import { roundWeight } from './calculator'
import { barbellWeight } from './plates'
import { AccessoryWeightType as W, MainLift as M, ProgressionType as P } from '../types'
import { toStorageLbs, liftDisplayName, trainingMaxFor, toDisplayWeight } from '../types'
import type { Units, AccessoryExercise, SetLog, WorkoutSession } from '../types'

// Reuse existing movement identities where available; primary lifts now use the
// same ordered, editable working-set rows as other movements (not AMRAPs).
function exercise(id: string, name: string, sets: number, min: number, max: number,
  weightType: W, notes: string, extra: Partial<AccessoryExercise> = {}): AccessoryExercise {
  return { id, name, sets, reps: min, repRangeMin: min, repRangeMax: max,
    weightType, progressionType: weightType === W.NoWeight ? P.RomStages : P.Double,
    incrementLbs: 5, notes, ...extra }
}
// Reuse catalog identities and band/reps-only tracking, changing only this
// preset's prescriptions (never mutate another program's exercise objects).
const BAND_PUSHDOWN: AccessoryExercise = {
  ...UPPER_LOWER_ACCESSORIES[M.ShoulderPress].find(e => e.id === 'ul-band-pushdown')!,
  reps: 12, repRangeMax: 20,
}
const OPTIONAL_FACE_PULL: AccessoryExercise = {
  ...FIVE_THREE_ONE_ACCESSORIES[M.Deadlift].find(e => e.id === 'facepull')!,
  sets: 2, reps: 15, repRangeMin: 15, repRangeMax: 20,
  progressionType: P.RepsOnly, optional: true,
  notes: 'Optional. Pull to face, elbows high; controlled reps. Rest 60–90 sec.',
}

export const CHEST_ARMS_ACCESSORIES: Record<M, AccessoryExercise[]> = {
  [M.BenchPress]: [
    exercise('ca-bench', 'Bench Press', 3, 6, 8, W.Barbell, 'Rest 2–3 min.', { warmup: true }),
    exercise('ul-pullup', 'Pull-Ups', 3, 6, 10, W.Bodyweight, 'Bodyweight initially; optional belt load. Rest 2 min.'),
    exercise('ul-incline-db', 'Incline DB Bench Press', 3, 8, 12, W.Standard, 'Rest 90–120 sec. Weight per dumbbell; max 52.5 lb.'),
    exercise('ul-oa-row', 'One-Arm DB Row', 2, 8, 12, W.Standard, 'Reps per arm; weight per dumbbell. Rest 60–90 sec.'),
    exercise('ca-ez-curl', 'EZ-Bar Curl', 3, 10, 15, W.Standard, 'Total EZ-bar load. Rest 60–90 sec. Use the smallest available increment.', { incrementLbs: 2.5 }),
    exercise('ul-oh-tri', 'Overhead DB Triceps Extension', 3, 10, 15, W.Standard, 'Rest 60–90 sec.'),
  ],
  [M.Squat]: [
    exercise('ca-squat', 'Squat', 3, 5, 8, W.Barbell, 'Keep 2–3 RIR; avoid failure. Rest 2–3 min.', { warmup: true }),
    exercise('ul-rdl', 'Romanian Deadlift', 3, 8, 10, W.Barbell, 'Rest 90–120 sec.'),
    exercise('ul-bss', 'Bulgarian Split Squat', 2, 8, 12, W.Standard, 'Reps per leg; weight per dumbbell. Rest 60–90 sec.'),
    exercise('ul-std-calf', 'Standing Calf Raise', 3, 12, 20, W.Standard, 'Pause at top; controlled eccentric.'),
    exercise('ul-ab-wheel', 'Ab Wheel Rollout', 3, 6, 12, W.NoWeight, 'Controlled reps; progress range of motion before load.'),
  ],
  [M.ShoulderPress]: [
    exercise('ul-dips', 'Dips', 3, 6, 10, W.Bodyweight, 'Chest bias if comfortable. Rest 2 min.'),
    exercise('ul-csr', 'Chest-Supported DB Row', 3, 8, 12, W.Standard, 'Rest 90–120 sec. Weight per dumbbell.'),
    exercise('ul-incline-db', 'Incline DB Bench Press', 2, 10, 15, W.Standard, 'Or substitute Flat DB Bench Press in Settings. Weight per dumbbell.'),
    exercise('ul-lat-raise-b', 'DB Lateral Raise', 3, 12, 20, W.Standard, 'Rest 60–90 sec.', { incrementLbs: 2.5 }),
    exercise('ul-hammer', 'DB Hammer Curl', 3, 10, 15, W.Standard, 'Rest 60–90 sec.', { incrementLbs: 2.5 }),
    BAND_PUSHDOWN,
    OPTIONAL_FACE_PULL,
    exercise('h-ohp', 'Overhead Press', 2, 6, 10, W.Barbell, 'Optional; skip to fit the hour. Rest 2 min.', { optional: true, warmup: true }),
  ],
  [M.Deadlift]: [
    exercise('ca-deadlift', 'Deadlift', 2, 4, 6, W.Barbell, 'Conventional. Keep 2–3 RIR; avoid failure. Rest 2–3 min.', { warmup: true }),
    exercise('ul-front-sq', 'Front Squat', 3, 6, 10, W.Barbell, 'Rest 90–120 sec.'),
    exercise('ul-sl-rdl', 'Single-Leg DB RDL', 2, 8, 12, W.Standard, 'Reps per leg; weight per dumbbell. Rest 60–90 sec.'),
    exercise('ul-seated-calf', 'Seated DB Calf Raise', 3, 12, 20, W.Standard, 'Dumbbell on quad above knee.'),
    exercise('ul-hlr', 'Hanging Leg Raise', 3, 8, 15, W.Bodyweight, 'Controlled, minimal swing.', { progressionType: P.RepsOnly }),
  ],
}

/** Strictly scoped to this program, day, identity AND prescription. Never infer
 * success from only the completed subset or from a different variant/range. */
export function workingSetGuidance(ex: AccessoryExercise, day: number,
  sessions: WorkoutSession[], logs: SetLog[]) {
  const session = sessions.filter(s => s.programType === 'upper_lower_chest_arms' &&
    s.programDay === day && s.prescription?.some(e => e.id === ex.id && e.name === ex.name &&
      e.weightType === ex.weightType && e.sets === ex.sets && e.repRangeMin === ex.repRangeMin && e.repRangeMax === ex.repRangeMax))
    .sort((a,b) => b.date.localeCompare(a.date))[0]
  const sets = session ? logs.filter(l => l.sessionId === session.id && l.exerciseId === ex.id &&
    l.exerciseName === ex.name && !l.isWarmup) : []
  const weight = sets.find(l => l.isCompleted)?.weight ?? sets[0]?.weight ?? 0
  const eligible = !!session?.workingSetsCompleted && sets.length === ex.sets &&
    sets.every((l, i) => l.setIndex === i && l.isCompleted && l.weight === weight &&
      l.weightType === ex.weightType && l.actualReps != null && Number.isInteger(l.actualReps) &&
      l.actualReps >= (ex.repRangeMax ?? ex.reps) && l.rir != null && l.rir >= 1)
  const increment = ex.incrementLbs != null && Number.isFinite(ex.incrementLbs) && ex.incrementLbs > 0 ? ex.incrementLbs : 5
  const canAdd = eligible && (ex.progressionType === P.Double || ex.progressionType === P.RepsThenLoad) && ex.weightType !== W.NoWeight
  return { weight, suggestedWeight: canAdd ? weight + increment : weight, canAdd }
}

/** Keep fractional kg loads/increments in the new program without changing legacy display rounding. */
export function workingWeightDisplay(lbs: number, units: Units): number {
  return Math.round(toDisplayWeight(lbs, units) * 100) / 100
}

/** Starting suggestions only: never treat a historical top set as repeatable
 * straight-set work, and never borrow loads from differently named variants. */
export function startingWorkingWeight(ex: AccessoryExercise, logs: SetLog[],
  profile: import('../types').UserProfile): { weight: number; source: string } {
  if (ex.weightType === W.NoWeight) return { weight: 0, source: '' }
  const recent = logs.filter(l => l.exerciseName === ex.name && l.isCompleted && !l.isWarmup &&
    Number.isFinite(l.weight) && l.weight > 0 && (l.weightType == null || l.weightType === ex.weightType) &&
    (!l.isMainLift || l.isAMRAP) && (l.actualReps ?? l.targetReps) > 0)
    .sort((a,b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  const latest = recent[0]
  const units = profile.units ?? 'lbs'
  const roundDown = (lbs: number) => {
    const step = units === 'kg' ? 1 : 2.5
    return toStorageLbs(Math.floor(toDisplayWeight(lbs, units) / step) * step, units)
  }
  if (ex.weightType === W.Bodyweight) {
    return {weight: Math.max(profile.bodyWeightLbs ?? 0, latest?.weight ?? 0), source: 'Bodyweight / recent total load; edit added weight as needed.'}
  }
  if (latest) {
    if (latest.isMainLift) return {weight: roundDown(latest.weight * 0.9), source: 'Starting suggestion: 90% of your recent top-set load. Adjust for repeated working sets.'}
    const sameSession = recent.filter(l => l.sessionId === latest.sessionId)
    return {weight: Math.min(...sameSession.map(l => l.weight)), source: 'Starting suggestion from your recent logged working sets. Adjust for this rep range.'}
  }
  const lift = ([M.Squat,M.BenchPress,M.Deadlift,M.ShoulderPress] as const).find(l => liftDisplayName(l) === ex.name)
  if (lift) return {weight: roundDown(trainingMaxFor(profile,lift) * 0.75), source: 'Starting estimate: 75% of training max; adjust to leave 2–3 reps in reserve.'}
  return {weight: 0, source: 'No matching load history. Enter a starting weight.'}
}

export function workingWarmupWeight(workingDisplay: number, fraction: number, units: Units) {
  return Math.max(barbellWeight(units), roundWeight(workingDisplay * fraction, units))
}

/** Upgrade only saved hypertrophy plans still containing the previous default
 * movement. The removed identity is the revision sentinel, so later user edits
 * (including removing optional face pulls) survive reload without a new flag.
 * Session snapshots/logs are never passed here or rewritten. */
export function upgradeHypertrophyUpperB(plan: Record<number, AccessoryExercise[]>): Record<number, AccessoryExercise[]> {
  const upperB = plan[M.ShoulderPress]
  if (!upperB?.some(e => e.id === 'ca-ez-triceps' && e.name === 'Lying EZ-Bar Triceps Extension')) return plan
  const hasPushdown = upperB.some(e => e.name === BAND_PUSHDOWN.name)
  const hasFacePull = upperB.some(e => e.name.toLowerCase().replace(/[ -]/g, '') === 'bandfacepull')
  const revised = upperB.flatMap(e => e.id === 'ca-ez-triceps' && e.name === 'Lying EZ-Bar Triceps Extension'
    ? [...(hasPushdown ? [] : [{...BAND_PUSHDOWN}]), ...(hasFacePull ? [] : [{...OPTIONAL_FACE_PULL}])]
    : [e])
  return {...plan, [M.ShoulderPress]: revised}
}
