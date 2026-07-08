import { useState } from 'react'
import { getCorruptBackupRaw, dismissCorruptBackup } from '../logic/safeStorage'
import { downloadJSON, backupFilename } from '../logic/download'

/** Shown when the persisted store couldn't be parsed. The raw blob was
 *  preserved under a backup key before anything could overwrite it; this
 *  screen blocks the app until the user saves it or explicitly starts fresh. */
export default function StorageRecoveryView() {
  const [confirmFresh, setConfirmFresh] = useState(false)

  function handleDownload() {
    downloadJSON(getCorruptBackupRaw() ?? '{}', backupFilename('my-workouts-recovered-data'))
  }

  function handleStartFresh() {
    dismissCorruptBackup()
    location.reload()
  }

  return (
    <div className="absolute inset-0 overflow-y-auto pt-safe bg-[#0a0a0a] text-white">
      <div className="p-6 max-w-sm mx-auto space-y-4">
        <h1 className="text-xl font-bold mt-8">Saved data couldn't be read</h1>
        <p className="text-sm text-[#8e8e93]">
          Your stored workout data appears to be damaged and couldn't be loaded.
          The raw data has been preserved — download it now so nothing is lost.
          It may be repairable or importable later.
        </p>
        <button
          onClick={handleDownload}
          className="w-full py-3 rounded-xl bg-[#1c1c1e] font-semibold text-[var(--color-accent)]"
        >
          Download Raw Backup
        </button>
        <button
          onClick={() => setConfirmFresh(true)}
          className="w-full py-3 rounded-xl bg-[#1c1c1e] font-semibold text-[var(--color-red)]"
        >
          Start Fresh
        </button>
        {confirmFresh && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={() => setConfirmFresh(false)}>
            <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
              <h3 className="font-semibold text-lg mb-2">Start fresh?</h3>
              <p className="text-base text-[#8e8e93] mb-5">
                This discards the preserved data permanently. Make sure you've
                downloaded the backup first.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmFresh(false)} className="flex-1 py-3 rounded-lg bg-[#38383a] text-base">Cancel</button>
                <button onClick={handleStartFresh} className="flex-1 py-3 rounded-lg bg-[var(--color-red)] text-base font-semibold text-white">
                  Discard
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
