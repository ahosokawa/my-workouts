import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { requestPersistentStorage, getStorageHealth, formatBytes } from './storageHealth'
import { STORAGE_KEY } from './safeStorage'

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
let savedLocalStorage: Storage | undefined

beforeEach(() => {
  savedLocalStorage = g.localStorage
  g.localStorage = fakeLocalStorage()
})

afterEach(() => {
  if (savedLocalStorage === undefined) delete g.localStorage
  else g.localStorage = savedLocalStorage
  vi.unstubAllGlobals()
})

// globalThis.navigator is getter-only in node — stub it via vitest.
function setNavigatorStorage(storage: Partial<StorageManager> | undefined) {
  vi.stubGlobal('navigator', storage === undefined ? {} : { storage })
}

describe('requestPersistentStorage', () => {
  it('returns the granted flag when supported', async () => {
    setNavigatorStorage({ persist: async () => true })
    expect(await requestPersistentStorage()).toBe(true)

    setNavigatorStorage({ persist: async () => false })
    expect(await requestPersistentStorage()).toBe(false)
  })

  it('returns null when the API is unavailable', async () => {
    setNavigatorStorage(undefined)
    expect(await requestPersistentStorage()).toBeNull()

    vi.stubGlobal('navigator', undefined)
    expect(await requestPersistentStorage()).toBeNull()
  })

  it('returns null instead of rejecting when persist() throws', async () => {
    setNavigatorStorage({
      persist: () => Promise.reject(new Error('denied')),
    })
    expect(await requestPersistentStorage()).toBeNull()
  })
})

describe('getStorageHealth', () => {
  it('reports persisted flag, app blob size, and origin estimate', async () => {
    localStorage.setItem(STORAGE_KEY, 'x'.repeat(100))
    setNavigatorStorage({
      persisted: async () => true,
      estimate: async () => ({ usage: 1234, quota: 5_000_000 }),
    })
    const health = await getStorageHealth()
    expect(health.persisted).toBe(true)
    expect(health.appBytes).toBe(200) // 100 UTF-16 code units × 2 bytes
    expect(health.usage).toBe(1234)
    expect(health.quota).toBe(5_000_000)
  })

  it('degrades to nulls when StorageManager is unavailable', async () => {
    setNavigatorStorage(undefined)
    const health = await getStorageHealth()
    expect(health.persisted).toBeNull()
    expect(health.appBytes).toBeNull() // no blob written
    expect(health.usage).toBeNull()
    expect(health.quota).toBeNull()
  })

  it('never rejects when every API throws', async () => {
    g.localStorage = {
      ...fakeLocalStorage(),
      getItem: () => {
        throw new Error('storage unavailable')
      },
    } as Storage
    setNavigatorStorage({
      persisted: () => Promise.reject(new Error('nope')),
      estimate: () => Promise.reject(new Error('nope')),
    })
    const health = await getStorageHealth()
    expect(health).toEqual({ persisted: null, appBytes: null, usage: null, quota: null })
  })

  it('fills missing estimate fields with null', async () => {
    setNavigatorStorage({
      persisted: async () => false,
      estimate: async () => ({}),
    })
    const health = await getStorageHealth()
    expect(health.persisted).toBe(false)
    expect(health.usage).toBeNull()
    expect(health.quota).toBeNull()
  })
})

describe('formatBytes', () => {
  it('formats across unit boundaries', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1023)).toBe('1023 B')
    expect(formatBytes(1024)).toBe('1.0 KB')
    expect(formatBytes(4300)).toBe('4.2 KB')
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB')
    expect(formatBytes(1.2 * 1024 * 1024)).toBe('1.2 MB')
    expect(formatBytes(3.5 * 1024 * 1024 * 1024)).toBe('3.5 GB')
  })
})
