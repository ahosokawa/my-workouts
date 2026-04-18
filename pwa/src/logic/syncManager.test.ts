import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncOnce, type SyncableStore } from './syncManager'

type State = ReturnType<SyncableStore['getState']>

function mockResponse(init: { ok?: boolean; status?: number; body?: unknown }): Response {
  const status = init.status ?? 200
  return {
    ok: init.ok ?? (status >= 200 && status < 300),
    status,
    json: async () => init.body,
  } as Response
}

function makeStore(overrides: Partial<State> = {}): {
  store: SyncableStore
  setCloudSyncStatus: ReturnType<typeof vi.fn>
  stateRef: { current: State }
} {
  const setCloudSyncStatus = vi.fn((partial) => {
    stateRef.current = {
      ...stateRef.current,
      cloudSync: stateRef.current.cloudSync
        ? { ...stateRef.current.cloudSync, ...partial }
        : null,
    } as State
  })

  const stateRef: { current: State } = {
    current: {
      profile: { foo: 1 },
      sessions: [],
      setLogs: [],
      wilksEntries: [],
      customAccessories: null,
      savedExercises: [],
      cloudSync: {
        enabled: true,
        token: 'tok',
        gistId: null,
        lastSyncAt: null,
        lastError: null,
      },
      exportData: () => '{"payload":true}',
      setCloudSyncStatus,
      ...overrides,
    } as State,
  }

  const store: SyncableStore = {
    getState: () => stateRef.current,
    subscribe: () => () => {},
  }

  return { store, setCloudSyncStatus, stateRef }
}

beforeEach(() => {
  globalThis.fetch = vi.fn() as unknown as typeof fetch
  // Stub navigator so tests work in Node with or without jsdom (Node 21+ makes
  // navigator a getter-only global, so plain assignment would fail).
  vi.stubGlobal('navigator', { onLine: true })
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('syncOnce', () => {
  it('is a no-op when cloudSync is null', async () => {
    const { store, setCloudSyncStatus } = makeStore({ cloudSync: null } as Partial<State>)
    await syncOnce(store)
    expect(setCloudSyncStatus).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('is a no-op when disabled', async () => {
    const { store, setCloudSyncStatus } = makeStore({
      cloudSync: { enabled: false, token: 'tok', gistId: null, lastSyncAt: null, lastError: null },
    } as Partial<State>)
    await syncOnce(store)
    expect(setCloudSyncStatus).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('creates a gist on first sync and stores the id', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ body: { id: 'new-gist-id' } }),
    )
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      gistId: 'new-gist-id',
      lastSyncAt: expect.any(String),
      lastError: null,
    })
  })

  it('updates an existing gist when id is set', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ status: 200, body: {} }),
    )
    const { store, setCloudSyncStatus } = makeStore({
      cloudSync: { enabled: true, token: 'tok', gistId: 'existing', lastSyncAt: null, lastError: null },
    } as Partial<State>)
    await syncOnce(store)
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe('https://api.github.com/gists/existing')
    expect(call[1].method).toBe('PATCH')
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastSyncAt: expect.any(String),
      lastError: null,
    })
  })

  it('records an error on auth failure and does not clear it', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ status: 401 }),
    )
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastError: expect.stringMatching(/token/i),
    })
  })

  it('records a network error when offline and does not call fetch', async () => {
    vi.stubGlobal('navigator', { onLine: false })
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(globalThis.fetch).not.toHaveBeenCalled()
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastError: expect.stringMatching(/network/i),
    })
  })
})
