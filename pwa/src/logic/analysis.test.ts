import { describe, it, expect } from 'vitest'
import type { SetLog, UserProfile, WorkoutSession } from '../types'
import { buildAnalysisFiles } from './analysis'
import { normalizePersistedData } from './persistedData'
import { ANALYSIS_FILENAME, SET_LOG_FILENAME } from './driveFiles'

// Local-noon timestamps so local-date conversion is stable in any timezone.
const at = (ymd: string, hhmm = '12:00') => new Date(`${ymd}T${hhmm}:00`).toISOString()
const NOW = new Date('2026-10-14T09:30:00').getTime()

const PROFILE = normalizePersistedData({
  profile: {
    squatOneRepMax: 300,
    benchOneRepMax: 225,
    deadliftOneRepMax: 400,
    pressOneRepMax: 135,
    squatTM: 270,
    benchTM: 202.5,
    deadliftTM: 360,
    pressTM: 122.5,
    currentWeek: 2,
    currentDay: 3,
    cycleNumber: 2,
    isCycleComplete: false,
    bodyWeightLbs: 180,
    bodyWeightLastUpdated: null,
    createdAt: at('2026-09-01'),
  },
}).profile as UserProfile

function session(id: string, date: string, liftRawValue: number, week = 1): WorkoutSession {
  return { id, date, liftRawValue, week, cycleNumber: 2, durationSeconds: 3600, variant: 'fsl' }
}

let n = 0
function set(sessionId: string, exerciseName: string, weight: number, reps: number | null, extra: Partial<SetLog> = {}): SetLog {
  return {
    id: `l${n++}`,
    sessionId,
    exerciseName,
    isMainLift: true,
    setIndex: 0,
    weight,
    targetReps: 5,
    actualReps: reps,
    isAMRAP: false,
    isCompleted: reps != null,
    completedAt: null,
    ...extra,
  }
}

function csvBlock(md: string, heading: string): string[] {
  const section = md.split(`## ${heading}`)[1]
  return section.split('```csv\n')[1].split('\n```')[0].split('\n')
}

const data = () => ({
  profile: PROFILE,
  sessions: [session('b', at('2026-10-07'), 2), session('a', at('2026-10-05', '18:30'), 1)],
  setLogs: [
    set('a', 'Squat', 200, 5),
    set('a', 'Squat', 240, 8, { setIndex: 2, isAMRAP: true }),
    set('a', 'Leg Press, "machine"', 300, 10, { isMainLift: false }),
    set('a', 'Leg Press, "machine"', 300, null, { isMainLift: false, setIndex: 1 }),
    set('b', 'Bench Press', 185, 5),
  ],
  wilksEntries: [],
})

describe('buildAnalysisFiles', () => {
  it('summarizes each session with its top set, e1RM, and volume', () => {
    const rows = csvBlock(buildAnalysisFiles(data(), NOW)[ANALYSIS_FILENAME], 'Sessions')
    expect(rows[0]).toMatch(/^date,time,focus,cycle,week,/)
    // AMRAP 240x8 is the top set: e1RM 240*36/29 ≈ 298. Volume 200*5 + 240*8 + 300*10.
    expect(rows[1]).toBe('2026-10-05,18:30,Squat,2,1,fsl,60,3,4,240,8,,298,5920')
    // No AMRAP: falls back to the heaviest completed main set.
    expect(rows[2]).toBe('2026-10-07,12:00,Bench Press,2,1,fsl,60,1,1,185,5,,208,925')
  })

  it('rolls sessions up into Monday-start weeks', () => {
    const rows = csvBlock(buildAnalysisFiles(data(), NOW)[ANALYSIS_FILENAME], 'Weekly summary')
    expect(rows[1]).toBe('2026-10-05,2,4,6845,120')
  })

  it('tracks per-exercise progression with main lifts first', () => {
    const rows = csvBlock(buildAnalysisFiles(data(), NOW)[ANALYSIS_FILENAME], 'Exercise progression')
    expect(rows[1]).toBe('Bench Press,yes,1,2026-10-07,2026-10-07,185,5,208')
    expect(rows[2]).toBe('Squat,yes,1,2026-10-05,2026-10-05,240,8,298')
    expect(rows[3]).toBe('"Leg Press, ""machine""",no,1,2026-10-05,2026-10-05,300,10,400')
  })

  it('lists training maxes and the best AMRAP per lift', () => {
    const md = buildAnalysisFiles(data(), NOW)[ANALYSIS_FILENAME]
    expect(csvBlock(md, 'Profile')[1]).toBe('Squat,300,270,298,240 x 8')
    expect(md).toContain('cycle 2, week 2 of 3')
  })

  it('itemizes every set, main lift sets first, with CSV escaping', () => {
    const lines = buildAnalysisFiles(data(), NOW)[SET_LOG_FILENAME].trim().split('\n')
    expect(lines[0]).toBe('date,session,exercise,main_lift,set,weight_lb,target_reps,actual_reps,set_type,rir,rep_range,completed')
    expect(lines[2]).toBe('2026-10-05,Squat,Squat,yes,3,240,5,8,amrap,,,yes')
    expect(lines[4]).toBe('2026-10-05,Squat,"Leg Press, ""machine""",no,2,300,5,,,,,no')
    expect(lines).toHaveLength(6)
  })

  it('labels deload sessions and accessory-only days', () => {
    const out = buildAnalysisFiles(
      { profile: null, sessions: [session('d', at('2026-10-06'), 0, 0)], setLogs: [], wilksEntries: [] },
      NOW,
    )[ANALYSIS_FILENAME]
    expect(csvBlock(out, 'Sessions')[1]).toBe('2026-10-06,12:00,Accessories only,2,deload,fsl,60,0,0,,,,,0')
    expect(out).toContain('No profile yet')
  })
})
