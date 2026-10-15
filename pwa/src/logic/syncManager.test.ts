import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { syncOnce, type SyncableStore } from './syncManager'
import { ANALYSIS_FILENAME, BACKUP_FILENAME, SET_LOG_FILENAME } from './driveFiles'

const URL = 'https://script.google.com/macros/s/abc/exec'

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
      profile: null,
      sessions: [],
      setLogs: [],
      wilksEntries: [],
      customAccessories: null,
      savedExercises: [],
      cloudSync: {
        enabled: true,
        bridgeUrl: URL,
        secret: 'sec',
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
      cloudSync: { enabled: false, bridgeUrl: URL, secret: 'sec', lastSyncAt: null, lastError: null },
    } as Partial<State>)
    await syncOnce(store)
    expect(setCloudSyncStatus).not.toHaveBeenCalled()
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('pushes the backup and analysis files to the bridge in one call', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ body: { ok: true } }),
    )
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    const call = (globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    expect(call[0]).toBe(URL)
    expect(call[1].method).toBe('POST')
    expect(call[1].headers['Content-Type']).toMatch(/^text\/plain/)
    const body = JSON.parse(call[1].body)
    expect(body.secret).toBe('sec')
    expect(body.action).toBe('write')
    expect(Object.keys(body.files).sort()).toEqual([ANALYSIS_FILENAME, BACKUP_FILENAME, SET_LOG_FILENAME].sort())
    expect(body.files[BACKUP_FILENAME]).toBe('{"payload":true}')
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastSyncAt: expect.any(String),
      lastError: null,
    })
  })

  it('records a secret mismatch from the bridge', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce(
      mockResponse({ body: { ok: false, error: 'auth' } }),
    )
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastError: expect.stringMatching(/secret/i),
    })
  })

  it('reports a non-JSON (Apps Script HTML error) response as a deployment problem', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => {
        throw new SyntaxError('Unexpected token <')
      },
    } as unknown as Response)
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastError: expect.stringMatching(/deployment/i),
    })
  })

  it('records a network error when fetch throws', async () => {
    ;(globalThis.fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    const { store, setCloudSyncStatus } = makeStore()
    await syncOnce(store)
    expect(setCloudSyncStatus).toHaveBeenCalledWith({
      lastError: expect.stringMatching(/network/i),
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
