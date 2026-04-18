import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName, toDisplayWeight, toStorageLbs, displayRound } from '../types'
import { roundWeight } from '../logic/calculator'
import { requestNotificationPermission } from '../notifications'
import { verifyToken, errorMessage } from '../logic/gistSync'
import { syncOnce } from '../logic/syncManager'

export default function SettingsView() {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const recalculateTMs = useStore((s) => s.recalculateTMs)
  const resetAll = useStore((s) => s.resetAll)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)
  const restNotifyEnabled = useStore((s) => s.restNotifyEnabled)
  const restNotifyMinutes = useStore((s) => s.restNotifyMinutes)
  const setRestNotifyEnabled = useStore((s) => s.setRestNotifyEnabled)
  const setRestNotifyMinutes = useStore((s) => s.setRestNotifyMinutes)
  const cloudSync = useStore((s) => s.cloudSync)
  const setCloudSync = useStore((s) => s.setCloudSync)

  const [isEditing, setIsEditing] = useState(false)
  const [editRMs, setEditRMs] = useState({ squat: '', bench: '', deadlift: '', press: '' })
  const [manualWeight, setManualWeight] = useState('')
  const [showResetCycle, setShowResetCycle] = useState(false)
  const [showResetAll, setShowResetAll] = useState(false)
  const [showImportAlert, setShowImportAlert] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const [showCloudSetup, setShowCloudSetup] = useState(false)
  const [tokenInput, setTokenInput] = useState('')
  const [verifying, setVerifying] = useState(false)
  const [setupError, setSetupError] = useState<string | null>(null)
  const [syncingNow, setSyncingNow] = useState(false)
  const [showDisableSync, setShowDisableSync] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile?.bodyWeightLbs) {
      setManualWeight(String(displayRound(profile.bodyWeightLbs, profile.units ?? 'lbs')))
    }
  }, [profile?.bodyWeightLbs, profile?.units])

  if (!profile) return null

  const units = profile.units ?? 'lbs'
  const tmMap: Record<number, number> = {
    [MainLift.Squat]: displayRound(profile.squatTM, units),
    [MainLift.BenchPress]: displayRound(profile.benchTM, units),
    [MainLift.Deadlift]: displayRound(profile.deadliftTM, units),
    [MainLift.ShoulderPress]: displayRound(profile.pressTM, units),
  }

  const rmMap: Record<number, number> = {
    [MainLift.Squat]: displayRound(profile.squatOneRepMax, units),
    [MainLift.BenchPress]: displayRound(profile.benchOneRepMax, units),
    [MainLift.Deadlift]: displayRound(profile.deadliftOneRepMax, units),
    [MainLift.ShoulderPress]: displayRound(profile.pressOneRepMax, units),
  }

  const editKeys: Record<number, keyof typeof editRMs> = {
    [MainLift.Squat]: 'squat',
    [MainLift.BenchPress]: 'bench',
    [MainLift.Deadlift]: 'deadlift',
    [MainLift.ShoulderPress]: 'press',
  }

  function startEditing() {
    setEditRMs({
      squat: String(displayRound(profile!.squatOneRepMax, units)),
      bench: String(displayRound(profile!.benchOneRepMax, units)),
      deadlift: String(displayRound(profile!.deadliftOneRepMax, units)),
      press: String(displayRound(profile!.pressOneRepMax, units)),
    })
    setIsEditing(true)
  }

  function saveEdits() {
    const s = Number(editRMs.squat)
    const b = Number(editRMs.bench)
    const d = Number(editRMs.deadlift)
    const p = Number(editRMs.press)
    const updates: Partial<typeof profile> = {}
    if (s > 0) updates.squatOneRepMax = toStorageLbs(s, units)
    if (b > 0) updates.benchOneRepMax = toStorageLbs(b, units)
    if (d > 0) updates.deadliftOneRepMax = toStorageLbs(d, units)
    if (p > 0) updates.pressOneRepMax = toStorageLbs(p, units)
    updateProfile(updates)
    recalculateTMs()
    setIsEditing(false)
  }

  function handleSaveWeight() {
    const w = Number(manualWeight)
    if (w > 0) {
      updateProfile({ bodyWeightLbs: toStorageLbs(w, units), bodyWeightLastUpdated: new Date().toISOString() })
    }
  }

  function handleResetCycle() {
    updateProfile({ currentWeek: 1, currentDay: 1, isCycleComplete: false })
    setShowResetCycle(false)
  }

  function handleResetAll() {
    resetAll()
    setShowResetAll(false)
  }

  const liftDay = (day: number) => {
    const names: Record<number, string> = { 1: 'Squat', 2: 'Bench Press', 3: 'Deadlift', 4: 'Overhead Press' }
    return names[day] ?? 'Unknown'
  }

  async function handleShareBackup() {
    const json = exportData()
    const filename = `my-workouts-backup-${new Date().toISOString().slice(0, 10)}.json`
    const file = new File([json], filename, { type: 'application/json' })
    const shareData = { files: [file], title: 'My Workouts Backup' }
    if (typeof navigator.canShare === 'function' && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData)
        return
      } catch {
        // User cancelled or share failed — fall through to download fallback
      }
    }
    const blob = new Blob([json], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  async function handleEnableSync() {
    const token = tokenInput.trim()
    if (!token) {
      setSetupError('Paste a GitHub token.')
      return
    }
    setVerifying(true)
    setSetupError(null)
    const result = await verifyToken(token)
    setVerifying(false)
    if (!result.ok) {
      setSetupError(errorMessage(result.error))
      return
    }
    setCloudSync({
      enabled: true,
      token,
      gistId: null,
      lastSyncAt: null,
      lastError: null,
    })
    setTokenInput('')
    setShowCloudSetup(false)
    // Kick off the first sync immediately rather than waiting for the debounce.
    void syncOnce(useStore)
  }

  async function handleSyncNow() {
    setSyncingNow(true)
    try {
      await syncOnce(useStore)
    } finally {
      setSyncingNow(false)
    }
  }

  function handleDisableSync() {
    setCloudSync(null)
    setShowDisableSync(false)
  }

  return (
    <div className="p-4 pb-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Units */}
      <Section title="Units">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Weight Units</span>
          <div className="flex gap-1">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                onClick={() => { if (u !== units) updateProfile({ units: u }) }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  units === u
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[#38383a] text-[#8e8e93]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Current Cycle */}
      <Section title="Current Cycle">
        <Row label="Cycle" value={String(profile.cycleNumber)} />
        <Row label="Week" value={`${profile.currentWeek} of 3`} />
        <Row label="Day" value={`${profile.currentDay} – ${liftDay(profile.currentDay)}`} />
      </Section>

      {/* Body Weight & Sex */}
      <Section title="Body Weight">
        {profile.bodyWeightLbs != null && profile.bodyWeightLbs > 0 && (
          <Row label="Current Weight" value={`${toDisplayWeight(profile.bodyWeightLbs, units).toFixed(1)} ${units}`} />
        )}
        <div className="flex items-center gap-2 py-2">
          <span className="text-sm text-[#8e8e93] shrink-0">Manual Entry</span>
          <div className="flex-1" />
          <input
            type="number"
            inputMode="decimal"
            placeholder={units}
            value={manualWeight}
            onChange={(e) => setManualWeight(e.target.value)}
            className="w-20 text-right text-sm"
          />
          <button
            onClick={handleSaveWeight}
            disabled={!(Number(manualWeight) > 0)}
            className="text-sm text-[var(--color-accent)] disabled:opacity-40"
          >
            Save
          </button>
        </div>
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Sex (Wilks)</span>
          <div className="flex gap-1">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                onClick={() => { if (s !== (profile.sex ?? 'male')) updateProfile({ sex: s }) }}
                className={`px-3 py-1 rounded-lg text-xs font-semibold transition-colors ${
                  (profile.sex ?? 'male') === s
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[#38383a] text-[#8e8e93]'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
      </Section>

      {/* Rest Timer Notification */}
      <Section title="Rest Timer Notification">
        <div className="flex items-center justify-between py-2">
          <span className="text-sm">Notify when resting too long</span>
          <button
            onClick={async () => {
              if (!restNotifyEnabled) {
                const granted = await requestNotificationPermission()
                if (granted) setRestNotifyEnabled(true)
              } else {
                setRestNotifyEnabled(false)
              }
            }}
            className={`relative w-12 h-7 rounded-full transition-colors ${restNotifyEnabled ? 'bg-[var(--color-green)]' : 'bg-[#38383a]'}`}
          >
            <span className={`absolute top-[2px] left-[2px] w-6 h-6 rounded-full bg-white transition-transform ${restNotifyEnabled ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        {restNotifyEnabled && (
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Notify after</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setRestNotifyMinutes(Math.max(1, restNotifyMinutes - 1))}
                className="w-8 h-8 rounded-lg bg-[#38383a] text-base font-semibold"
              >
                −
              </button>
              <span className="text-sm tabular-nums w-16 text-center">{restNotifyMinutes} min</span>
              <button
                onClick={() => setRestNotifyMinutes(Math.min(10, restNotifyMinutes + 1))}
                className="w-8 h-8 rounded-lg bg-[#38383a] text-base font-semibold"
              >
                +
              </button>
            </div>
          </div>
        )}
      </Section>

      {/* Training Maxes */}
      <Section
        title="Training Maxes"
        trailing={
          <button onClick={isEditing ? saveEdits : startEditing} className="text-sm text-[var(--color-accent)]">
            {isEditing ? 'Save' : 'Edit'}
          </button>
        }
      >
        {isEditing && (
          <div className="py-2">
            <div className="text-xs text-[#8e8e93] mb-2">TM Percentage</div>
            <div className="flex gap-2">
              {([85, 90] as const).map((pct) => (
                <button
                  key={pct}
                  onClick={() => { if (pct !== (profile.tmPercentage ?? 90)) updateProfile({ tmPercentage: pct }) }}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                    (profile.tmPercentage ?? 90) === pct
                      ? 'bg-[var(--color-accent)] text-white'
                      : 'bg-[#38383a] text-[#8e8e93]'
                  }`}
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}
        {MAIN_LIFTS.map((lift) => {
          const key = editKeys[lift]
          const tmPct = (profile.tmPercentage ?? 90) / 100
          if (isEditing) {
            const val = editRMs[key]
            const num = Number(val)
            const newTM = num > 0 ? roundWeight(num * tmPct, units) : tmMap[lift]
            return (
              <div key={lift} className="py-2">
                <div className="font-medium text-sm mb-1">{liftDisplayName(lift)}</div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#8e8e93]">1RM:</span>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={val}
                    onChange={(e) => setEditRMs((p) => ({ ...p, [key]: e.target.value }))}
                    className="flex-1 text-sm"
                  />
                  <span className="text-xs text-[#8e8e93]">{units}</span>
                </div>
                {num > 0 && (
                  <div className={`text-xs mt-1 ${newTM !== tmMap[lift] ? 'text-[var(--color-accent)]' : 'text-[#8e8e93]'}`}>
                    TM: {tmMap[lift]} → {newTM} {units}
                  </div>
                )}
              </div>
            )
          }
          return (
            <div key={lift} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-sm">{liftDisplayName(lift)}</div>
                <div className="text-xs text-[#8e8e93]">1RM: {Math.round(rmMap[lift])} {units}</div>
              </div>
              <div className="text-base font-bold text-[var(--color-accent)]">{tmMap[lift]} {units}</div>
            </div>
          )
        })}
      </Section>

      {/* Data Backup */}
      <Section title="Data Backup">
        <button
          onClick={handleShareBackup}
          className="w-full text-left py-2 text-sm text-[var(--color-accent)]"
        >
          Share Backup
        </button>
        <button
          onClick={() => {
            const json = exportData()
            const blob = new Blob([json], { type: 'application/json' })
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = `my-workouts-backup-${new Date().toISOString().slice(0, 10)}.json`
            a.click()
            URL.revokeObjectURL(url)
          }}
          className="w-full text-left py-2 text-sm text-[var(--color-accent)]"
        >
          Export Backup (JSON)
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full text-left py-2 text-sm text-[var(--color-accent)]"
        >
          Import Backup
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (!file) return
            const reader = new FileReader()
            reader.onload = () => {
              setImportJson(reader.result as string)
              setShowImportAlert(true)
            }
            reader.readAsText(file)
            e.target.value = ''
          }}
        />
        {importStatus === 'success' && (
          <div className="py-2 text-sm text-[var(--color-green)]">Import successful!</div>
        )}
        {importStatus === 'error' && (
          <div className="py-2 text-sm text-[var(--color-red)]">Import failed. Invalid backup file.</div>
        )}
      </Section>

      {/* Cloud Backup (GitHub Gist) */}
      <Section title="Cloud Backup (GitHub Gist)">
        {!cloudSync?.enabled && !showCloudSetup && (
          <>
            <button
              onClick={() => { setShowCloudSetup(true); setSetupError(null) }}
              className="w-full text-left py-2 text-sm text-[var(--color-accent)]"
            >
              Enable GitHub Gist Sync
            </button>
            <div className="py-2 text-xs text-[#8e8e93]">
              Auto-saves a private backup to your GitHub account whenever your data changes.
            </div>
          </>
        )}

        {!cloudSync?.enabled && showCloudSetup && (
          <div className="py-2 space-y-3">
            <div className="text-xs text-[#8e8e93]">
              Create a <span className="text-white">classic</span> token with <span className="text-white">gist</span> scope only:{' '}
              <a
                href="https://github.com/settings/tokens/new?scopes=gist&description=my-workouts%20backup"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--color-accent)] underline"
              >
                github.com/settings/tokens/new
              </a>
              . Paste it below.
            </div>
            <input
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder="ghp_…"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              className="w-full text-sm"
            />
            {setupError && (
              <div className="text-xs text-[var(--color-red)]">{setupError}</div>
            )}
            <div className="flex gap-2">
              <button
                onClick={() => { setShowCloudSetup(false); setTokenInput(''); setSetupError(null) }}
                disabled={verifying}
                className="flex-1 py-2 rounded-lg bg-[#38383a] text-sm disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleEnableSync}
                disabled={verifying || !tokenInput.trim()}
                className="flex-1 py-2 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white disabled:opacity-50"
              >
                {verifying ? 'Verifying…' : 'Verify & Enable'}
              </button>
            </div>
          </div>
        )}

        {cloudSync?.enabled && (
          <>
            <Row
              label="Status"
              value={
                cloudSync.lastError
                  ? 'Error'
                  : cloudSync.lastSyncAt
                    ? `Synced ${formatRelative(cloudSync.lastSyncAt)}`
                    : 'Not synced yet'
              }
            />
            {cloudSync.lastError && (
              <div className="py-2 text-xs text-[var(--color-red)]">{cloudSync.lastError}</div>
            )}
            <button
              onClick={handleSyncNow}
              disabled={syncingNow}
              className="w-full text-left py-2 text-sm text-[var(--color-accent)] disabled:opacity-50"
            >
              {syncingNow ? 'Syncing…' : 'Sync now'}
            </button>
            <button
              onClick={() => setShowDisableSync(true)}
              className="w-full text-left py-2 text-sm text-[var(--color-red)]"
            >
              Disable sync
            </button>
          </>
        )}
      </Section>

      {/* Actions */}
      <Section title="Actions">
        <button onClick={() => setShowResetCycle(true)} className="w-full text-left py-2 text-sm text-[var(--color-orange)]">
          Reset Cycle to Week 1 Day 1
        </button>
        <button onClick={() => setShowResetAll(true)} className="w-full text-left py-2 text-sm text-[var(--color-red)]">
          Reset All Data
        </button>
      </Section>

      {/* Alerts */}
      {showResetCycle && (
        <Alert
          title="Reset Cycle?"
          message="This will reset your progress to Week 1, Day 1 without changing your training maxes."
          onConfirm={handleResetCycle}
          onCancel={() => setShowResetCycle(false)}
          confirmLabel="Reset"
          destructive
        />
      )}
      {showResetAll && (
        <Alert
          title="Reset All Data?"
          message="This will delete all your data including workout history and personal records. You will need to set up your lifts again."
          onConfirm={handleResetAll}
          onCancel={() => setShowResetAll(false)}
          confirmLabel="Reset Everything"
          destructive
        />
      )}
      {showDisableSync && (
        <Alert
          title="Disable Cloud Sync?"
          message="The existing gist on GitHub won't be deleted, but your token will be removed from this device and auto-sync will stop."
          onConfirm={handleDisableSync}
          onCancel={() => setShowDisableSync(false)}
          confirmLabel="Disable"
          destructive
        />
      )}
      {showImportAlert && (
        <Alert
          title="Import Backup?"
          message="This will overwrite all your current data with the backup file. This cannot be undone."
          onConfirm={() => {
            try {
              importData(importJson)
              setImportStatus('success')
            } catch {
              setImportStatus('error')
            }
            setShowImportAlert(false)
            setImportJson('')
            setTimeout(() => setImportStatus('idle'), 3000)
          }}
          onCancel={() => { setShowImportAlert(false); setImportJson('') }}
          confirmLabel="Import"
          destructive
        />
      )}
    </div>
  )
}

// ============================================================
// Reusable Components
// ============================================================

function Section({ title, trailing, children }: { title: string; trailing?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-3 pb-1">
        <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">{title}</h2>
        {trailing}
      </div>
      <div className="px-4 pb-3 divide-y divide-[#38383a]">{children}</div>
    </div>
  )
}

function formatRelative(iso: string): string {
  const then = new Date(iso).getTime()
  const diff = Date.now() - then
  if (Number.isNaN(then) || diff < 0) return 'just now'
  const sec = Math.round(diff / 1000)
  if (sec < 60) return 'just now'
  const min = Math.round(sec / 60)
  if (min < 60) return `${min} min ago`
  const hr = Math.round(min / 60)
  if (hr < 24) return `${hr} hr ago`
  const day = Math.round(hr / 24)
  if (day < 7) return `${day} d ago`
  return new Date(iso).toLocaleDateString()
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-2">
      <span className="text-sm">{label}</span>
      <span className="text-sm text-[#8e8e93]">{value}</span>
    </div>
  )
}

function Alert({
  title,
  message,
  onConfirm,
  onCancel,
  confirmLabel,
  destructive,
}: {
  title: string
  message: string
  onConfirm: () => void
  onCancel: () => void
  confirmLabel: string
  destructive?: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-6" onClick={onCancel}>
      <div className="bg-[#2c2c2e] rounded-2xl w-full max-w-xs p-6 text-center" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold text-base mb-2">{title}</h3>
        <p className="text-sm text-[#8e8e93] mb-5">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} className="flex-1 py-2 rounded-lg bg-[#38383a] text-sm">
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`flex-1 py-2 rounded-lg text-sm font-semibold text-white ${destructive ? 'bg-[var(--color-red)]' : 'bg-[var(--color-accent)]'}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
