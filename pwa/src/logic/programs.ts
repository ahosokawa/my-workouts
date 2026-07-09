// ============================================================
// Program definitions — the single place a training program is described.
// ============================================================
//
// Every program-specific fact (label, engine, cycle length, day semantics,
// rep ranges, default accessories, deload strategy) lives in one
// ProgramDefinition here. The rest of the app reads the registry through
// the helpers below instead of switching on ProgramType, so adding a
// program means adding one definition — not editing scattered dispatchers.

import type { AccessoryExercise, MainLift, Units, UserProfile } from '../types'
import {
  MAIN_LIFTS,
  MainLift as ML,
  ProgramType,
  liftDisplayName,
  liftShortName,
  toDisplayWeight,
  toStorageLbs,
} from '../types'
import { roundWeight } from './calculator'
import {
  FIVE_THREE_ONE_ACCESSORIES,
  HYPERTROPHY_ACCESSORIES,
  UPPER_LOWER_ACCESSORIES,
} from './accessories'

// ============================================================
// Types
// ============================================================

/** How a program prescribes its main-lift work: 5/3/1 TM percentages vs a
 *  ramp to an RPE-capped top set. */
export type EngineKind = 'percentage' | 'topSet'

export interface ProgramDayDef {
  /** Fixed display label ("Lower — Squat Focus"). null → derive from the
   *  resolved lift's display name (5/3/1). */
  label: string | null
  /** Short label for day-picker chips. null → resolved lift's short name. */
  chipLabel: string | null
  /** Whether this day prescribes a main-lift block. false only for days whose
   *  focal work lives entirely in the accessory list (Hypertrophy Pull day). */
  hasMain: boolean
}

/** Who decides which lift lands on which day.
 *  'user': profile.dayOrder is editable (5/3/1).
 *  'fixed': the program dictates the order; profile.dayOrder is written on
 *  seed so direct readers (deload, getCurrentLift) follow the program. */
export type DayOrderPolicy =
  | { kind: 'user'; default: readonly MainLift[] }
  | { kind: 'fixed'; order: readonly MainLift[] }

export interface ProgramDeloadPlan {
  /** Main-lift prescription during a deload week. */
  deload: 'percent531' | 'topSet60x3x3'
  /** Prescription for a TM-test week. */
  tmTest: 'workUpToTM' | 'rpeRetest'
  /** Multiplier applied to accessory set counts during deload/TM-test weeks.
   *  0 = no accessories (5/3/1), 0.5 = spec §6.2 halved volume. */
  accessoryVolumeFactor: number
}

export interface ProgramDefinition {
  id: ProgramType
  label: string
  /** Compact name for tight UI (settings chips). */
  shortLabel: string
  description: string
  engine: EngineKind
  cycleWeeks: number
  /** TM% the program locks the profile to; null = user-selectable (5/3/1). */
  lockedTmPercentage: 85 | null
  /** Fraction of TM used to seed top sets (topSet engine only). */
  topSetSeedOfTM?: number
  dayOrder: DayOrderPolicy
  days: readonly [ProgramDayDef, ProgramDayDef, ProgramDayDef, ProgramDayDef]
  /** Per-lift top-set rep ranges (topSet engine only). */
  topSetRepRanges?: Readonly<Record<MainLift, { min: number; max: number }>>
  defaultAccessories: Record<MainLift, AccessoryExercise[]>
  deloadPlan: ProgramDeloadPlan
  /** 5/3/1 only: FSL/BBB/SSL/BBS variants + Leader/Anchor phases apply. */
  usesVariants: boolean
}

// ============================================================
// Definitions
// ============================================================

const MAIN_DAY = { label: null, chipLabel: null, hasMain: true } as const

/** Top-set rep ranges from the hypertrophy spec §3.1 — also the fallback for
 *  callers that don't pass a program. */
const SPEC_TOP_SET_RANGES: Readonly<Record<MainLift, { min: number; max: number }>> = {
  [ML.Squat]: { min: 5, max: 6 },
  [ML.BenchPress]: { min: 5, max: 6 },
  [ML.Deadlift]: { min: 3, max: 5 },
  [ML.ShoulderPress]: { min: 6, max: 8 },
}

