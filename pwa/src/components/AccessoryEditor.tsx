import { useState } from 'react'
import { useStore, generateId } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName, AccessoryWeightType } from '../types'
import type { AccessoryExercise } from '../types'
import { getAccessories } from '../logic/accessories'

interface AccessoryEditorProps {
  /** Current per-day accessories keyed by MainLift value */
  value: Record<number, AccessoryExercise[]>
  /** Called whenever the accessories change */
  onChange: (next: Record<number, AccessoryExercise[]>) => void
}

/**
 * Self-contained day-by-day accessory exercise editor.
 * Shows collapsible sections per main-lift day with add / remove controls
 * and an exercise-library modal for adding exercises.
 */
export default function AccessoryEditor({ value, onChange }: AccessoryEditorProps) {
  const savedExercises = useStore((s) => s.savedExercises)
  const addSavedExercise = useStore((s) => s.addSavedExercise)

  // Track which days are expanded
  const [expandedDays, setExpandedDays] = useState<Set<number>>(new Set())

  // Add-exercise modal state
  const [addModalLift, setAddModalLift] = useState<MainLift | null>(null)
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newExName, setNewExName] = useState('')
  const [newExSets, setNewExSets] = useState('3')
  const [newExReps, setNewExReps] = useState('10')
  const [newExWeightType, setNewExWeightType] = useState<AccessoryWeightType>(AccessoryWeightType.Standard)

  function toggleDay(lift: MainLift) {
    setExpandedDays((prev) => {
      const next = new Set(prev)
      if (next.has(lift)) next.delete(lift)
      else next.add(lift)
      return next
    })
  }

  function removeAccessory(lift: MainLift, exerciseId: string) {
    onChange({
      ...value,
      [lift]: value[lift].filter((ex) => ex.id !== exerciseId),
    })
  }

  function addExerciseToDay(lift: MainLift, exercise: AccessoryExercise) {
    const newEx: AccessoryExercise = { ...exercise, id: generateId() }
    onChange({
      ...value,
      [lift]: [...value[lift], newEx],
    })
    // Also save to library for future use
    addSavedExercise(exercise)
    setAddModalLift(null)
    resetCreateForm()
  }

  function handleCreateExercise(lift: MainLift) {
    const name = newExName.trim()
    if (!name) return
    const sets = Math.max(1, Number(newExSets) || 3)
    const reps = Math.max(1, Number(newExReps) || 10)
    const exercise: AccessoryExercise = {
      id: generateId(),
      name,
      sets,
      reps,
      weightType: newExWeightType,
    }
    addExerciseToDay(lift, exercise)
  }

  function resetCreateForm() {
    setShowCreateForm(false)
    setNewExName('')
    setNewExSets('3')
    setNewExReps('10')
    setNewExWeightType(AccessoryWeightType.Standard)
  }

  function openAddModal(lift: MainLift) {
    setAddModalLift(lift)
    setShowCreateForm(false)
    resetCreateForm()
  }

  // Build a list of library exercises not already in the current day
  function availableLibraryExercises(lift: MainLift): AccessoryExercise[] {
    const currentNames = new Set(value[lift].map((ex) => ex.name.toLowerCase()))
    const allDefaults = getAccessories(lift)
    const combined = new Map<string, AccessoryExercise>()
    for (const ex of allDefaults) combined.set(ex.name.toLowerCase(), ex)
    for (const ex of savedExercises) combined.set(ex.name.toLowerCase(), ex)
    return Array.from(combined.values()).filter((ex) => !currentNames.has(ex.name.toLowerCase()))
  }

  return (
    <>
      <div className="space-y-3">
        <h2 className="text-xs uppercase tracking-wider text-[#8e8e93] px-1">Accessories by Day</h2>
        {MAIN_LIFTS.map((lift, dayIndex) => {
          const isExpanded = expandedDays.has(lift)
          const exercises = value[lift]
          return (
            <div key={lift} className="bg-[#1c1c1e] rounded-xl overflow-hidden">
              {/* Collapsible header */}
              <button
                onClick={() => toggleDay(lift)}
                className="w-full flex items-center justify-between px-4 py-3 text-left"
              >
                <div>
                  <span className="font-medium text-sm">Day {dayIndex + 1} &ndash; {liftDisplayName(lift)}</span>
                  <span className="text-xs text-[#8e8e93] ml-2">
                    {exercises.length} {exercises.length === 1 ? 'exercise' : 'exercises'}
                  </span>
                </div>
                <span className={`text-[#8e8e93] text-sm transition-transform ${isExpanded ? 'rotate-90' : ''}`}>
                  ›
                </span>
              </button>

              {/* Expanded content */}
              {isExpanded && (
                <div className="px-4 pb-3">
                  {exercises.length === 0 && (
                    <p className="text-xs text-[#8e8e93] py-2">No accessories. Tap below to add.</p>
                  )}
                  <div className="divide-y divide-[#38383a]">
                    {exercises.map((ex) => (
                      <div key={ex.id} className="flex items-center justify-between py-2.5">
                        <div>
                          <div className="text-sm">{ex.name}</div>
                          <div className="text-xs text-[#8e8e93]">
                            {ex.sets}x{ex.reps}
                            {ex.weightType === AccessoryWeightType.Barbell && ' (Barbell)'}
                            {ex.weightType === AccessoryWeightType.Bodyweight && ' (BW)'}
                            {ex.weightType === AccessoryWeightType.NoWeight && ' (no weight)'}
                          </div>
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
                  <button
                    onClick={() => openAddModal(lift)}
                    className="w-full mt-2 py-2 text-sm text-[var(--color-accent)] text-center rounded-lg bg-[#2c2c2e]"
                  >
                    + Add Exercise
                  </button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Add Exercise Modal */}
      {addModalLift !== null && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/60"
          onClick={() => { setAddModalLift(null); resetCreateForm() }}
        >
          <div
            className="bg-[#2c2c2e] rounded-t-2xl w-full max-w-md max-h-[80vh] flex flex-col pb-safe"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal header */}
            <div className="flex items-center justify-between px-4 pt-4 pb-2">
              <h3 className="font-semibold text-base">
                Add Exercise &ndash; {liftDisplayName(addModalLift)}
              </h3>
              <button
                onClick={() => { setAddModalLift(null); resetCreateForm() }}
                className="text-[#8e8e93] text-lg leading-none"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 pb-4">
              {/* Library exercises */}
              {!showCreateForm && (
                <>
                  {(() => {
                    const available = availableLibraryExercises(addModalLift)
                    if (available.length > 0) {
                      return (
                        <div className="mb-4">
                          <h4 className="text-xs uppercase tracking-wider text-[#8e8e93] mb-2">Exercise Library</h4>
                          <div className="divide-y divide-[#38383a] bg-[#1c1c1e] rounded-xl overflow-hidden">
                            {available.map((ex) => (
                              <button
                                key={ex.id + ex.name}
                                onClick={() => addExerciseToDay(addModalLift, ex)}
                                className="w-full flex items-center justify-between px-4 py-3 text-left active:opacity-70"
                              >
                                <div>
                                  <div className="text-sm">{ex.name}</div>
                                  <div className="text-xs text-[#8e8e93]">
                                    {ex.sets}x{ex.reps}
                                    {ex.weightType === AccessoryWeightType.Barbell && ' (Barbell)'}
                                    {ex.weightType === AccessoryWeightType.Bodyweight && ' (BW)'}
                                    {ex.weightType === AccessoryWeightType.NoWeight && ' (no weight)'}
                                  </div>
                                </div>
                                <span className="text-[var(--color-accent)] text-sm">Add</span>
                              </button>
                            ))}
                          </div>
                        </div>
                      )
                    }
                    return null
                  })()}

                  <button
                    onClick={() => setShowCreateForm(true)}
                    className="w-full py-3 text-sm font-medium text-[var(--color-accent)] text-center rounded-xl bg-[#1c1c1e]"
                  >
                    Create New Exercise
                  </button>
                </>
              )}

              {/* Create exercise form */}
              {showCreateForm && (
                <div className="space-y-4">
                  <h4 className="text-xs uppercase tracking-wider text-[#8e8e93]">New Exercise</h4>

                  <div>
                    <label className="block text-sm text-[#8e8e93] mb-1">Name</label>
                    <input
                      type="text"
                      placeholder="e.g. Dumbbell Fly"
                      value={newExName}
                      onChange={(e) => setNewExName(e.target.value)}
                      className="w-full text-sm"
                      autoFocus
                    />
                  </div>

                  <div className="flex gap-3">
                    <div className="flex-1">
                      <label className="block text-sm text-[#8e8e93] mb-1">Sets</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={newExSets}
                        onChange={(e) => setNewExSets(e.target.value)}
                        className="w-full text-sm"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm text-[#8e8e93] mb-1">Reps</label>
                      <input
                        type="number"
                        inputMode="numeric"
                        value={newExReps}
                        onChange={(e) => setNewExReps(e.target.value)}
                        className="w-full text-sm"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm text-[#8e8e93] mb-2">Weight Type</label>
                    <div className="flex gap-2">
                      {([
                        { value: AccessoryWeightType.Standard, label: 'Standard' },
                        { value: AccessoryWeightType.Barbell, label: 'Barbell' },
                        { value: AccessoryWeightType.Bodyweight, label: 'Bodyweight' },
                        { value: AccessoryWeightType.NoWeight, label: 'No Weight' },
                      ] as const).map((opt) => (
                        <button
                          key={opt.value}
                          onClick={() => setNewExWeightType(opt.value)}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                            newExWeightType === opt.value
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[#38383a] text-[#8e8e93]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-3 pt-2">
                    <button
                      onClick={() => { resetCreateForm() }}
                      className="flex-1 py-2.5 rounded-lg bg-[#38383a] text-sm"
                    >
                      Back
                    </button>
                    <button
                      onClick={() => handleCreateExercise(addModalLift)}
                      disabled={!newExName.trim()}
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
    </>
  )
}
