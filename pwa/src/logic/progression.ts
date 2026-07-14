import type { MainLift, SetLog } from '../types'
import { liftDisplayName } from '../types'

// ============================================================
// Suggestion shapes
// ============================================================

export type TopSetReason = 'add_weight' | 'add_reps' | 'hold' | 'missed_reps' | 'stuck'

export interface TopSetSuggestion {
  weightLbs: number
  repRangeMin: number
  repRangeMax: number
  reason: TopSetReason
  message: string
}

export type AccessoryReason = 'add_weight' | 'add_reps' | 'drop_weight' | 'hold'

export interface AccessorySuggestion {
  weightLbs: number     // suggested working weight (lbs)
  targetReps: number    // suggested target reps (use as default in input)
  reason: AccessoryReason
  message: string
}

// ============================================================
// History helpers — pluck the most recent session's data for an exercise
// ============================================================

/** Returns the most recent completed *session*'s set logs for the given main lift.
 *  A "session" is identified by sessionId; we pick the latest one that contains
 *  the AMRAP (top) set. Returns the top-set log only, or null. */
export function lastMainLiftTopSet(setLogs: SetLog[], lift: MainLift): SetLog | null {
  const name = liftDisplayName(lift)
  let best: SetLog | null = null
  for (const l of setLogs) {
    if (l.exerciseName !== name) continue
    if (!l.isMainLift) continue
    if (!l.isAMRAP) continue
    if (!l.isCompleted) continue
    if (l.actualReps == null) continue
    if (!best || (l.completedAt ?? '') > (best.completedAt ?? '')) best = l
  }
  return best
}

/** Returns the N most-recent top-set entries (newest first) for stuck-detection. */
export function recentMainLiftTopSets(setLogs: SetLog[], lift: MainLift, n: number): SetLog[] {
  const name = liftDisplayName(lift)
  const filtered = setLogs.filter(
    (l) => l.exerciseName === name && l.isMainLift && l.isAMRAP && l.isCompleted && l.actualReps != null,
  )
  filtered.sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
  return filtered.slice(0, n)
}

/** Returns the most recent session's accessory set logs for a given exercise name.
 *  Groups by sessionId, picks the latest by max completedAt across the group's logs. */
export function lastAccessorySession(
  setLogs: SetLog[],
  exerciseName: string,
): { weightLbs: number; repsPerSet: number[] } | null {
  const matching = setLogs.filter(
    (l) => l.exerciseName === exerciseName && !l.isMainLift && l.isCompleted,
  )
  if (matching.length === 0) return null

  // Group by sessionId, find the most recent session (by max completedAt within group).
  const bySession = new Map<string, SetLog[]>()
  for (const l of matching) {
    const arr = bySession.get(l.sessionId) ?? []
    arr.push(l)
    bySession.set(l.sessionId, arr)
  }
  let bestSessionId: string | null = null
  let bestTime = ''
  for (const [sid, arr] of bySession) {
    const t = arr.reduce((m, l) => (l.completedAt && l.completedAt > m ? l.completedAt : m), '')
    if (t > bestTime) {
      bestTime = t
      bestSessionId = sid
    }
  }
  if (!bestSessionId) return null
  const sessionLogs = (bySession.get(bestSessionId) ?? []).sort((a, b) => a.setIndex - b.setIndex)
  // Weight should be uniform within a session; pick the modal/first non-zero.
  const weightLbs = sessionLogs.find((l) => l.weight > 0)?.weight ?? 0
  const repsPerSet = sessionLogs.map((l) => l.actualReps ?? l.targetReps ?? 0)
  return { weightLbs, repsPerSet }
}

// ============================================================
// §5.1 — top_set_rpe (Main Lifts)
// ============================================================

export function nextTopSetRpe(input: {
  currentTopSetLbs: number
  lastActualReps?: number | null
  lastRir?: number | null
  repRangeMin: number
  repRangeMax: number
  incrementLbs: number
  /** Up to last ~3 top sets at the same weight (newest first), for stuck detection. */
  recentHistory?: { weightLbs: number; actualReps: number }[]
}): TopSetSuggestion {
  const { currentTopSetLbs, lastActualReps, lastRir, repRangeMin, repRangeMax, incrementLbs } = input

  // No history yet — hold at the prescribed weight.
  if (lastActualReps == null) {
    return {
      weightLbs: currentTopSetLbs,
      repRangeMin,
      repRangeMax,
      reason: 'hold',
      message: 'First session at this weight — hit the prescribed range.',
    }
  }

  if (lastActualReps < repRangeMin) {
    const reduced = roundDown(currentTopSetLbs * 0.9, incrementLbs)
    return {
      weightLbs: reduced,
      repRangeMin,
      repRangeMax,
      reason: 'missed_reps',
      message: `Missed range last session. Drop to ${reduced} lbs or take a deload.`,
    }
  }

  // Stuck detection: 3 consecutive sessions at the same weight without rep progress.
  if (input.recentHistory && input.recentHistory.length >= 3) {
    const top3 = input.recentHistory.slice(0, 3)
    const allSameWeight = top3.every((s) => s.weightLbs === currentTopSetLbs)
    const noRepProgress = top3[0].actualReps <= top3[2].actualReps
    if (allSameWeight && noRepProgress) {
      return {
        weightLbs: currentTopSetLbs,
        repRangeMin,
        repRangeMax,
        reason: 'stuck',
        message: 'Stuck at this weight 3 sessions running. Consider a deload or TM reset to 90%.',
      }
    }
  }

  if (lastActualReps >= repRangeMax) {
    // Hit top of range. RIR ≥ 2 (or unlogged) → bump weight. RIR < 2 → hold + clean up form.
    if (lastRir == null || lastRir >= 2) {
      const next = currentTopSetLbs + incrementLbs
      return {
        weightLbs: next,
        repRangeMin,
        repRangeMax,
        reason: 'add_weight',
        message: `Hit top of range cleanly. Bump to ${next} lbs.`,
      }
    }
    return {
      weightLbs: currentTopSetLbs,
      repRangeMin,
      repRangeMax,
      reason: 'hold',
      message: 'Hit the range but it was a grinder. Hold and clean up form.',
    }
  }

  // Within range, not at top — add a rep.
  return {
    weightLbs: currentTopSetLbs,
    repRangeMin,
    repRangeMax,
    reason: 'add_reps',
    message: `Same weight next session — target ${Math.min(lastActualReps + 1, repRangeMax)} reps.`,
  }
}

