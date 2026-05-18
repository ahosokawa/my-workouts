import { useState } from 'react'
import { useStore } from '../store'
import { MAIN_LIFTS, ProgramVariant, PhaseType, ProgramType, toStorageLbs } from '../types'
import type { AccessoryExercise, SupplementalOverride, Units, ProgramType as ProgramTypeT, MainLift } from '../types'
import { roundWeight } from '../logic/calculator'
import { getVariantConfig } from '../logic/variants'
import { getHypertrophyAccessories } from '../logic/accessories'
import WorkoutPlanEditor from '../components/WorkoutPlanEditor'
import DayOrderEditor from '../components/DayOrderEditor'

export default function OnboardingView() {
  const createProfile = useStore((s) => s.createProfile)
  const updateProfile = useStore((s) => s.updateProfile)
  const setCustomAccessories = useStore((s) => s.setCustomAccessories)
  const setCustomSupplemental = useStore((s) => s.setCustomSupplemental)

  const [step, setStep] = useState<1 | 2 | 3>(1)

  // Step 1 state
  const [squat, setSquat] = useState('')
  const [bench, setBench] = useState('')
  const [deadlift, setDeadlift] = useState('')
  const [press, setPress] = useState('')
  const [bodyWeight, setBodyWeight] = useState('')

  // Step 1 state
  const [units, setUnits] = useState<Units>('lbs')
  const [tmPercentage, setTmPercentage] = useState<85 | 90>(90)
  const [sex, setSex] = useState<'male' | 'female'>('male')

  // Step 2 state — program & variant selection
  const [selectedProgram, setSelectedProgram] = useState<ProgramTypeT>(ProgramType.FiveThreeOne)
  const [selectedVariant, setSelectedVariant] = useState<ProgramVariant>(ProgramVariant.BBB)

  // Step 3 state — accessories (empty by default)
  const [dayAccessories, setDayAccessories] = useState<Record<number, AccessoryExercise[]>>(() => {
    const m: Record<number, AccessoryExercise[]> = {}
    for (const lift of MAIN_LIFTS) {
      m[lift] = []
    }
    return m
  })

  // When the user picks a program in step 2, seed the day-by-day plan with that
  // program's default accessories. For hypertrophy we also lock TM% to 85.
  function pickProgram(program: ProgramTypeT) {
    setSelectedProgram(program)
    if (program === ProgramType.Hypertrophy) {
      const m: Record<number, AccessoryExercise[]> = {}
      for (const lift of MAIN_LIFTS) {
        m[lift] = getHypertrophyAccessories(lift).map((ex) => ({ ...ex }))
      }
      setDayAccessories(m)
      setTmPercentage(85)
    } else {
      const m: Record<number, AccessoryExercise[]> = {}
      for (const lift of MAIN_LIFTS) m[lift] = []
      setDayAccessories(m)
    }
  }

  // Step 3 state — supplemental overrides (empty by default)
  const [daySupplemental, setDaySupplemental] = useState<Record<number, SupplementalOverride>>({})

  // Step 3 state — training-week lift order (5/3/1 only); defaults to the standard order
  const [dayOrder, setDayOrder] = useState<MainLift[]>(() => [...MAIN_LIFTS])

  const values = [squat, bench, deadlift, press].map(Number)
  const allValid = values.every((v) => v > 0)

  function handleContinue() {
    if (!allValid) return
    setStep(2)
  }

  function handleStart() {
    createProfile(values[0], values[1], values[2], values[3], selectedVariant, tmPercentage, sex, units, selectedProgram)
    const bw = Number(bodyWeight)
    updateProfile({
      dayOrder,
      ...(bw > 0 ? { bodyWeightLbs: toStorageLbs(bw, units), bodyWeightLastUpdated: new Date().toISOString() } : {}),
    })
    setCustomAccessories(dayAccessories)
    setCustomSupplemental(
      selectedProgram === ProgramType.Hypertrophy
        ? null
        : (Object.keys(daySupplemental).length > 0 ? daySupplemental : null),
    )
  }

  const fields = [
    { label: 'Squat', value: squat, set: setSquat },
    { label: 'Bench Press', value: bench, set: setBench },
    { label: 'Deadlift', value: deadlift, set: setDeadlift },
    { label: 'Overhead Press', value: press, set: setPress },
  ]

  // ---- Step 3: Workout Plan Review ----
  if (step === 3) {
    return (
      <div className="min-h-full flex flex-col p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Review Workout Plan</h1>
          <p className="text-sm text-[#8e8e93]">
            Add accessories or swap the supplemental for any day. You can change these again after each cycle.
          </p>
        </div>

        {selectedProgram !== ProgramType.Hypertrophy && (
          <div className="mb-4">
            <DayOrderEditor dayOrder={dayOrder} onChange={setDayOrder} />
          </div>
        )}

        <WorkoutPlanEditor
          accessories={dayAccessories}
          onAccessoriesChange={setDayAccessories}
          supplemental={daySupplemental}
          onSupplementalChange={setDaySupplemental}
          variantConfig={getVariantConfig(selectedVariant)}
          units={units}
          programType={selectedProgram}
          dayOrder={selectedProgram === ProgramType.Hypertrophy ? undefined : dayOrder}
        />

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

  // ---- Step 2: Program Selection ----
  if (step === 2) {
    const isHypertrophy = selectedProgram === ProgramType.Hypertrophy
    return (
      <div className="min-h-full flex flex-col p-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold mb-2">Choose Your Program</h1>
          <p className="text-sm text-[#8e8e93]">
            Pick the training program you'll follow. You can switch later from Settings.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2 mb-4">
          {([ProgramType.FiveThreeOne, ProgramType.Hypertrophy] as ProgramTypeT[]).map((p) => {
            const isSelected = selectedProgram === p
            return (
              <button
                key={p}
                onClick={() => pickProgram(p)}
                className={`rounded-lg p-3 text-left transition-colors ${
                  isSelected
                    ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
                    : 'border border-[#38383a] bg-[#1c1c1e]'
                }`}
              >
                <div className="font-semibold text-sm">
                  {p === ProgramType.FiveThreeOne ? '5/3/1' : '4-Day Hypertrophy'}
                </div>
                <div className="text-xs text-[#8e8e93] mt-1">
                  {p === ProgramType.FiveThreeOne
                    ? 'Top-set AMRAP percentages over 3-week cycles'
                    : 'Top-set RPE 8 + double-progression accessories, 7-week cycles'}
                </div>
              </button>
            )
          })}
        </div>

        {!isHypertrophy && (
          <>
            <h2 className="text-xs uppercase tracking-wider text-[#8e8e93] mt-2 mb-2">
              Supplemental Variant
            </h2>
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
          </>
        )}

        {isHypertrophy && (
          <div className="bg-[#1c1c1e] rounded-xl p-4 text-xs text-[#8e8e93]">
            <div className="text-white text-sm font-semibold mb-1">Hypertrophy notes</div>
            Training maxes are computed at 85% of 1RM. Top set is autoregulated by RPE (cap at RPE 8 / 2 RIR).
            Accessories run on double progression — when all sets hit the top of the range, the suggested weight bumps up.
            Cardio days from the spec are not tracked here.
          </div>
        )}

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
    <div className="min-h-full flex flex-col items-center p-6">
      <div className="w-full max-w-sm my-auto">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold mb-2">My Workouts</h1>
          <p className="text-sm text-[#8e8e93]">
            Enter your current one-rep maxes to get started with the 5/3/1 program.
          </p>
        </div>

        {/* Units Toggle */}
        <div className="mb-6">
          <label className="block text-sm text-[#8e8e93] mb-2">Units</label>
          <div className="flex gap-2">
            {(['lbs', 'kg'] as const).map((u) => (
              <button
                key={u}
                onClick={() => setUnits(u)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  units === u
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[#2c2c2e] text-[#8e8e93]'
                }`}
              >
                {u}
              </button>
            ))}
          </div>
        </div>

        {/* 1RM Inputs */}
        <div className="space-y-4 mb-6">
          {fields.map((f) => (
            <div key={f.label}>
              <label className="block text-sm text-[#8e8e93] mb-1">{f.label} 1RM ({units})</label>
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

        {/* Body Weight & Sex (for Wilks) */}
        <div className="mb-6">
          <label className="block text-sm text-[#8e8e93] mb-1">Body Weight ({units})</label>
          <input
            type="number"
            inputMode="decimal"
            placeholder="Optional — used for Wilks score"
            value={bodyWeight}
            onChange={(e) => setBodyWeight(e.target.value)}
            className="w-full"
          />
        </div>
        <div className="mb-6">
          <label className="block text-sm text-[#8e8e93] mb-2">Sex (for Wilks score)</label>
          <div className="flex gap-2">
            {(['male', 'female'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSex(s)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  sex === s
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[#2c2c2e] text-[#8e8e93]'
                }`}
              >
                {s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* TM Percentage */}
        <div className="mb-6">
          <label className="block text-sm text-[#8e8e93] mb-2">Training Max Percentage</label>
          <div className="flex gap-2">
            {([85, 90] as const).map((pct) => (
              <button
                key={pct}
                onClick={() => setTmPercentage(pct)}
                className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-colors ${
                  tmPercentage === pct
                    ? 'bg-[var(--color-accent)] text-white'
                    : 'bg-[#2c2c2e] text-[#8e8e93]'
                }`}
              >
                {pct}%{pct === 85 ? ' (beginner)' : ''}
              </button>
            ))}
          </div>
        </div>

        {/* TM Preview */}
        {allValid && (
          <div className="bg-[#1c1c1e] rounded-xl p-4 mb-6">
            <h3 className="text-xs text-[#8e8e93] uppercase tracking-wider mb-3">Training Maxes ({tmPercentage}%)</h3>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((f, i) => (
                <div key={f.label} className="text-center">
                  <div className="text-xs text-[#8e8e93]">{f.label}</div>
                  <div className="text-lg font-bold text-[var(--color-accent)]">
                    {roundWeight(values[i] * tmPercentage / 100, units)} {units}
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
