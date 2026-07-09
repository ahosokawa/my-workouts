// ============================================================
// Deload triggers (spec §6.1)
// ============================================================
//
// Two automatic triggers surface a deload suggestion:
//  - time-based: N weeks since the last deload (configurable, default 7)
//  - performance-based: 3 consecutive top-set sessions below the bottom of the
//    rep range on any main lift (top-set programs only — 5/3/1 "misses" are
//    week-relative AMRAP minima already handled by cycle evaluation)

import type { MainLift, SetLog, UserProfile } from '../types'
import { liftDisplayName } from '../types'
import type { ProgramDefinition } from './programs'
import { effectiveDayOrder, topSetRepRange } from './programs'
import { recentMainLiftTopSets } from './progression'

export const DEFAULT_DELOAD_CADENCE_WEEKS = 7

const WEEK_MS = 7 * 24 * 60 * 60 * 1000

export interface DeloadSuggestion {
  reason: 'time' | 'performance'
  message: string
  lift?: MainLift
}

/** Whole weeks since the given ISO date; null when the date is missing/invalid. */
export function weeksSince(iso: string | null | undefined, now: Date): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (Number.isNaN(t)) return null
  const diff = now.getTime() - t
  return diff <= 0 ? 0 : Math.floor(diff / WEEK_MS)
}

/** Weeks since the last completed deload week. Falls back to profile.createdAt
 *  when the user has never deloaded, so the time trigger still fires. */
export function weeksSinceLastDeload(profile: UserProfile, now: Date): number | null {
  return weeksSince(profile.lastDeloadEndedAt ?? profile.createdAt, now)
}

/** First main lift with 3 consecutive top-set sessions below the bottom of its
 *  rep range (newest sessions), or null. */
export function performanceStalledLift(
  setLogs: SetLog[],
  lifts: readonly MainLift[],
  repRangeFor: (lift: MainLift) => { min: number; max: number },
): MainLift | null {
  for (const lift of lifts) {
    const recent = recentMainLiftTopSets(setLogs, lift, 3)
    if (recent.length < 3) continue
    const min = repRangeFor(lift).min
    if (recent.every((l) => (l.actualReps ?? 0) < min)) return lift
  }
  return null
}

/** Main lifts that actually get a top set in this program (skips no-main days). */
export function topSetLifts(def: ProgramDefinition): MainLift[] {
  const order = effectiveDayOrder(def)
  return def.days.flatMap((d, i) => (d.hasMain ? [order[i]] : []))
}

/** The active deload suggestion, if any. Performance beats time. */
export function deloadSuggestion(
  profile: UserProfile,
  setLogs: SetLog[],
  def: ProgramDefinition,
  now: Date,
): DeloadSuggestion | null {
  if (profile.isDeloading) return null

  if (def.engine === 'topSet') {
    const stalled = performanceStalledLift(setLogs, topSetLifts(def), (l) => topSetRepRange(l, def.id))
    if (stalled) {
      return {
        reason: 'performance',
        lift: stalled,
        message: `${liftDisplayName(stalled)} has missed its rep range 3 sessions running — a deload week is recommended.`,
      }
    }
  }

  const weeks = weeksSinceLastDeload(profile, now)
  const cadence = profile.deloadCadenceWeeks ?? DEFAULT_DELOAD_CADENCE_WEEKS
  if (weeks !== null && weeks >= cadence) {
    const since = profile.lastDeloadEndedAt ? 'since your last deload' : 'without a deload'
    return { reason: 'time', message: `${weeks} weeks ${since} — a deload week is recommended.` }
  }
  return null
}
