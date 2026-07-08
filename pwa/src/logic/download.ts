// ============================================================
// Shared JSON file download
// ============================================================

/** Trigger a browser download of `json` as `filename`. */
export function downloadJSON(json: string, filename: string): void {
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

/** Date-stamped backup filename, e.g. my-workouts-backup-2026-07-07.json */
export function backupFilename(prefix = 'my-workouts-backup'): string {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.json`
}
