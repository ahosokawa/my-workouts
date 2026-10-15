import type { StoreApi } from 'zustand'
import type { SetLog, UserProfile, WilksEntry, WorkoutSession } from '../types'
import { pushFiles, errorMessage } from './driveSync'
import { buildAnalysisFiles } from './analysis'
import { BACKUP_FILENAME } from './driveFiles'

// Keep this interface minimal (dependency-injected) so it's easy to test and
// avoids a cyclic import between the store and this module.
export interface SyncableStore {
  getState: () => {
    profile: UserProfile | null
    sessions: WorkoutSession[]
    setLogs: SetLog[]
    wilksEntries: WilksEntry[]
    customAccessories: unknown
    customSupplemental: unknown
    savedExercises: unknown
    cloudSync: {
      enabled: boolean
      bridgeUrl: string
      secret: string
      lastSyncAt: string | null
      lastError: string | null
    } | null
    exportData: () => string
    setCloudSyncStatus: (partial: {
      lastSyncAt?: string | null
      lastError?: string | null
    }) => void
  }
  subscribe: StoreApi<unknown>['subscribe']
}

const DEBOUNCE_MS = 3000

interface ManagerHandle {
  stop: () => void
  syncNow: () => Promise<void>
}

export function startSyncManager(store: SyncableStore): ManagerHandle {
  let debounceTimer: ReturnType<typeof setTimeout> | null = null
  let syncing = false
  let pending = false

  const schedule = () => {
    if (debounceTimer != null) clearTimeout(debounceTimer)
    debounceTimer = setTimeout(() => {
      debounceTimer = null
      void run()
    }, DEBOUNCE_MS)
  }

  const run = async () => {
    if (syncing) {
      pending = true
      return
    }
    syncing = true
    try {
      await syncOnce(store)
    } finally {
      syncing = false
      if (pending) {
        pending = false
        schedule()
      }
    }
  }

  // Subscribe to store changes; only schedule a sync when a persisted data
  // field actually changes (reference equality works because Zustand produces
  // new references on mutation). This avoids resetting the debounce on rest
  // timer ticks and other `activeWorkout` updates.
  let last = snapshot(store.getState())
  const unsubscribe = store.subscribe((state) => {
    const next = snapshot(state as ReturnType<SyncableStore['getState']>)
    if (!changed(last, next)) return
    last = next
    schedule()
  })

  // Retry on reconnect if the last attempt failed while offline.
  const onOnline = () => {
    const { cloudSync } = store.getState()
    if (cloudSync?.enabled && cloudSync.lastError) schedule()
  }
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
  }

  // If the previous session ended with a failed sync, catch up on startup.
  const initial = store.getState().cloudSync
  if (initial?.enabled && initial.lastError) schedule()

  return {
    stop: () => {
      if (debounceTimer != null) clearTimeout(debounceTimer)
      unsubscribe()
      if (typeof window !== 'undefined') {
        window.removeEventListener('online', onOnline)
      }
    },
    syncNow: () => syncOnce(store),
  }
}

type Snapshot = {
  profile: unknown
  sessions: unknown
  setLogs: unknown
  wilksEntries: unknown
  customAccessories: unknown
  customSupplemental: unknown
  savedExercises: unknown
}

function snapshot(state: ReturnType<SyncableStore['getState']>): Snapshot {
  return {
    profile: state.profile,
    sessions: state.sessions,
    setLogs: state.setLogs,
    wilksEntries: state.wilksEntries,
    customAccessories: state.customAccessories,
    customSupplemental: state.customSupplemental,
    savedExercises: state.savedExercises,
  }
}

function changed(a: Snapshot, b: Snapshot): boolean {
  return (
    a.profile !== b.profile ||
    a.sessions !== b.sessions ||
    a.setLogs !== b.setLogs ||
    a.wilksEntries !== b.wilksEntries ||
    a.customAccessories !== b.customAccessories ||
    a.customSupplemental !== b.customSupplemental ||
    a.savedExercises !== b.savedExercises
  )
}

/** Everything written to the Drive folder in one bridge call: the raw backup
 *  plus the Claude-facing analysis files. */
export function buildSyncFiles(state: ReturnType<SyncableStore['getState']>): Record<string, string> {
  return {
    [BACKUP_FILENAME]: state.exportData(),
    ...buildAnalysisFiles(state),
  }
}

export async function syncOnce(store: SyncableStore): Promise<void> {
  const state = store.getState()
  const { cloudSync, setCloudSyncStatus } = state
  if (!cloudSync || !cloudSync.enabled || !cloudSync.bridgeUrl) return

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    setCloudSyncStatus({ lastError: errorMessage('network') })
    return
  }

  const files = buildSyncFiles(state)
  const now = new Date().toISOString()
  const res = await pushFiles(cloudSync.bridgeUrl, cloudSync.secret, files)
  if (!res.ok) {
    setCloudSyncStatus({ lastError: errorMessage(res.error) })
    return
  }
  setCloudSyncStatus({ lastSyncAt: now, lastError: null })
}
