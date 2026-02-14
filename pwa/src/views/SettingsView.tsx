import { useState, useEffect, useRef } from 'react'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName } from '../types'
import { roundWeight } from '../logic/calculator'

export default function SettingsView() {
  const profile = useStore((s) => s.profile)
  const updateProfile = useStore((s) => s.updateProfile)
  const recalculateTMs = useStore((s) => s.recalculateTMs)
  const resetAll = useStore((s) => s.resetAll)
  const exportData = useStore((s) => s.exportData)
  const importData = useStore((s) => s.importData)

  const [isEditing, setIsEditing] = useState(false)
  const [editRMs, setEditRMs] = useState({ squat: '', bench: '', deadlift: '', press: '' })
  const [manualWeight, setManualWeight] = useState('')
  const [showResetCycle, setShowResetCycle] = useState(false)
  const [showResetAll, setShowResetAll] = useState(false)
  const [showImportAlert, setShowImportAlert] = useState(false)
  const [importJson, setImportJson] = useState('')
  const [importStatus, setImportStatus] = useState<'idle' | 'success' | 'error'>('idle')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (profile?.bodyWeightLbs) {
      setManualWeight(String(Math.round(profile.bodyWeightLbs)))
    }
  }, [profile?.bodyWeightLbs])

  if (!profile) return null

  const tmMap: Record<number, number> = {
    [MainLift.Squat]: profile.squatTM,
    [MainLift.BenchPress]: profile.benchTM,
    [MainLift.Deadlift]: profile.deadliftTM,
    [MainLift.ShoulderPress]: profile.pressTM,
  }

  const rmMap: Record<number, number> = {
    [MainLift.Squat]: profile.squatOneRepMax,
    [MainLift.BenchPress]: profile.benchOneRepMax,
    [MainLift.Deadlift]: profile.deadliftOneRepMax,
    [MainLift.ShoulderPress]: profile.pressOneRepMax,
  }

  const editKeys: Record<number, keyof typeof editRMs> = {
    [MainLift.Squat]: 'squat',
    [MainLift.BenchPress]: 'bench',
    [MainLift.Deadlift]: 'deadlift',
    [MainLift.ShoulderPress]: 'press',
  }

  function startEditing() {
    setEditRMs({
      squat: String(Math.round(profile!.squatOneRepMax)),
      bench: String(Math.round(profile!.benchOneRepMax)),
      deadlift: String(Math.round(profile!.deadliftOneRepMax)),
      press: String(Math.round(profile!.pressOneRepMax)),
    })
    setIsEditing(true)
  }

  function saveEdits() {
    const s = Number(editRMs.squat)
    const b = Number(editRMs.bench)
    const d = Number(editRMs.deadlift)
    const p = Number(editRMs.press)
    const updates: Partial<typeof profile> = {}
    if (s > 0) updates.squatOneRepMax = s
    if (b > 0) updates.benchOneRepMax = b
    if (d > 0) updates.deadliftOneRepMax = d
    if (p > 0) updates.pressOneRepMax = p
    updateProfile(updates)
    recalculateTMs()
    setIsEditing(false)
  }

  function handleSaveWeight() {
    const w = Number(manualWeight)
    if (w > 0) {
      updateProfile({ bodyWeightLbs: w, bodyWeightLastUpdated: new Date().toISOString() })
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
    const names: Record<number, string> = { 1: 'Squat', 2: 'Bench Press', 3: 'Deadlift', 4: 'Shoulder Press' }
    return names[day] ?? 'Unknown'
  }

  return (
    <div className="p-4 pb-4 space-y-6">
      <h1 className="text-xl font-bold">Settings</h1>

      {/* Current Cycle */}
      <Section title="Current Cycle">
        <Row label="Cycle" value={String(profile.cycleNumber)} />
        <Row label="Week" value={`${profile.currentWeek} of 3`} />
        <Row label="Day" value={`${profile.currentDay} – ${liftDay(profile.currentDay)}`} />
      </Section>

      {/* Body Weight */}
      <Section title="Body Weight">
        {profile.bodyWeightLbs != null && profile.bodyWeightLbs > 0 && (
          <Row label="Current Weight" value={`${profile.bodyWeightLbs.toFixed(1)} lbs`} />
        )}
        <div className="flex items-center gap-2 py-2">
          <span className="text-sm text-[#8e8e93] shrink-0">Manual Entry</span>
          <div className="flex-1" />
          <input
            type="number"
            inputMode="decimal"
            placeholder="lbs"
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
        {MAIN_LIFTS.map((lift) => {
          const key = editKeys[lift]
          if (isEditing) {
            const val = editRMs[key]
            const num = Number(val)
            const newTM = num > 0 ? roundWeight(num * 0.9) : tmMap[lift]
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
                  <span className="text-xs text-[#8e8e93]">lbs</span>
                </div>
                {num > 0 && (
                  <div className={`text-xs mt-1 ${newTM !== tmMap[lift] ? 'text-[var(--color-accent)]' : 'text-[#8e8e93]'}`}>
                    TM: {tmMap[lift]} → {newTM} lbs
                  </div>
                )}
              </div>
            )
          }
          return (
            <div key={lift} className="flex items-center justify-between py-2">
              <div>
                <div className="font-medium text-sm">{liftDisplayName(lift)}</div>
                <div className="text-xs text-[#8e8e93]">1RM: {Math.round(rmMap[lift])} lbs</div>
              </div>
              <div className="text-base font-bold text-[var(--color-accent)]">{tmMap[lift]} lbs</div>
            </div>
          )
        })}
      </Section>

      {/* Data Backup */}
      <Section title="Data Backup">
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