// ============================================================
// §5.2 — double_progression (Accessories)
// ============================================================

export function nextDoubleProgression(input: {
  lastSession?: { weightLbs: number; repsPerSet: number[] } | null
  repRangeMin: number
  repRangeMax: number
  incrementLbs: number
  /** Floor below which weight never drops (bodyweight for BW exercises). Default 0. */
  minWeightLbs?: number
}): AccessorySuggestion {
  const { lastSession, repRangeMin, repRangeMax, incrementLbs, minWeightLbs = 0 } = input

  if (!lastSession || lastSession.repsPerSet.length === 0) {
    return {
      weightLbs: lastSession?.weightLbs ?? 0,
      targetReps: repRangeMin,
      reason: 'hold',
      message: 'No prior data — start at the bottom of the range.',
    }
  }

  const { weightLbs, repsPerSet } = lastSession
  const allAtMax = repsPerSet.every((r) => r >= repRangeMax)
  const anyBelowMin = repsPerSet.some((r) => r < repRangeMin)

  if (allAtMax) {
    const next = weightLbs + incrementLbs
    return {
      weightLbs: next,
      targetReps: repRangeMin,
      reason: 'add_weight',
      message: `All sets at top of range. Bump to ${next} lbs and reset to ${repRangeMin} reps.`,
    }
  }
  if (anyBelowMin) {
    const next = Math.max(minWeightLbs, weightLbs - incrementLbs)
    if (minWeightLbs > 0 && next >= weightLbs) {
      // Already at (or below) bodyweight — there's no load to drop; rebuild reps instead.
      return {
        weightLbs: next,
        targetReps: repRangeMin,
        reason: 'hold',
        message: `Below range at bodyweight — stay there and rebuild from ${repRangeMin} reps.`,
      }
    }
    return {
      weightLbs: next,
      targetReps: repRangeMin,
      reason: 'drop_weight',
      message: minWeightLbs > 0 && next === minWeightLbs
        ? 'Below range last session — drop the added weight and rebuild at bodyweight.'
        : `Below range last session — drop to ${next} lbs and rebuild.`,
    }
  }
  const weakest = Math.min(...repsPerSet)
  return {
    weightLbs,
    targetReps: Math.min(weakest + 1, repRangeMax),
    reason: 'add_reps',
    message: `Same weight. Push the weakest set to ${Math.min(weakest + 1, repRangeMax)} reps.`,
  }
}

// ============================================================
// §5.3 — reps_then_load (Pull-ups, Hanging Leg Raise, Dips)
// ============================================================

export function nextRepsThenLoad(input: {
  lastSession?: { weightLbs: number; repsPerSet: number[] } | null
  /** Bodyweight in lbs — used to detect whether `weightLbs` represents BW only (no added load)
   *  or BW + added load. Pass 0 if unknown; algorithm treats any weight ≤ bodyWeight + slack
   *  as "no added load yet". */
  bodyWeightLbs?: number
  repRangeMin: number
  repRangeMax: number
  incrementLbs: number
}): AccessorySuggestion {
  const { lastSession, repRangeMin, repRangeMax, incrementLbs, bodyWeightLbs = 0 } = input

  if (!lastSession || lastSession.repsPerSet.length === 0) {
    return {
      weightLbs: bodyWeightLbs,
      targetReps: repRangeMin,
      reason: 'hold',
      message: 'No prior data — start at the bottom of the range, bodyweight only.',
    }
  }

  const { weightLbs, repsPerSet } = lastSession
  const allAtMax = repsPerSet.every((r) => r >= repRangeMax)
  const hasAddedLoad = bodyWeightLbs > 0 ? weightLbs > bodyWeightLbs + 1 : weightLbs > 0

  if (allAtMax) {
    const bump = hasAddedLoad ? incrementLbs : Math.max(incrementLbs, 5)
    const next = weightLbs + bump
    return {
      weightLbs: next,
      targetReps: repRangeMin,
      reason: 'add_weight',
      message: hasAddedLoad
        ? `All sets at top of range. Add ${bump} lbs to your loaded weight.`
        : `Hit ${repRangeMax} reps across all sets — start adding load (+${bump} lbs).`,
    }
  }
  // Fall back to standard double progression on reps at the same load.
  return nextDoubleProgression({
    lastSession,
    repRangeMin,
    repRangeMax,
    incrementLbs,
    minWeightLbs: bodyWeightLbs,
  })
}

// ============================================================
// Helpers
// ============================================================

function roundDown(value: number, increment: number): number {
  if (increment <= 0) return Math.floor(value)
  return Math.floor(value / increment) * increment
}
