import { useState } from 'react'
import { useStore } from '../store'
import { roundWeight } from '../logic/calculator'

export default function OnboardingView() {
  const createProfile = useStore((s) => s.createProfile)
  const updateProfile = useStore((s) => s.updateProfile)

  const [squat, setSquat] = useState('')
  const [bench, setBench] = useState('')
  const [deadlift, setDeadlift] = useState('')
  const [press, setPress] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')

  const values = [squat, bench, deadlift, press].map(Number)
  const allValid = values.every((v) => v > 0)

  function handleStart() {
    if (!allValid) return
    createProfile(values[0], values[1], values[2], values[3])
    const bw = Number(bodyWeight)
    if (bw > 0) {
      updateProfile({ bodyWeightLbs: bw, bodyWeightLastUpdated: new Date().toISOString() })
    }
  }

  const fields = [
    { label: 'Squat', value: squat, set: setSquat },
    { label: 'Bench Press', value: bench, set: setBench },
    { label: 'Deadlift', value: deadlift, set: setDeadlift },
    { label: 'Shoulder Press', value: press, set: setPress },
  ]

  return (
    <div className="min-h-full flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🏋️</div>
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

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={!allValid}
          className="w-full py-3 rounded-xl font-semibold text-white transition-opacity
            bg-[var(--color-accent)] disabled:opacity-40"
        >
          Start Training
        </button>
      </div>
    </div>
  )
}
