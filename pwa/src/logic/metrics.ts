// ============================================================
// Derived training metrics (spec §7.1)
// ============================================================
//
// Pure functions over sessions/set logs: weekly load-volume per muscle group,
// sessions-per-week consistency, and stalled-lift detection. Weeks are
// Monday-based in local time.

import type { MainLift, MuscleGroup, SetLog, WorkoutSession } from '../types'
import { liftDisplayName } from '../types'
import { estimated1RM } from './brzycki'
import { resolveMuscleGroups } from './muscleGroups'

const DAY_MS = 24 * 60 * 60 * 1000
const WEEK_MS = 7 * DAY_MS

/** Monday 00:00 (local) of the week containing `d`. */
export function weekStart(d: Date): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const mondayOffset = (x.getDay() + 6) % 7 // Mon=0 … Sun=6
  x.setDate(x.getDate() - mondayOffset)
  return x
}

/** YYYY-MM-DD key for the Monday of the week containing `d`. */
export function weekStartKey(d: Date): string {
  const x = weekStart(d)
  const mm = String(x.getMonth() + 1).padStart(2, '0')
  const dd = String(x.getDate()).padStart(2, '0')
  return `${x.getFullYear()}-${mm}-${dd}`
}

export interface WeekVolume {
  weekStart: string // YYYY-MM-DD (Monday)
  volumeByGroup: Partial<Record<MuscleGroup, number>>
}

/** Load-volume (weight × reps, lbs) per muscle group for each of the last
 *  `nWeeks` weeks (oldest → newest, current week last). Completed sets only;
 *  a set counts in full toward every group its exercise works, so per-group
 *  trends are comparable but groups must not be summed. Sets with no logged
 *  weight (bands, bodyweight without an entry) contribute 0. */
export function weeklyVolume(
  setLogs: SetLog[],
  nWeeks: number,
  now: Date,
  tagsByName?: Record<string, MuscleGroup[]>,
): WeekVolume[] {
  const currentMonday = weekStart(now)
  const weeks: WeekVolume[] = []
  const indexByKey = new Map<string, number>()
  for (let i = nWeeks - 1; i >= 0; i--) {
    const monday = new Date(currentMonday.getTime() - i * WEEK_MS)
    const key = weekStartKey(monday)
    indexByKey.set(key, weeks.length)
    weeks.push({ weekStart: key, volumeByGroup: {} })
  }

  const groupCache = new Map<string, MuscleGroup[]>()
  for (const log of setLogs) {
    if (!log.isCompleted || !log.completedAt) continue
    const reps = log.actualReps ?? log.targetReps
    if (log.weight <= 0 || reps <= 0) continue
    const idx = indexByKey.get(weekStartKey(new Date(log.completedAt)))
    if (idx === undefined) continue
    let groups = groupCache.get(log.exerciseName)
    if (!groups) {
      groups = resolveMuscleGroups(log.exerciseName, tagsByName)
      groupCache.set(log.exerciseName, groups)
    }
    const volume = log.weight * reps
    for (const g of groups) {
      weeks[idx].volumeByGroup[g] = (weeks[idx].volumeByGroup[g] ?? 0) + volume
    }
  }
  return weeks
}

/** Sessions completed in each of the last `nWeeks` weeks (oldest → newest). */
export function sessionsPerWeek(
  sessions: WorkoutSession[],
  nWeeks: number,
  now: Date,
): { weekStart: string; count: number }[] {
  const currentMonday = weekStart(now)
  const out: { weekStart: string; count: number }[] = []
  const indexByKey = new Map<string, number>()
  for (let i = nWeeks - 1; i >= 0; i--) {
    const key = weekStartKey(new Date(currentMonday.getTime() - i * WEEK_MS))
    indexByKey.set(key, out.length)
    out.push({ weekStart: key, count: 0 })
  }
  for (const s of sessions) {
    const idx = indexByKey.get(weekStartKey(new Date(s.date)))
    if (idx !== undefined) out[idx].count++
  }
  return out
}

/** Consecutive weeks hitting `targetPerWeek` sessions, counting back from last
 *  week. The in-progress current week extends the streak once it hits the
 *  target but never breaks it. */
export function consistencyStreakWeeks(
  sessions: WorkoutSession[],
  targetPerWeek: number,
  now: Date,
): number {
  const counts = new Map<string, number>()
  for (const s of sessions) {
    const key = weekStartKey(new Date(s.date))
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  const currentMonday = weekStart(now)
  let streak = (counts.get(weekStartKey(currentMonday)) ?? 0) >= targetPerWeek ? 1 : 0
  for (let i = 1; ; i++) {
    const key = weekStartKey(new Date(currentMonday.getTime() - i * WEEK_MS))
    if ((counts.get(key) ?? 0) >= targetPerWeek) streak++
    else break
  }
  return streak
}

/** Main lifts whose best e1RM in the last `windowWeeks` hasn't beaten the best
 *  from before the window (spec §7.1 stalled-lift indicator). Requires top-set
 *  evidence on both sides of the boundary — a lift with no recent sessions, or
 *  no older history, isn't "stalled". */
export function stalledLifts(
  setLogs: SetLog[],
  lifts: readonly MainLift[],
  now: Date,
  windowWeeks = 4,
): MainLift[] {
  const boundary = now.getTime() - windowWeeks * WEEK_MS
  const out: MainLift[] = []
  for (const lift of lifts) {
    const name = liftDisplayName(lift)
    let bestRecent = 0
    let bestOlder = 0
    for (const l of setLogs) {
      if (l.exerciseName !== name || !l.isMainLift || !l.isAMRAP || !l.isCompleted) continue
      if (l.actualReps == null || !l.completedAt) continue
      const e = estimated1RM(l.weight, l.actualReps)
      if (e === null) continue
      if (new Date(l.completedAt).getTime() >= boundary) {
        if (e > bestRecent) bestRecent = e
      } else if (e > bestOlder) {
        bestOlder = e
      }
    }
    if (bestRecent > 0 && bestOlder > 0 && bestRecent <= bestOlder) out.push(lift)
  }
  return out
}
