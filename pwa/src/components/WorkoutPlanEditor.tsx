import { useMemo, useState } from 'react'
import { useStore, generateId } from '../store'
import {
  MainLift,
  MAIN_LIFTS,
  liftDisplayName,
  AccessoryWeightType,
  ProgramType,
  ProgressionType,
  toStorageLbs,
  displayRound,
} from '../types'
import type { AccessoryExercise, ExerciseDef, SupplementalOverride, Units, ProgramType as ProgramTypeT, ProgressionType as ProgressionTypeT } from '../types'
import type { VariantConfig } from '../logic/variants'
import { roundWeight } from '../logic/calculator'
import { getAccessories, getHypertrophyAccessories } from '../logic/accessories'
import { hypertrophyDayLabel, dayHasTopSetMain } from '../logic/hypertrophyCalculator'
import ExerciseDefFields from './ExerciseDefFields'
import ExerciseLibraryList, { accessorySecondary } from './ExerciseLibraryList'

interface WorkoutPlanEditorProps {
  accessories: Record<number, AccessoryExercise[]>
  onAccessoriesChange: (next: Record<number, AccessoryExercise[]>) => void
  supplemental: Record<number, SupplementalOverride>
  onSupplementalChange: (next: Record<number, SupplementalOverride>) => void
  variantConfig: VariantConfig
  units: Units
  programType?: ProgramTypeT  // defaults to '531' for backwards-compat with existing callers
  dayOrder?: readonly MainLift[]  // training-week lift order; defaults to MAIN_LIFTS
}

type AccessoryModal = { lift: MainLift } | null
type SupplementalModal = { lift: MainLift } | null

/**
 * Day-by-day workout plan editor.
 * Each day card expands to show its supplemental override + accessory list,
 * keeping all customization for a given lift in one place.
 *
 * The exercise library is context-free: a single union of saved exercises,
 * exercises currently in use as accessories, exercises in use as supplemental
 * overrides, and per-lift default accessory suggestions. Sets/reps and TM are
 * gathered per-use, not stored on the exercise identity.
 */
