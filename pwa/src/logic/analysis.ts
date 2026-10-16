// ============================================================
// Claude-facing export: Markdown summary + itemized set log
// ============================================================
//
// Written to Drive next to the raw backup so analysis sessions read
// pre-joined, human-readable training data (lift names, top sets, e1RMs,
// weekly volume) instead of the persisted store blob. Pure — no store access.

import type { SetLog, UserProfile, WilksEntry, WorkoutSession } from '../types'
import { MAIN_LIFTS, MainLift, isTopSetLog, liftDisplayName, trainingMaxFor } from '../types'
import { estimated1RM } from './brzycki'
import { bestAmrapE1RM } from './personalRecords'
import { getProgram, programDayLabel, programLabel } from './programs'
import { ANALYSIS_FILENAME, BACKUP_FILENAME, SET_LOG_FILENAME } from './driveFiles'

export interface AnalysisInput {
  profile: UserProfile | null
  sessions: WorkoutSession[]
  setLogs: SetLog[]
  wilksEntries: WilksEntry[]
}

type Cell = string | number | null | undefined

function r1(n: number): number {
  return Math.round(n * 10) / 10
}

function csvCell(v: Cell): string {
  if (v === undefined || v === null) return ''
  const s = String(v)
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')
}

function fence(body: string): string {
  return '```csv\n' + body + '\n```'
}

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

function localDate(iso: string): string {
  const d = new Date(iso)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function localTime(iso: string): string {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function weekStart(iso: string): string {
  const d = new Date(iso)
  d.setHours(12, 0, 0, 0)
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7))
  return localDate(d.toISOString())
}

const isLift = (v: number): v is MainLift => (MAIN_LIFTS as readonly number[]).includes(v)

function setType(l: SetLog): string {
  if (l.isWarmup) return 'warmup'
  if (l.exerciseId && l.repRangeMin != null) return 'working'
  if (!l.isAMRAP) return ''
  return isTopSetLog(l) ? 'top_set' : 'amrap'
}

function repRange(l: SetLog): string {
  return l.repRangeMin != null && l.repRangeMax != null ? `${l.repRangeMin}-${l.repRangeMax}` : ''
}

/** The set that best represents a session's main-lift performance: the
 *  completed AMRAP/top set if there is one, else the heaviest completed main set. */
function topMainSet(logs: SetLog[]): SetLog | undefined {
  const done = logs.filter((l) => l.isMainLift && l.isCompleted && l.actualReps != null)
  return done.find((l) => l.isAMRAP) ?? [...done].sort((a, b) => b.weight - a.weight)[0]
}

function volume(logs: SetLog[]): number {
  return logs.reduce((s, l) => (l.isCompleted && l.actualReps ? s + l.weight * l.actualReps : s), 0)
}

function sessionFocus(s: WorkoutSession, logs: SetLog[]): string {
  if (s.dayLabel) return s.dayLabel
  if (isLift(s.liftRawValue)) return liftDisplayName(s.liftRawValue)
  return logs.find((l) => l.isMainLift)?.exerciseName ?? 'Accessories only'
}