export const PROGRAMS: Record<ProgramType, ProgramDefinition> = {
  [ProgramType.FiveThreeOne]: {
    id: ProgramType.FiveThreeOne,
    label: '5/3/1',
    shortLabel: '5/3/1',
    description: 'Top-set AMRAP percentages over 3-week cycles',
    engine: 'percentage',
    cycleWeeks: 3,
    lockedTmPercentage: null,
    dayOrder: { kind: 'user', default: MAIN_LIFTS },
    days: [MAIN_DAY, MAIN_DAY, MAIN_DAY, MAIN_DAY],
    defaultAccessories: FIVE_THREE_ONE_ACCESSORIES,
    deloadPlan: { deload: 'percent531', tmTest: 'workUpToTM', accessoryVolumeFactor: 0 },
    usesVariants: true,
  },
  [ProgramType.Hypertrophy]: {
    id: ProgramType.Hypertrophy,
    label: 'Hypertrophy',
    shortLabel: 'Hypertrophy',
    description: 'RPE-8 top sets + double progression, 7-week cycles',
    engine: 'topSet',
    cycleWeeks: 7,
    lockedTmPercentage: 85,
    topSetSeedOfTM: 0.85,
    dayOrder: { kind: 'fixed', order: MAIN_LIFTS },
    days: [
      { label: 'Lower — Squat Focus', chipLabel: 'Squat', hasMain: true },
      { label: 'Upper — Push Focus', chipLabel: 'Push', hasMain: true },
      { label: 'Lower — Hinge Focus', chipLabel: 'Hinge', hasMain: true },
      // Pull day: pull-ups are the focal exercise and live in the accessory list.
      { label: 'Upper — Pull Focus', chipLabel: 'Pull', hasMain: false },
    ],
    topSetRepRanges: SPEC_TOP_SET_RANGES,
    defaultAccessories: HYPERTROPHY_ACCESSORIES,
    deloadPlan: { deload: 'topSet60x3x3', tmTest: 'rpeRetest', accessoryVolumeFactor: 0.5 },
    usesVariants: false,
  },
  [ProgramType.UpperLower]: {
    id: ProgramType.UpperLower,
    label: '4-Day Upper/Lower',
    shortLabel: 'Upper/Lower',
    description: 'Upper/Lower split, top sets on all 4 days, 7-week cycles',
    engine: 'topSet',
    cycleWeeks: 7,
    lockedTmPercentage: 85,
    topSetSeedOfTM: 0.85,
    // Upper A → Lower A → Upper B → Lower B
    dayOrder: { kind: 'fixed', order: [ML.BenchPress, ML.Squat, ML.ShoulderPress, ML.Deadlift] },
    days: [
      { label: 'Upper A — Chest/Horizontal', chipLabel: null, hasMain: true },
      { label: 'Lower A — Squat', chipLabel: null, hasMain: true },
      { label: 'Upper B — Back/Vertical', chipLabel: null, hasMain: true },
      { label: 'Lower B — Hinge', chipLabel: null, hasMain: true },
    ],
    topSetRepRanges: { ...SPEC_TOP_SET_RANGES, [ML.ShoulderPress]: { min: 5, max: 8 } },
    defaultAccessories: UPPER_LOWER_ACCESSORIES,
    deloadPlan: { deload: 'topSet60x3x3', tmTest: 'rpeRetest', accessoryVolumeFactor: 0.5 },
    usesVariants: false,
  },
}

/** Look up a program definition; unknown/missing types fall back to 5/3/1
 *  (matching the pre-registry `?? ProgramType.FiveThreeOne` convention). */
export function getProgram(programType: ProgramType | null | undefined): ProgramDefinition {
  return PROGRAMS[programType ?? ProgramType.FiveThreeOne] ?? PROGRAMS[ProgramType.FiveThreeOne]
}

// ============================================================
// Derived helpers
// ============================================================

/** The day→lift order in effect: fixed programs dictate it; 5/3/1 uses the
 *  user's saved order (or the default). */
export function effectiveDayOrder(
  def: ProgramDefinition,
  userDayOrder?: readonly MainLift[],
): readonly MainLift[] {
  return def.dayOrder.kind === 'fixed' ? def.dayOrder.order : (userDayOrder ?? def.dayOrder.default)
}

/** The MainLift slot a day keys into (accessories, TMs) — defined for every
 *  day, including days without a main-lift block. */
export function slotForDay(
  def: ProgramDefinition,
  day: number,
  userDayOrder?: readonly MainLift[],
): MainLift | null {
  const order = effectiveDayOrder(def, userDayOrder)
  return day >= 1 && day <= order.length ? order[day - 1] : null
}

/** The day's main lift, or null when the day has no main-lift block. */
export function programMainLiftForDay(
  def: ProgramDefinition,
  day: number,
  userDayOrder?: readonly MainLift[],
): MainLift | null {
  if (!def.days[day - 1]?.hasMain) return null
  return slotForDay(def, day, userDayOrder)
}

export function programDayLabel(
  def: ProgramDefinition,
  day: number,
  userDayOrder?: readonly MainLift[],
): string {
  const fixed = def.days[day - 1]?.label
  if (fixed) return fixed
  const lift = slotForDay(def, day, userDayOrder)
  return lift ? liftDisplayName(lift) : `Day ${day}`
}

/** Short label for a next-workout picker chip. */
export function programDayChipLabel(
  def: ProgramDefinition,
  day: number,
  userDayOrder?: readonly MainLift[],
): string {
  const fixed = def.days[day - 1]?.chipLabel
  if (fixed) return fixed
  const lift = programMainLiftForDay(def, day, userDayOrder)
  return lift ? liftShortName(lift) : `Day ${day}`
}

/** Program-aware default accessories for a MainLift slot. */
export function getProgramAccessories(programType: ProgramType, lift: MainLift): AccessoryExercise[] {
  return getProgram(programType).defaultAccessories[lift]
}

