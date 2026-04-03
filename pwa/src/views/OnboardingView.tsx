import { useState } from 'react'
import { useStore } from '../store'
import { MAIN_LIFTS, ProgramVariant, PhaseType } from '../types'
import type { AccessoryExercise } from '../types'
import { roundWeight } from '../logic/calculator'
import { getVariantConfig } from '../logic/variants'
import AccessoryEditor from '../components/AccessoryEditor'

export default function OnboardingView() {
  const createProfile = useStore((s) => s.createProfile)
  const updateProfile = useStore((s) => s.updateProfile)
  const setCustomAccessories = useStore((s) => s.setCustomAccessories)

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [squat, setSquat] = useState('')
  const [bench, setBench] = useState('')
  const [deadlift, setDeadlift] = useState('')
  const [press, setPress] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')

  // Step 2 state — variant selection
  const [selectedVariant, setSelectedVariant] = useState<ProgramVariant>(ProgramVariant.BBB)

  // Step 3 state — accessories (empty by default)
  const [dayAccessories, setDayAccessories] = useState<Record<number, AccessoryExercise[]>>(() => {
    const m: Record<number, AccessoryExercise[]> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = []
    }
    return m
  })

  const values = [squat, bench, deadlift, press].map(Number)
  const allValid = values.every((v) => v > 0)

  function handleContinue() {
    if (!allValid) return
    setStep(2)
  }

  function handleStart() {
    createProfile(values[0], values[1], values[2], values[3], selectedVariant)
    const bw = Number(bodyWeight)
    if (bw > 0) {
      updateProfile({ bodyWeightLbs: bw, bodyWeightLastUpdated: new Date().toISOString() })
    }
    setCustomAccessories(dayAccessories)
  }

  const fields = [
    { label: 'Squat', value: squat, set: setSquat },
    { label: 'Bench Press', value: bench, set: setBench },
    { label: 'Deadlift', value: deadlift, set: setDeadlift },
    { label: 'Overhead Press', value: press, set: setPress },
  ]

  // ---- Step 3: Accessory Review ----
  if (step === 3) {
    return (
      <div className="min-h-full flex flex-col p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Review Accessories</h1>
          <p className="text-sm text-[#8e8e93]">
            Add accessory exercises for each training day. You can change these again after each cycle.
          </p>
        </div>

        <AccessoryEditor value={dayAccessories} onChange={setDayAccessories} />

        <div className="flex-1 min-h-6" />

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setStep(2)}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[#38383a]"
          >
            Back
          </button>
          <button
            onClick={handleStart}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[var(--color-accent)]"
          >
            Start Training
          </button>
        </div>
      </div>
    )
  }

  // ---- Step 2: Program Variant Selection ----
  if (step === 2) {
    return (
      <div className="min-h-full flex flex-col p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Choose Your Program</h1>
          <p className="text-sm text-[#8e8e93]">
            Pick a supplemental template for your first cycle. You can change this after each cycle.
          </p>
        </div>

        <div className="text-xs text-[var(--color-accent)] mb-3">
          Suggested: Start with a Leader cycle
        </div>
        <div className="grid grid-cols-2 gap-2">
          {(Object.values(ProgramVariant) as ProgramVariant[]).map((v) => {
            const config = getVariantConfig(v)
            const isSelected = selectedVariant === v
            const isSuggestedPhase = config.phase === PhaseType.Leader
            return (
              <button
                key={v}
                onClick={() => setSelectedVariant(v)}
                className={`rounded-lg p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
                    : isSuggestedPhase
                      ? 'border border-[#48484a] bg-[#2c2c2e]'
                      : 'border border-[#38383a] bg-[#1c1c1e]'
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{config.shortLabel}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                    config.phase === PhaseType.Leader ? 'bg-[#3a3a3c] text-[#8e8e93]' : 'bg-[#1c3a5e] text-[var(--color-accent)]'
                  }`}>
                    {config.phase === PhaseType.Leader ? 'Leader' : 'Anchor'}
                  </span>
                </div>
                <div className="text-xs text-[#8e8e93]">
                  {config.supplementalSets}×{config.supplementalReps}
                </div>
              </button>
            )
          })}
        </div>
        {(() => {
          const config = getVariantConfig(selectedVariant)
          return (
            <div className="mt-3 text-xs text-[#8e8e93]">
              {config.label} — {config.description}
            </div>
          )
        })()}

        <div className="flex-1 min-h-6" />

        <div className="flex gap-3 mt-6">
          <button
            onClick={() => setStep(1)}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[#38383a]"
          >
            Back
          </button>
          <button
            onClick={() => setStep(3)}
            className="flex-1 py-3 rounded-xl font-semibold text-white bg-[var(--color-accent)]"
          >
            Continue
          </button>
        </div>
      </div>
    )
  }

  // ---- Step 1: Enter 1RMs ----
  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">My Workouts</h1>
          <p className="text-sm text-[#8e8e93]">
            Enter your current one-rep maxes to get started with the 5/3/1 program.
          </p>
        </div>

        {/* 1RM Inputs */}
        <div className="space-y-4 mb-6">
          {fields.map((f) => (
            <div key={f.label}>
              <label className="block text-sm text-[#8e8e93] mb-1">{f.label} 1RM (lbs)</label>
              <input
                type="number"
                inputMode="numeric"
                placeholder="0"
                value={f.value}
                onChange={(e) => f.set(e.target.value)}
                className="w-full"
              />
            </div>
          ))}
        </div>

        {/* Body Weight */}
        <div className="mb-6">
          <label className="block text-sm text-[#8e8e93] mb-1">Body Weight (lbs)</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Optional — used for Wilks score"
            value={bodyWeight}
            onChange={(e) => setBodyWeight(e.target.value)}
            className="w-full"
          />
        </div>

        {/* TM Preview */}
        {allValid && (
          <div className="bg-[#1c1c1e] rounded-xl p-4 mb-6">
            <h3 className="text-xs text-[#8e8e93] uppercase tracking-wider mb-3">Training Maxes (90%)</h3>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f, i) => (
                <div key={f.label} className="text-center">
                  <div className="text-xs text-[#8e8e93]">{f.label}</div>
                  <div className="text-lg font-bold text-[var(--color-accent)]">
                    {roundWeight(values[i] * 0.9)} lbs
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Continue Button */}
        <button
          onClick={handleContinue}
          disabled={!allValid}
          className="w-full py-3 rounded-xl font-semibold text-white transition-opacity
            bg-[var(--color-accent)] disabled:opacity-40"
        >
          Continue
        </button>
      </div>
    </div>
  )
}
