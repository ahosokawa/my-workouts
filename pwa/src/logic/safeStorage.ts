// ============================================================
// Safe persist storage
// ============================================================
//
// zustand's default createJSONStorage parses the persisted blob internally;
// if the JSON is malformed the throw aborts hydration and the app silently
// boots with empty initial state — indistinguishable from total data loss,
// and the first subsequent write overwrites the (still recoverable) raw blob.
//
// This PersistStorage catches the parse failure, preserves the raw blob under
// a backup key BEFORE persist can overwrite it, and flags the corruption so
// the app can show a recovery screen instead of starting fresh.

import type { PersistStorage, StorageValue } from 'zustand/middleware'

export const STORAGE_KEY = 'my-workouts-storage'
export const CORRUPT_BACKUP_KEY = 'my-workouts-storage-corrupt-backup'

let corruptDetected = false
let writeFailureWarned = false

// localStorage can be missing or non-functional (private-mode Safari throws
// with quota 0; node exposes a stub). Every access goes through these guards
// so a broken storage layer degrades to in-memory operation instead of
// crashing each state change.
function safeRead(key: string): string | null {
  try {
    return localStorage.getItem(key)
  } catch {
    return null
  }
}

function safeWrite(key: string, value: string): void {
  try {
    localStorage.setItem(key, value)
  } catch (e) {
    if (!writeFailureWarned) {
      writeFailureWarned = true
      console.warn('Persisting to localStorage failed — data will not survive a reload:', e)
    }
  }
}

function safeRemove(key: string): void {
  try {
    localStorage.removeItem(key)
  } catch {
    // nothing to clean up if storage is unavailable
  }
}

/** True when this session's hydration hit a corrupt blob. */
export function storageWasCorrupt(): boolean {
  return corruptDetected
}

/** The preserved raw blob from a past corrupt hydration, if any. */
export function getCorruptBackupRaw(): string | null {
  return safeRead(CORRUPT_BACKUP_KEY)
}

/** User chose to start fresh — drop the preserved blob and the flag. */
export function dismissCorruptBackup(): void {
  corruptDetected = false
  safeRemove(CORRUPT_BACKUP_KEY)
}

export function createSafeJSONStorage<T>(): PersistStorage<T> {
  return {
    getItem: (name) => {
      const raw = safeRead(name)
      if (raw === null) return null
      try {
        return JSON.parse(raw) as StorageValue<T>
      } catch {
        // Keep the FIRST corrupt blob — a later hydration must not replace an
        // earlier (fuller) backup with whatever is in storage by then.
        if (safeRead(CORRUPT_BACKUP_KEY) === null) {
          safeWrite(CORRUPT_BACKUP_KEY, raw)
        }
        corruptDetected = true
        return null
      }
    },
    setItem: (name, value) => safeWrite(name, JSON.stringify(value)),
    removeItem: (name) => safeRemove(name),
  }
}
