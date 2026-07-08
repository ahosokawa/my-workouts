import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import {
  createSafeJSONStorage,
  storageWasCorrupt,
  getCorruptBackupRaw,
  dismissCorruptBackup,
  STORAGE_KEY,
  CORRUPT_BACKUP_KEY,
} from './safeStorage'

// Tests run in a node environment — provide a Map-backed localStorage fake.
function fakeLocalStorage() {
  const map = new Map<string, string>()
  return {
    getItem: (k: string) => (map.has(k) ? map.get(k)! : null),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
    key: (i: number) => Array.from(map.keys())[i] ?? null,
    get length() {
      return map.size
    },
  } as Storage
}

const g = globalThis as { localStorage?: Storage }
let saved: Storage | undefined

beforeEach(() => {
  saved = g.localStorage
  g.localStorage = fakeLocalStorage()
  dismissCorruptBackup() // reset module-level corrupt flag between tests
})

afterEach(() => {
  dismissCorruptBackup()
  if (saved === undefined) delete g.localStorage
  else g.localStorage = saved
})

describe('createSafeJSONStorage', () => {
  it('round-trips valid values', () => {
    const storage = createSafeJSONStorage<{ a: number }>()
    storage.setItem(STORAGE_KEY, { state: { a: 1 }, version: 1 })
    expect(storage.getItem(STORAGE_KEY)).toEqual({ state: { a: 1 }, version: 1 })
    expect(storageWasCorrupt()).toBe(false)

    storage.removeItem(STORAGE_KEY)
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
  })

  it('returns null for a missing key without flagging corruption', () => {
    const storage = createSafeJSONStorage()
    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storageWasCorrupt()).toBe(false)
    expect(getCorruptBackupRaw()).toBeNull()
  })

  it('on corrupt JSON: returns null, preserves the raw blob, sets the flag', () => {
    localStorage.setItem(STORAGE_KEY, '{"state":{"profile":') // truncated
    const storage = createSafeJSONStorage()

    expect(storage.getItem(STORAGE_KEY)).toBeNull()
    expect(storageWasCorrupt()).toBe(true)
    expect(getCorruptBackupRaw()).toBe('{"state":{"profile":')
    expect(localStorage.getItem(CORRUPT_BACKUP_KEY)).toBe('{"state":{"profile":')
  })

  it('never overwrites an existing corrupt backup with a later blob', () => {
    const storage = createSafeJSONStorage()
    localStorage.setItem(STORAGE_KEY, '{first corrupt')
    storage.getItem(STORAGE_KEY)

    // A later hydration hits different corrupt content — the original backup wins.
    localStorage.setItem(STORAGE_KEY, '{second corrupt')
    storage.getItem(STORAGE_KEY)

    expect(getCorruptBackupRaw()).toBe('{first corrupt')
  })

  it('dismissCorruptBackup clears both the blob and the flag', () => {
    localStorage.setItem(STORAGE_KEY, 'not json')
    const storage = createSafeJSONStorage()
    storage.getItem(STORAGE_KEY)
    expect(storageWasCorrupt()).toBe(true)

    dismissCorruptBackup()

    expect(storageWasCorrupt()).toBe(false)
    expect(getCorruptBackupRaw()).toBeNull()
  })
})
