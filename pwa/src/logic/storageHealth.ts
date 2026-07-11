// ============================================================
// Storage health
// ============================================================
//
// Two concerns, both best-effort:
//  - Ask the browser to mark this origin's storage persistent so it isn't
//    evicted under storage pressure (localStorage included).
//  - Report how much data the app is holding so a future capacity problem
//    is visible in Settings long before the ~5 MB localStorage quota bites.
//
// Every browser API here is optional (older Safari lacks parts of
// StorageManager) and may throw; all failures degrade to `null`, never a
// rejection, so callers can fire-and-forget.

import { STORAGE_KEY } from './safeStorage'

export interface StorageHealth {
  /** Origin marked persistent? null = API unavailable/failed. */
  persisted: boolean | null
  /** Approximate size of the app's own localStorage blob in bytes. */
  appBytes: number | null
  /** Origin-wide usage/quota from StorageManager.estimate(), when available. */
  usage: number | null
  quota: number | null
}

/** Request durable storage for the origin. Returns the granted flag, or
 *  null when the API is unavailable or the call failed. */
export async function requestPersistentStorage(): Promise<boolean | null> {
  try {
    if (typeof navigator === 'undefined' || !navigator.storage?.persist) return null
    return await navigator.storage.persist()
  } catch {
    return null
  }
}

export async function getStorageHealth(): Promise<StorageHealth> {
  let persisted: boolean | null = null
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.persisted) {
      persisted = await navigator.storage.persisted()
    }
  } catch {
    persisted = null
  }

  let appBytes: number | null = null
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    // localStorage stores UTF-16 code units — 2 bytes each.
    if (raw !== null) appBytes = raw.length * 2
  } catch {
    appBytes = null
  }

  let usage: number | null = null
  let quota: number | null = null
  try {
    if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
      const est = await navigator.storage.estimate()
      usage = est.usage ?? null
      quota = est.quota ?? null
    }
  } catch {
    // leave nulls
  }

  return { persisted, appBytes, usage, quota }
}

/** Human-readable byte count: "512 B", "4.2 KB", "1.2 MB", "3.5 GB". */
export function formatBytes(n: number): string {
  if (n < 1024) return `${Math.round(n)} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`
  return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`
}