export default function WorkoutPlanEditor({
  accessories,
  onAccessoriesChange,
  supplemental,
  onSupplementalChange,
  variantConfig,
  units,
  programType = ProgramType.FiveThreeOne,
  dayOrder = MAIN_LIFTS,
}: WorkoutPlanEditorProps) {
  const savedExercises = useStore((s) => s.savedExercises)
  const addSavedExercise = useStore((s) => s.addSavedExercise)
  const isHypertrophy = programType === ProgramType.Hypertrophy

  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  // Accessory modal state — the form is shared between "create new" and "pick from library + fill in sets/reps"
  const [accModal, setAccModal] = useState<AccessoryModal>(null)
  const [showAccForm, setShowAccForm] = useState(false)
  const [accName, setAccName] = useState('')
  const [accSets, setAccSets] = useState('3')
  const [accReps, setAccReps] = useState('10')
  const [accRepMin, setAccRepMin] = useState('')
  const [accRepMax, setAccRepMax] = useState('')
  const [accProgressionType, setAccProgressionType] = useState<ProgressionTypeT>(ProgressionType.Double)
  const [accWeightType, setAccWeightType] = useState<AccessoryWeightType>(AccessoryWeightType.Standard)

  // Supplemental modal state
  const [suppModal, setSuppModal] = useState<SupplementalModal>(null)
  const [showSuppForm, setShowSuppForm] = useState(false)
  const [suppName, setSuppName] = useState('')
  const [suppWeightType, setSuppWeightType] = useState<AccessoryWeightType>(AccessoryWeightType.Barbell)
  const [suppTM, setSuppTM] = useState('')

  function toggleDay(lift: MainLift) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(lift)) next.delete(lift)
      else next.add(lift)
      return next
    })
  }

  // ---- Unified exercise library ----

  /** Look up sane defaults for an exercise name in the context of `lift`.
   *  Returns sets/reps plus (for hypertrophy) rep range and progression type. */
  function defaultsFor(lift: MainLift, name: string): {
    sets: number
    reps: number
    repRangeMin?: number
    repRangeMax?: number
    progressionType?: ProgressionTypeT
  } {
    const lower = name.toLowerCase()
    const defs = isHypertrophy ? getHypertrophyAccessories(lift) : getAccessories(lift)
    for (const def of defs) {
      if (def.name.toLowerCase() === lower) return {
        sets: def.sets,
        reps: def.reps,
        repRangeMin: def.repRangeMin,
        repRangeMax: def.repRangeMax,
        progressionType: def.progressionType,
      }
    }
    for (const day of Object.values(accessories)) {
      for (const ex of day ?? []) {
        if (ex.name.toLowerCase() === lower) return {
          sets: ex.sets,
          reps: ex.reps,
          repRangeMin: ex.repRangeMin,
          repRangeMax: ex.repRangeMax,
          progressionType: ex.progressionType,
        }
      }
    }
    return { sets: 3, reps: 10 }
  }

  /** All exercises the user could pick (context-free), keyed by lowercase name.
   *  Sources: savedExercises ∪ in-use customAccessories (any day) ∪ in-use
   *  customSupplemental overrides ∪ per-lift default accessory suggestions. */
  const libraryByLift = useMemo(() => {
    const buildFor = (lift: MainLift): ExerciseDef[] => {
      const map = new Map<string, ExerciseDef>()
      const add = (ex: ExerciseDef) => {
        const k = ex.name.toLowerCase()
        if (!map.has(k)) map.set(k, { id: ex.id, name: ex.name, weightType: ex.weightType })
      }
      for (const ex of savedExercises) add(ex)
      for (const day of Object.values(accessories)) {
        for (const ex of day ?? []) add(ex)
      }
      for (const o of Object.values(supplemental)) {
        if (o) add(o.exercise)
      }
      const defaults = isHypertrophy ? getHypertrophyAccessories(lift) : getAccessories(lift)
      for (const ex of defaults) add(ex)
      return Array.from(map.values())
    }
    const m: Record<number, ExerciseDef[]> = {}
    for (const lift of MAIN_LIFTS) m[lift] = buildFor(lift)
    return m
  }, [savedExercises, accessories, supplemental, isHypertrophy])

  // ---- Accessory helpers ----

  function resetAccForm() {
    setShowAccForm(false)
    setAccName('')
    setAccSets('3')
    setAccReps('10')
    setAccRepMin('')
    setAccRepMax('')
    setAccProgressionType(ProgressionType.Double)
    setAccWeightType(AccessoryWeightType.Standard)
  }

  function openAccModal(lift: MainLift) {
    setAccModal({ lift })
    resetAccForm()
  }

  function closeAccModal() {
    setAccModal(null)
    resetAccForm()
  }

  function pickAccFromLibrary(lift: MainLift, def: ExerciseDef) {
    const d = defaultsFor(lift, def.name)
    setShowAccForm(true)
    setAccName(def.name)
    setAccWeightType(def.weightType)
    setAccSets(String(d.sets))
    setAccReps(String(d.reps))
    if (d.repRangeMin !== undefined) setAccRepMin(String(d.repRangeMin))
    if (d.repRangeMax !== undefined) setAccRepMax(String(d.repRangeMax))
    if (d.progressionType) setAccProgressionType(d.progressionType)
  }

  function saveAccessory(lift: MainLift) {
    const name = accName.trim()
    if (!name) return
    const minN = Number(accRepMin)
    const maxN = Number(accRepMax)
    const hasRange = isHypertrophy && minN > 0 && maxN > 0 && maxN >= minN
    const newEx: AccessoryExercise = {
      id: generateId(),
      name,
      sets: Math.max(1, Number(accSets) || 3),
      reps: Math.max(1, Number(accReps) || (hasRange ? minN : 10)),
      weightType: accWeightType,
      ...(hasRange ? { repRangeMin: minN, repRangeMax: maxN } : {}),
      ...(isHypertrophy ? { progressionType: accProgressionType } : {}),
    }
    onAccessoriesChange({
      ...accessories,
      [lift]: [...(accessories[lift] ?? []), newEx],
    })
    addSavedExercise({ id: newEx.id, name: newEx.name, weightType: newEx.weightType })
    closeAccModal()
  }

  function removeAccessory(lift: MainLift, exerciseId: string) {
    onAccessoriesChange({
      ...accessories,
      [lift]: (accessories[lift] ?? []).filter((ex) => ex.id !== exerciseId),
    })
  }

  function availableAccessoryLibrary(lift: MainLift): ExerciseDef[] {
    const currentNames = new Set((accessories[lift] ?? []).map((ex) => ex.name.toLowerCase()))
    return libraryByLift[lift].filter((ex) => !currentNames.has(ex.name.toLowerCase()))
  }

  // ---- Supplemental helpers ----

  function resetSuppForm() {
    setShowSuppForm(false)
    setSuppName('')
    setSuppWeightType(AccessoryWeightType.Barbell)
    setSuppTM('')
  }

  function openSuppModal(lift: MainLift) {
    setSuppModal({ lift })
    resetSuppForm()
    const existing = supplemental[lift]
    if (existing) {
      setShowSuppForm(true)
      setSuppName(existing.exercise.name)
      setSuppWeightType(existing.exercise.weightType)
      setSuppTM(String(displayRound(existing.trainingMaxLbs, units)))
    }
  }

  function closeSuppModal() {
    setSuppModal(null)
    resetSuppForm()
  }

  function pickSuppFromLibrary(def: ExerciseDef) {
    setShowSuppForm(true)
    setSuppName(def.name)
    setSuppWeightType(def.weightType)
    setSuppTM('')
  }

  function saveSupplemental(lift: MainLift) {
    const name = suppName.trim()
    const tmDisplay = Number(suppTM)
    if (!name || !(tmDisplay > 0)) return
    const trainingMaxLbs = toStorageLbs(tmDisplay, units)
    const exercise: ExerciseDef = { id: generateId(), name, weightType: suppWeightType }
    onSupplementalChange({ ...supplemental, [lift]: { exercise, trainingMaxLbs } })
    addSavedExercise(exercise)
    closeSuppModal()
  }

  function clearSupplemental(lift: MainLift) {
    const next = { ...supplemental }
    delete next[lift]
    onSupplementalChange(next)
  }

  function availableSuppLibrary(lift: MainLift): ExerciseDef[] {
    const currentName = supplemental[lift]?.exercise.name.toLowerCase()
    return libraryByLift[lift].filter((ex) => ex.name.toLowerCase() !== currentName)
  }

  function suppPreviewWeight(): number | null {
    const tmDisplay = Number(suppTM)
    if (!(tmDisplay > 0)) return null
    const tmLbs = toStorageLbs(tmDisplay, units)
    return displayRound(roundWeight(tmLbs * variantConfig.supplementalPercentage(1)), units)
  }

  // ---- Render helpers ----

  function suppSummary(lift: MainLift): string {
    const o = supplemental[lift]
    const name = o?.exercise.name ?? liftDisplayName(lift)
    return `${variantConfig.shortLabel} ${variantConfig.supplementalSets}×${variantConfig.supplementalReps} – ${name}`
  }

  function dayHeaderLabel(lift: MainLift, dayIndex: number): string {
    if (isHypertrophy) return hypertrophyDayLabel(dayIndex + 1)
    return `Day ${dayIndex + 1} – ${liftDisplayName(lift)}`
  }

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-[#8e8e93] px-1">Workout Plan by Day</h2>
        {dayOrder.map((lift, dayIndex) => {
          const isExpanded = expandedDays.has(lift)
          const dayAccessories = accessories[lift] ?? []
          const override = supplemental[lift]
          const hasTopSet = !isHypertrophy || dayHasTopSetMain(programType, dayIndex + 1)
          return (
            <div key={lift} className="bg-[#1c1c1e] rounded-xl overflow-hidden">
              <button
                onClick={() => toggleDay(lift)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <span className="font-medium text-sm">
                    {dayHeaderLabel(lift, dayIndex)}
                  </span>
                  <span className="text-xs text-[#8e8e93] ml-2">
                    {isHypertrophy
                      ? (hasTopSet ? `Top set: ${liftDisplayName(lift)}` : 'No top-set main')
                      : suppSummary(lift)}
                    {' · '}
                    {dayAccessories.length} {dayAccessories.length === 1 ? 'accessory' : 'accessories'}
                  </span>
                </div>
                <span className={`text-[#8e8e93] text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>

              {isExpanded && (
                <div className="px-4 pb-3 space-y-4">
                  {/* Supplemental (5/3/1 only) */}
                  {!isHypertrophy && (
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wider text-[#8e8e93] mb-2">Supplemental</h3>
                    <div className="bg-[#2c2c2e] rounded-lg px-3 py-2.5">
                      <div className="text-sm">{suppSummary(lift)}</div>
                      {override && (
                        <div className="text-xs text-[#8e8e93] mt-0.5">
                          @ {displayRound(roundWeight(override.trainingMaxLbs * variantConfig.supplementalPercentage(1)), units)} {units} (week 1)
                          <span className="text-[#48484a]"> · TM {displayRound(override.trainingMaxLbs, units)} {units}</span>
                        </div>
                      )}
                      <div className="flex gap-2 mt-2">
                        <button
                          onClick={() => openSuppModal(lift)}
                          className="flex-1 py-1.5 text-xs text-[var(--color-accent)] text-center rounded-md bg-[#1c1c1e]"
                        >
                          {override ? 'Edit Override' : 'Override'}
                        </button>
                        {override && (
                          <button
                            onClick={() => clearSupplemental(lift)}
                            className="flex-1 py-1.5 text-xs text-[var(--color-red)] text-center rounded-md bg-[#1c1c1e]"
                          >
                            Use {liftDisplayName(lift)}
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                  )}

                  {/* Accessories */}
                  <div>
                    <h3 className="text-[11px] uppercase tracking-wider text-[#8e8e93] mb-2">Accessories</h3>
                    {dayAccessories.length === 0 && (
                      <p className="text-xs text-[#8e8e93] py-1">No accessories. Tap below to add.</p>
                    )}
                    {dayAccessories.length > 0 && (
                      <div className="divide-y divide-[#38383a] bg-[#2c2c2e] rounded-lg">
                        {dayAccessories.map((ex) => (
                          <div key={ex.id} className="flex items-center justify-between px-3 py-2.5">
                            <div>
                              <div className="text-sm">{ex.name}</div>
                              <div className="text-xs text-[#8e8e93]">{accessorySecondary(ex)}</div>
                            </div>
                            <button
                              onClick={() => removeAccessory(lift, ex.id)}
                              className="text-[var(--color-red)] text-sm px-2 py-1"
                            >
                              Remove
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                    <button
                      onClick={() => openAccModal(lift)}
                      className="w-full mt-2 py-2 text-sm text-[var(--color-accent)] text-center rounded-lg bg-[#2c2c2e]"
                    >
                      + Add Accessory
                    </button>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Accessory modal */}
      {accModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={closeAccModal}
        >
          <div
            className="bg-[#2c2c2e] rounded-t-2xl w-full max-w-md max-h-[80vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-semibold text-base">Add Accessory &ndash; {liftDisplayName(accModal.lift)}</h3>
              <button onClick={closeAccModal} className="text-[#8e8e93] text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {!showAccForm && (
                <>
                  {(() => {
                    const available = availableAccessoryLibrary(accModal.lift)
                    if (available.length === 0) return null
                    return (
                      <div className="mb-4">
                        <h4 className="text-xs uppercase tracking-wider text-[#8e8e93] mb-2">Exercise Library</h4>
                        <ExerciseLibraryList
                          available={available}
                          onPick={(def) => pickAccFromLibrary(accModal.lift, def)}
                        />
                      </div>
                    )
                  })()}
                  <button
                    onClick={() => setShowAccForm(true)}
                    className="w-full py-3 text-sm font-medium text-[var(--color-accent)] text-center rounded-xl bg-[#1c1c1e]"
                  >
                    Create New Exercise
                  </button>
                </>
              )}

              {showAccForm && (
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-[#8e8e93]">
                    {accName ? 'Configure Accessory' : 'New Exercise'}
                  </h4>
                  <ExerciseDefFields
                    name={accName}
                    weightType={accWeightType}
                    onNameChange={setAccName}
                    onWeightTypeChange={setAccWeightType}
                    autoFocusName={!accName}
                  />
                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-[#8e8e93] mb-1">Sets</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={accSets}
                        onChange={(e) => setAccSets(e.target.value)}
                        className="w-full text-sm"
                      />
                    </div>
                    {isHypertrophy ? (
                      <>
                        <div className="flex-1">
                          <label className="block text-sm text-[#8e8e93] mb-1">Min reps</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="8"
                            value={accRepMin}
                            onChange={(e) => setAccRepMin(e.target.value)}
                            className="w-full text-sm"
                          />
                        </div>
                        <div className="flex-1">
                          <label className="block text-sm text-[#8e8e93] mb-1">Max reps</label>
                          <input
                            type="number"
                            inputMode="numeric"
                            placeholder="10"
                            value={accRepMax}
                            onChange={(e) => setAccRepMax(e.target.value)}
                            className="w-full text-sm"
                          />
                        </div>
                      </>
                    ) : (
                      <div className="flex-1">
                        <label className="block text-sm text-[#8e8e93] mb-1">Reps</label>
                        <input
                          type="number"
                          inputMode="numeric"
                          value={accReps}
                          onChange={(e) => setAccReps(e.target.value)}
                          className="w-full text-sm"
                        />
                      </div>
                    )}
                  </div>
                  {isHypertrophy && (
                    <div>
                      <label className="block text-sm text-[#8e8e93] mb-1">Progression</label>
                      <select
                        value={accProgressionType}
                        onChange={(e) => setAccProgressionType(e.target.value as ProgressionTypeT)}
                        className="w-full text-sm bg-[#1c1c1e] rounded-md px-2 py-2"
                      >
                        <option value={ProgressionType.Double}>Double progression</option>
                        <option value={ProgressionType.RepsThenLoad}>Reps then load</option>
                        <option value={ProgressionType.RepsOnly}>Reps only (no autoprogress)</option>
                        <option value={ProgressionType.RomStages}>ROM stages (manual)</option>
                        <option value={ProgressionType.Fixed}>Fixed sets × reps</option>
                      </select>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetAccForm} className="flex-1 py-2.5 rounded-lg bg-[#38383a] text-sm">
                      Back
                    </button>
                    <button
                      onClick={() => saveAccessory(accModal.lift)}
                      disabled={!accName.trim()}
                      className="flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Add Exercise
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Supplemental modal */}
      {suppModal !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={closeSuppModal}
        >
          <div
            className="bg-[#2c2c2e] rounded-t-2xl w-full max-w-md max-h-[80vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-semibold text-base">Supplemental Override &ndash; {liftDisplayName(suppModal.lift)}</h3>
              <button onClick={closeSuppModal} className="text-[#8e8e93] text-lg leading-none">✕</button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {!showSuppForm && (
                <>
                  {(() => {
                    const available = availableSuppLibrary(suppModal.lift)
                    if (available.length === 0) return null
                    return (
                      <div className="mb-4">
                        <h4 className="text-xs uppercase tracking-wider text-[#8e8e93] mb-2">Exercise Library</h4>
                        <ExerciseLibraryList available={available} onPick={pickSuppFromLibrary} />
                      </div>
                    )
                  })()}
                  <button
                    onClick={() => setShowSuppForm(true)}
                    className="w-full py-3 text-sm font-medium text-[var(--color-accent)] text-center rounded-xl bg-[#1c1c1e]"
                  >
                    Create New Exercise
                  </button>
                </>
              )}

              {showSuppForm && (
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-[#8e8e93]">
                    {suppName ? 'Configure Override' : 'New Override'}
                  </h4>
                  <ExerciseDefFields
                    name={suppName}
                    weightType={suppWeightType}
                    onNameChange={setSuppName}
                    onWeightTypeChange={setSuppWeightType}
                    autoFocusName={!suppName}
                  />
                  <div>
                    <label className="block text-sm text-[#8e8e93] mb-1">Training Max ({units})</label>
                    <input
                      type="number"
                      inputMode="decimal"
                      placeholder={units === 'kg' ? 'e.g. 110' : 'e.g. 250'}
                      value={suppTM}
                      onChange={(e) => setSuppTM(e.target.value)}
                      className="w-full text-sm"
                      autoFocus={!!suppName}
                    />
                  </div>
                  {suppPreviewWeight() !== null && (
                    <div className="text-xs text-[#8e8e93]">
                      Preview · Week 1: {variantConfig.supplementalSets}×{variantConfig.supplementalReps} @ {suppPreviewWeight()} {units}
                      <span className="text-[#48484a]"> ({Math.round(variantConfig.supplementalPercentage(1) * 100)}% of TM)</span>
                    </div>
                  )}
                  <div className="flex gap-3 pt-2">
                    <button onClick={resetSuppForm} className="flex-1 py-2.5 rounded-lg bg-[#38383a] text-sm">
                      Back
                    </button>
                    <button
                      onClick={() => saveSupplemental(suppModal.lift)}
                      disabled={!suppName.trim() || !(Number(suppTM) > 0)}
                      className="flex-1 py-2.5 rounded-lg bg-[var(--color-accent)] text-sm font-semibold text-white disabled:opacity-40"
                    >
                      Save Override
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
