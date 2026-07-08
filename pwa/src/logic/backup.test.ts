import { describe, it, expect } from 'vitest'
import { serializeBackup, parseBackup, BACKUP_VERSION } from './backup'
import { normalizePersistedData, emptyPersistedData } from './persistedData'
import type { UserProfile } from '../types'
import { MAIN_LIFTS } from '../types'

// The core original profile fields every historical v1 backup carries.
// Deliberately missing everything added later (programType, cycleWeeks,
// dayOrder, completedDaysThisWeek, tmPercentage, sex, units, deload fields…).
const LEGACY_PROFILE = {
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
  createdAt: '2025-12-01T00:00:00.000Z',
} as unknown as UserProfile

/** The exact shape the live app's v1 exportData produced. */
function v1Backup(overrides: Record<string, unknown> = {}): string {
  return JSON.stringify({
    version: 1,
    exportedAt: '2026-01-01T00:00:00.000Z',
    profile: LEGACY_PROFILE,
    sessions: [],
    setLogs: [],
    wilksEntries: [],
    customAccessories: null,
    customSupplemental: null,
    savedExercises: [],
    ...overrides,
  })
}

describe('parseBackup — validation', () => {
  it('rejects non-JSON', () => {
    expect(() => parseBackup('not json {')).toThrow('Invalid backup file')
  })

  it('rejects non-object JSON', () => {
    expect(() => parseBackup('[1,2,3]')).toThrow('Invalid backup file')
    expect(() => parseBackup('"hello"')).toThrow('Invalid backup file')
  })

  it('rejects unknown versions', () => {
    expect(() => parseBackup(JSON.stringify({ version: 3 }))).toThrow('Unsupported backup version')
    expect(() => parseBackup(JSON.stringify({}))).toThrow('Unsupported backup version')
  })

  it('rejects a mangled sessions field', () => {
    expect(() => parseBackup(v1Backup({ sessions: 'nope' }))).toThrow('sessions is not a list')
  })

  it('rejects a profile with non-numeric TMs', () => {
    const bad = { ...LEGACY_PROFILE, squatTM: '270' }
    expect(() => parseBackup(v1Backup({ profile: bad }))).toThrow('profile.squatTM')
  })

  it('rejects a profile that is not an object', () => {
    expect(() => parseBackup(v1Backup({ profile: 'garbage' }))).toThrow('profile is not an object')
  })

  it('accepts a null profile (pre-onboarding export)', () => {
    const out = parseBackup(v1Backup({ profile: null }))
    expect(out.profile).toBeNull()
  })

  it('drops cloudSync and unknown keys from the payload', () => {
    const out = parseBackup(v1Backup({ cloudSync: { token: 'ghp_secret' }, junk: 42 }))
    expect('cloudSync' in out).toBe(false)
    expect('junk' in out).toBe(false)
  })
})

describe('parseBackup + normalizePersistedData — v1 backup heals to current shape', () => {
  it('an old v1 backup gains every newer profile default immediately', () => {
    const parsed = parseBackup(v1Backup())
    const normalized = normalizePersistedData({ ...emptyPersistedData(), ...parsed })

    const p = normalized.profile!
    expect(p.programType).toBe('531')
    expect(p.cycleWeeks).toBe(3)
    expect(p.dayOrder).toEqual([...MAIN_LIFTS])
    // Legacy linear history at currentDay 3 → days 1 and 2 done.
    expect(p.completedDaysThisWeek).toEqual([1, 2])
    expect(p.tmPercentage).toBe(90)
    expect(p.sex).toBe('male')
    expect(p.units).toBe('lbs')
    expect(p.currentVariant).toBe('fsl')
    // Untouched originals survive.
    expect(p.squatTM).toBe(270)
    expect(p.cycleNumber).toBe(2)
  })

  it('a v1 backup with null accessories gets program defaults seeded', () => {
    const parsed = parseBackup(v1Backup())
    const normalized = normalizePersistedData({ ...emptyPersistedData(), ...parsed })
    expect(normalized.customAccessories).not.toBeNull()
    for (const lift of MAIN_LIFTS) {
      expect(normalized.customAccessories![lift].length).toBeGreaterThan(0)
    }
  })
})

describe('serializeBackup — v2 round-trip', () => {
  function populatedData() {
    const data = emptyPersistedData()
    data.profile = LEGACY_PROFILE
    data.programAccessoryArchive = { hypertrophy: { 1: [] } }
    data.programSupplementalArchive = {}
    data.restNotifyEnabled = false
    data.restNotifyMinutes = 5
    data.cloudSync = { enabled: true, token: 'ghp_secret', gistId: 'g', lastSyncAt: null, lastError: null }
    return data
  }

  it('writes version 2 with the exact expected key set (never the PAT)', () => {
    const parsed = JSON.parse(serializeBackup(populatedData()))
    expect(Object.keys(parsed).sort()).toEqual(
      [
        'version',
        'exportedAt',
        'profile',
        'sessions',
        'setLogs',
        'wilksEntries',
        'customAccessories',
        'customSupplemental',
        'programAccessoryArchive',
        'programSupplementalArchive',
        'savedExercises',
        'restNotifyEnabled',
        'restNotifyMinutes',
      ].sort(),
    )
    expect(parsed.version).toBe(BACKUP_VERSION)
    expect(JSON.stringify(parsed)).not.toContain('ghp_secret')
  })

  it('round-trips archives and rest-notify settings', () => {
    const json = serializeBackup(populatedData())
    const parsed = parseBackup(json)
    expect(parsed.programAccessoryArchive).toEqual({ hypertrophy: { 1: [] } })
    expect(parsed.restNotifyEnabled).toBe(false)
    expect(parsed.restNotifyMinutes).toBe(5)
  })
})
