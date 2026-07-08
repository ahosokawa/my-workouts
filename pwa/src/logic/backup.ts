// ============================================================
// Backup file serialization / validated parsing
// ============================================================
//
// The backup file has its own version, independent of the zustand persist
// version. v1 (never bumped historically) contained: profile, sessions,
// setLogs, wilksEntries, customAccessories, customSupplemental,
// savedExercises. v2 adds the program archives and rest-notify settings so a
// backup→restore round-trip no longer loses them.
//
// cloudSync is NEVER exported (it holds a GitHub PAT) and is dropped if a
// backup somehow contains it. activeWorkout is intentionally not part of a
// backup — import always discards any in-flight workout.

import type { PersistedData } from './persistedData'

export const BACKUP_VERSION = 2

const ARRAY_KEYS = ['sessions', 'setLogs', 'wilksEntries', 'savedExercises'] as const
const RECORD_KEYS = [
  'customAccessories',
  'customSupplemental',
  'programAccessoryArchive',
  'programSupplementalArchive',
] as const
// Numeric profile fields every historical backup shape has; everything else
// is healed by normalizePersistedData after import.
const PROFILE_NUMERIC_KEYS = [
  'squatTM',
  'benchTM',
  'deadliftTM',
  'pressTM',
  'currentWeek',
  'currentDay',
  'cycleNumber',
] as const

export function serializeBackup(data: PersistedData): string {
  const {
    profile,
    sessions,
    setLogs,
    wilksEntries,
    customAccessories,
    customSupplemental,
    programAccessoryArchive,
    programSupplementalArchive,
    savedExercises,
    restNotifyEnabled,
    restNotifyMinutes,
  } = data
  return JSON.stringify(
    {
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      profile,
      sessions,
      setLogs,
      wilksEntries,
      customAccessories,
      customSupplemental,
      programAccessoryArchive,
      programSupplementalArchive,
      savedExercises,
      restNotifyEnabled,
      restNotifyMinutes,
    },
    null,
    2,
  )
}

/** Parse and structurally validate a backup file (version 1 or 2). Returns
 *  only recognized data keys that are present — cloudSync and anything
 *  unknown are dropped. Throws a descriptive Error on any problem. */
export function parseBackup(json: string): Partial<PersistedData> {
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new Error('Invalid backup file')
  }
  if (typeof data !== 'object' || data === null || Array.isArray(data)) {
    throw new Error('Invalid backup file')
  }
  const d = data as Record<string, unknown>
  if (d.version !== 1 && d.version !== 2) throw new Error('Unsupported backup version')

  if (d.profile !== undefined && d.profile !== null) {
    if (typeof d.profile !== 'object' || Array.isArray(d.profile)) {
      throw new Error('Invalid backup file: profile is not an object')
    }
    const p = d.profile as Record<string, unknown>
    for (const k of PROFILE_NUMERIC_KEYS) {
      if (typeof p[k] !== 'number' || !Number.isFinite(p[k])) {
        throw new Error(`Invalid backup file: profile.${k} is missing or not a number`)
      }
    }
  }
  for (const k of ARRAY_KEYS) {
    if (d[k] !== undefined && d[k] !== null && !Array.isArray(d[k])) {
      throw new Error(`Invalid backup file: ${k} is not a list`)
    }
  }
  for (const k of RECORD_KEYS) {
    if (d[k] !== undefined && d[k] !== null && (typeof d[k] !== 'object' || Array.isArray(d[k]))) {
      throw new Error(`Invalid backup file: ${k} is not an object`)
    }
  }
  if (d.restNotifyEnabled !== undefined && typeof d.restNotifyEnabled !== 'boolean') {
    throw new Error('Invalid backup file: restNotifyEnabled is not a boolean')
  }
  if (d.restNotifyMinutes !== undefined && typeof d.restNotifyMinutes !== 'number') {
    throw new Error('Invalid backup file: restNotifyMinutes is not a number')
  }

  const out: Record<string, unknown> = {}
  const recognized = ['profile', ...ARRAY_KEYS, ...RECORD_KEYS, 'restNotifyEnabled', 'restNotifyMinutes']
  for (const k of recognized) {
    if (d[k] !== undefined) out[k] = d[k]
  }
  return out as Partial<PersistedData>
}