// ============================================================
// ProgramType-keyed wrappers (stable signatures for existing call sites)
// ============================================================

/** True when a program uses the ramp-to-top-set engine (warmup ramp → AMRAP
 *  top set + double-progression accessories + RPE autoprogression). */
export function usesTopSetEngine(programType: ProgramType): boolean {
  return getProgram(programType).engine === 'topSet'
}

/** Short program name for UI headers/selectors. */
export function programLabel(programType: ProgramType): string {
  return getProgram(programType).label
}

/** One-line program description for the selector cards. */
export function programDescription(programType: ProgramType): string {
  return getProgram(programType).description
}

/** Top-set rep range for a main lift. Callers without a program get the
 *  spec's base ranges. */
export function topSetRepRange(
  lift: MainLift,
  programType?: ProgramType,
): { min: number; max: number } {
  if (programType) {
    const def = getProgram(programType)
    const range = def.topSetRepRanges?.[lift]
    if (range) return range
  }
  return SPEC_TOP_SET_RANGES[lift]
}

/** True when the program/day combination prescribes a main-lift block. */
export function dayHasTopSetMain(programType: ProgramType, day: number): boolean {
  return getProgram(programType).days[day - 1]?.hasMain ?? false
}

/** Program-aware version of `liftFromDay`. Returns null when the day has no
 *  main-lift block. `dayOrder` applies only to programs with user-ordered days. */
export function mainLiftForDay(
  programType: ProgramType,
  day: number,
  dayOrder?: readonly MainLift[],
): MainLift | null {
  return programMainLiftForDay(getProgram(programType), day, dayOrder)
}

/** Program-aware day label. */
export function dayLabel(programType: ProgramType, day: number): string {
  return programDayLabel(getProgram(programType), day)
}

// ============================================================
// Seeding — shared by createProfile, switchProgram, and TM retest reseeds
// ============================================================

export interface ProgramSeed {
  tmPercentage: 85 | 90
  cycleWeeks: number
  dayOrder: MainLift[]
  squatTM: number
  benchTM: number
  deadliftTM: number
  pressTM: number
  hypertrophyTopSets?: Partial<Record<MainLift, number>>
}

/** Everything a profile needs (re)computed when it adopts a program:
 *  TM%, TMs from the stored 1RMs, cycle length, day order, and seeded top
 *  sets for every day with a main-lift block. All weights in/out are lbs;
 *  rounding happens in the user's display units. */
export function seedProgram(
  def: ProgramDefinition,
  oneRepMaxesLbs: Record<MainLift, number>,
  units: Units,
  opts: { currentTmPercentage?: 85 | 90; currentDayOrder?: readonly MainLift[] } = {},
): ProgramSeed {
  const tmPercentage: 85 | 90 = def.lockedTmPercentage ?? opts.currentTmPercentage ?? 90
  const pct = tmPercentage / 100
  const computeTM = (rmLbs: number) =>
    toStorageLbs(roundWeight(toDisplayWeight(rmLbs, units) * pct, units), units)

  const tms: Record<MainLift, number> = {
    [ML.Squat]: computeTM(oneRepMaxesLbs[ML.Squat]),
    [ML.BenchPress]: computeTM(oneRepMaxesLbs[ML.BenchPress]),
    [ML.Deadlift]: computeTM(oneRepMaxesLbs[ML.Deadlift]),
    [ML.ShoulderPress]: computeTM(oneRepMaxesLbs[ML.ShoulderPress]),
  }

  // Fixed-order programs write their order to the profile so direct
  // profile.dayOrder readers follow the program; 5/3/1 keeps the user's.
  const dayOrder = [...effectiveDayOrder(def, opts.currentDayOrder)]

  let hypertrophyTopSets: Partial<Record<MainLift, number>> | undefined
  if (def.engine === 'topSet') {
    const seedFactor = def.topSetSeedOfTM ?? 0.85
    const seedTop = (tmLbs: number) =>
      toStorageLbs(roundWeight(toDisplayWeight(tmLbs, units) * seedFactor, units), units)
    hypertrophyTopSets = {}
    def.days.forEach((d, i) => {
      if (!d.hasMain) return
      const lift = dayOrder[i]
      hypertrophyTopSets![lift] = seedTop(tms[lift])
    })
  }

  return {
    tmPercentage,
    cycleWeeks: def.cycleWeeks,
    dayOrder,
    squatTM: tms[ML.Squat],
    benchTM: tms[ML.BenchPress],
    deadliftTM: tms[ML.Deadlift],
    pressTM: tms[ML.ShoulderPress],
    hypertrophyTopSets,
  }
}

/** The four stored 1RMs as a MainLift-keyed record. */
export function oneRepMaxes(profile: UserProfile): Record<MainLift, number> {
  return {
    [ML.Squat]: profile.squatOneRepMax,
    [ML.BenchPress]: profile.benchOneRepMax,
    [ML.Deadlift]: profile.deadliftOneRepMax,
    [ML.ShoulderPress]: profile.pressOneRepMax,
  }
}