export function buildAnalysisFiles(
  data: AnalysisInput,
  now: number = Date.now(),
): Record<string, string> {
  const { profile, wilksEntries } = data
  const sessions = [...data.sessions].sort((a, b) => a.date.localeCompare(b.date))
  const logsBySession = new Map<string, SetLog[]>()
  for (const l of data.setLogs) {
    logsBySession.set(l.sessionId, [...(logsBySession.get(l.sessionId) ?? []), l])
  }
  for (const logs of logsBySession.values()) {
    logs.sort((a, b) => (a.isMainLift === b.isMainLift ? 0 : a.isMainLift ? -1 : 1))
  }

  // ---- Sessions -----------------------------------------------------------
  const sessionRows: Cell[][] = sessions.map((s) => {
    const logs = logsBySession.get(s.id) ?? []
    const top = topMainSet(logs)
    const e1rm = top ? estimated1RM(top.weight, top.actualReps ?? 0) : null
    return [
      localDate(s.date),
      localTime(s.date),
      sessionFocus(s, logs),
      s.cycleNumber,
      s.week === 0 ? 'deload' : s.week,
      s.variant,
      Math.round(s.durationSeconds / 60),
      logs.filter((l) => l.isCompleted).length,
      logs.length,
      top?.weight,
      top?.actualReps,
      top?.rir,
      e1rm !== null ? Math.round(e1rm) : null,
      Math.round(volume(logs)),
    ]
  })

  // ---- Weekly rollup (Mon-start) -----------------------------------------
  const weeks = new Map<string, WorkoutSession[]>()
  for (const s of sessions) {
    const k = weekStart(s.date)
    weeks.set(k, [...(weeks.get(k) ?? []), s])
  }
  const weeklyRows: Cell[][] = [...weeks.entries()].map(([start, ss]) => {
    const logs = ss.flatMap((s) => logsBySession.get(s.id) ?? [])
    return [
      start,
      ss.length,
      logs.filter((l) => l.isCompleted).length,
      Math.round(volume(logs)),
      Math.round(ss.reduce((t, s) => t + s.durationSeconds, 0) / 60),
    ]
  })

  // ---- Per-exercise progression ------------------------------------------
  type Ex = { name: string; main: boolean; dates: Set<string>; first: string; last: string; lastTop?: SetLog; best: number | null }
  const exercises = new Map<string, Ex>()
  for (const s of sessions) {
    const byName = new Map<string, SetLog[]>()
    for (const l of logsBySession.get(s.id) ?? []) byName.set(l.exerciseName, [...(byName.get(l.exerciseName) ?? []), l])
    const day = localDate(s.date)
    for (const [name, logs] of byName) {
      const done = logs.filter((l) => l.isCompleted && l.actualReps != null)
      if (!done.length) continue
      const ex = exercises.get(name) ?? { name, main: logs[0].isMainLift, dates: new Set(), first: day, last: day, best: null }
      ex.dates.add(day)
      ex.last = day
      ex.lastTop = [...done].sort((a, b) => b.weight - a.weight || (b.actualReps ?? 0) - (a.actualReps ?? 0))[0]
      for (const l of done) {
        const e = estimated1RM(l.weight, l.actualReps ?? 0)
        if (e !== null && (ex.best === null || e > ex.best)) ex.best = e
      }
      exercises.set(name, ex)
    }
  }
  const exerciseRows: Cell[][] = [...exercises.values()]
    .sort((a, b) => Number(b.main) - Number(a.main) || a.name.localeCompare(b.name))
    .map((e) => [
      e.name,
      e.main ? 'yes' : 'no',
      e.dates.size,
      e.first,
      e.last,
      e.lastTop?.weight,
      e.lastTop?.actualReps,
      e.best !== null && e.best > 0 ? Math.round(e.best) : null,
    ])

  // ---- Set log ------------------------------------------------------------
  const setRows: Cell[][] = []
  for (const s of sessions) {
    const logs = logsBySession.get(s.id) ?? []
    const focus = sessionFocus(s, logs)
    for (const l of logs) {
      setRows.push([
        localDate(s.date),
        focus,
        l.exerciseName,
        l.isMainLift ? 'yes' : 'no',
        l.isWarmup ? l.setIndex + 4 : l.setIndex + 1,
        l.weight,
        l.targetReps,
        l.actualReps,
        setType(l),
        l.rir,
        repRange(l),
        l.isCompleted ? 'yes' : 'no',
      ])
    }
  }
  const setLog = csv(
    ['date', 'session', 'exercise', 'main_lift', 'set', 'weight_lb', 'target_reps', 'actual_reps', 'set_type', 'rir', 'rep_range', 'completed'],
    setRows,
  )

  // ---- Markdown -----------------------------------------------------------
  const lines: string[] = []
  lines.push('# my-workouts export', '')
  lines.push(`Generated ${localDate(new Date(now).toISOString())} ${localTime(new Date(now).toISOString())} (device local time) by the my-workouts app. Auto-synced after every change.`, '')
  lines.push(
    '## How to read this file',
    '',
    '- All weights are in lb (the app stores lb even when it displays kg). Dates and times are local; weeks start Monday.',
    '- e1RM = Brzycki estimated 1-rep max: weight × 36 / (37 − reps).',
    '- `set_type`: `amrap` = 5/3/1 as-many-reps-as-possible set; `top_set` = rep-range top set (hypertrophy / upper-lower programs). `rir` = reps in reserve (3 means 3+).',
    '- In Sessions, `week` is the program week (`deload` for deload/TM-test sessions); the top set is the AMRAP/top set if present, else the heaviest completed main-lift set. `volume_lb` = Σ weight × reps over completed sets.',
    `- Every set of every session: \`${SET_LOG_FILENAME}\` (same folder). Raw app backup: \`${BACKUP_FILENAME}\`.`,
    '',
  )

  lines.push('## Profile', '')
  if (profile) {
    const def = getProgram(profile.programType)
    lines.push(
      `- Program: ${programLabel(profile.programType)} · variant ${profile.currentVariant} · cycle ${profile.cycleNumber}, week ${profile.currentWeek} of ${profile.cycleWeeks}, next day ${profile.currentDay} (${programDayLabel(def, profile.currentDay, profile.dayOrder)})`,
      `- Deloading: ${profile.isDeloading ? `yes (${profile.deloadType ?? 'deload'})` : 'no'} · last deload ended ${profile.lastDeloadEndedAt ? localDate(profile.lastDeloadEndedAt) : 'never'}`,
      `- Sex: ${profile.sex} · Bodyweight: ${profile.bodyWeightLbs != null ? `${profile.bodyWeightLbs} lb` : 'not set'}${profile.bodyWeightLastUpdated ? ` (updated ${localDate(profile.bodyWeightLastUpdated)})` : ''} · Display units: ${profile.units}`,
      `- Training maxes are ${profile.tmPercentage}% of 1RM. Started ${localDate(profile.createdAt)}.`,
      '',
    )
    lines.push(
      fence(
        csv(
          ['lift', 'one_rep_max_lb', 'training_max_lb', 'best_amrap_e1rm_lb', 'best_amrap_set'],
          MAIN_LIFTS.map((lift) => {
            const best = bestAmrapE1RM(data.setLogs, lift)
            const orm = {
              [MainLift.Squat]: profile.squatOneRepMax,
              [MainLift.BenchPress]: profile.benchOneRepMax,
              [MainLift.Deadlift]: profile.deadliftOneRepMax,
              [MainLift.ShoulderPress]: profile.pressOneRepMax,
            }[lift]
            return [
              liftDisplayName(lift),
              orm,
              trainingMaxFor(profile, lift),
              best ? Math.round(best.e1rm) : null,
              best ? `${best.weight} x ${best.reps}` : null,
            ]
          }),
        ),
      ),
      '',
    )
  } else {
    lines.push('No profile yet (onboarding not completed).', '')
  }

  lines.push('## Weekly summary', '')
  lines.push(fence(csv(['week_start', 'sessions', 'sets_completed', 'volume_lb', 'minutes'], weeklyRows)), '')

  lines.push('## Exercise progression', '', 'One row per exercise ever trained. `last_top_set` = heaviest completed set in the most recent session.', '')
  lines.push(
    fence(
      csv(
        ['exercise', 'main_lift', 'sessions', 'first_date', 'last_date', 'last_top_weight_lb', 'last_top_reps', 'best_e1rm_lb'],
        exerciseRows,
      ),
    ),
    '',
  )

  lines.push('## Sessions', '')
  lines.push(
    fence(
      csv(
        ['date', 'time', 'focus', 'cycle', 'week', 'variant', 'duration_min', 'sets_completed', 'sets_planned', 'top_set_weight_lb', 'top_set_reps', 'top_set_rir', 'top_set_e1rm_lb', 'volume_lb'],
        sessionRows,
      ),
    ),
    '',
  )

  lines.push('## Wilks history', '')
  lines.push(
    fence(
      csv(
        ['date', 'bodyweight_lb', 'squat_e1rm_lb', 'bench_e1rm_lb', 'deadlift_e1rm_lb', 'total_lb', 'wilks'],
        [...wilksEntries]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((w) => [localDate(w.date), w.bodyWeightLbs, Math.round(w.squatE1RM), Math.round(w.benchE1RM), Math.round(w.deadliftE1RM), Math.round(w.total), r1(w.wilksScore)]),
      ),
    ),
    '',
  )

  return {
    [ANALYSIS_FILENAME]: lines.join('\n'),
    [SET_LOG_FILENAME]: setLog + '\n',
  }
}
