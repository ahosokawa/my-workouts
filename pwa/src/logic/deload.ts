// ============================================================
// Deload prescriptions — a program-definition strategy
// ============================================================
//
// What a deload (or TM-test) day looks like is program data: 5/3/1 keeps its
// percentage scheme from calculator.ts; top-set programs use the spec §6.2
// template (main lifts 60% of TM × 3×3, accessory volume halved).

import type { AccessoryExercise, DeloadType, MainLift, PrescribedSet } from '../types'
import { DeloadType as DT } from '../types'
import { deloadSets as percent531DeloadSets, roundWeight } from './calculator'
import type { ProgramDefinition } from './programs'
import { programMainLiftForDay, topSetRepRange } from './programs'
import { tmRetestSets } from './tmRetest'

export interface DeloadDayPlan {
  /** Main lift for the day, or null when the day has no main-lift block
   *  (hypertrophy Pull day — accessories only, even during deload). */
  lift: MainLift | null
  mainSets: PrescribedSet[]
  /** Volume-scaled accessory list; [] when the program drops accessories. */
  accessories: AccessoryExercise[]
  /** True when this day works up to an RPE-based retest top set (topSet
   *  programs' TM-test week) — the view adds weight/reps/RIR capture. */
  isRetestDay: boolean
}

/** Spec §6.2: deload main work = 3 sets × 3 reps at 60% of TM. */
export function topSetDeloadSets(tmLbs: number): PrescribedSet[] {
  const weight = roundWeight(tmLbs * 0.6)
  return [1, 2, 3].map((n) => ({
    id: `dl-set-${n}`,
    setNumber: n,
    percentage: 0.6,
    targetReps: 3,
    isWarmup: false,
    isAMRAP: false,
    isSupplemental: false,
    weight,
  }))
}

/** Spec §6.2: accessory volume cut for deload weeks. 0.5 halves set counts
 *  (rounded up, min 1 set); 0 drops accessories entirely (5/3/1's deload). */
export function scaleAccessoryVolume(list: AccessoryExercise[], factor: number): AccessoryExercise[] {
  if (factor <= 0) return []
  if (factor >= 1) return list.map((ex) => ({ ...ex }))
  return list.map((ex) => ({ ...ex, sets: Math.max(1, Math.ceil(ex.sets * factor)) }))
}

/** The full prescription for one deload/TM-test day, driven by the program's
 *  deloadPlan. `accessories` is the day's normal (custom or default) list —
 *  scaling happens here. */
export function deloadDayPlan(
  def: ProgramDefinition,
  deloadType: DeloadType,
  day: number,
  ctx: {
    tmLbs: number
    dayOrder?: readonly MainLift[]
    accessories: AccessoryExercise[]
  },
): DeloadDayPlan {
  const lift = programMainLiftForDay(def, day, ctx.dayOrder)
  const accessories = scaleAccessoryVolume(ctx.accessories, def.deloadPlan.accessoryVolumeFactor)

  if (!lift) {
    return { lift: null, mainSets: [], accessories, isRetestDay: false }
  }

  if (deloadType === DT.TMTest && def.deloadPlan.tmTest === 'rpeRetest') {
    return {
      lift,
      mainSets: tmRetestSets(ctx.tmLbs, topSetRepRange(lift, def.id)),
      accessories,
      isRetestDay: true,
    }
  }

  if (deloadType === DT.Deload && def.deloadPlan.deload === 'topSet60x3x3') {
    return { lift, mainSets: topSetDeloadSets(ctx.tmLbs), accessories, isRetestDay: false }
  }

  // percentage engine — unchanged 5/3/1 prescriptions for both deload types
  return { lift, mainSets: percent531DeloadSets(ctx.tmLbs, deloadType), accessories, isRetestDay: false }
}
