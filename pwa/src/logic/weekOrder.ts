// ============================================================
// Within-week workout ordering
// ============================================================
//
// A training week has 4 days. The lifts of a week may be done in any order —
// these helpers track which days are finished and decide where the user lands
// next. Weeks themselves still advance 1 → 2 → 3 in sequence (the week only
// rolls over once all 4 of its days are done), so the 5/3/1 intensity
// progression and cycle evaluation are unaffected.

const DAYS_PER_WEEK = 4
const ALL_DAYS: readonly number[] = [1, 2, 3, 4]

/** Days (1–4) not yet completed this week, ascending. */
export function remainingDays(completedDays: readonly number[]): number[] {
  const done = new Set(completedDays)
  return ALL_DAYS.filter((d) => !done.has(d))
}

export interface WeekAdvanceInput {
  /** Day numbers already completed this week, before finishing `finishedDay`. */
  completedDaysThisWeek: readonly number[]
  /** The day (1–4) the user just finished. */
  finishedDay: number
  currentWeek: number
  cycleWeeks: number
}

export interface WeekAdvanceResult {
  completedDaysThisWeek: number[]
  currentDay: number
  currentWeek: number
  isCycleComplete: boolean
}

/** Compute the next position after finishing `finishedDay`.
 *  The week rolls over only once all 4 of its days are done — in any order.
 *  Within a week, the next day defaults to the lowest still-remaining day, so
 *  when the user never reorders this matches the old strictly-linear behavior. */
export function computeWeekAdvance({
  completedDaysThisWeek,
  finishedDay,
  currentWeek,
  cycleWeeks,
}: WeekAdvanceInput): WeekAdvanceResult {
  const done = Array.from(new Set([...completedDaysThisWeek, finishedDay])).sort(
    (a, b) => a - b,
  )

  if (done.length >= DAYS_PER_WEEK) {
    const nextWeek = currentWeek + 1
    return {
      completedDaysThisWeek: [],
      currentDay: 1,
      currentWeek: nextWeek,
      isCycleComplete: nextWeek > cycleWeeks,
    }
  }

  return {
    completedDaysThisWeek: done,
    currentDay: remainingDays(done)[0],
    currentWeek,
    isCycleComplete: false,
  }
}
