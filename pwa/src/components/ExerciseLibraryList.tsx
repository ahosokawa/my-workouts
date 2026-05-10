import { AccessoryWeightType } from '../types'
import type { ExerciseDef, AccessoryExercise } from '../types'

interface ExerciseLibraryListProps<T extends ExerciseDef> {
  available: T[]
  onPick: (def: T) => void
  /** Optional renderer for the secondary line under the name (e.g. "3x10 (Barbell)"). */
  secondary?: (def: T) => string
}

/**
 * Reusable list of library/saved exercises with a per-row "Add" button.
 * Caller is responsible for filtering (e.g., excluding already-added items).
 *
 * Generic over the exercise type so callers can pass either bare ExerciseDef
 * (e.g., supplemental override picker) or a richer subtype like AccessoryExercise.
 */
export default function ExerciseLibraryList<T extends ExerciseDef>({
  available,
  onPick,
  secondary,
}: ExerciseLibraryListProps<T>) {
  if (available.length === 0) return null

  return (
    <div className="divide-y divide-[#38383a] bg-[#1c1c1e] rounded-xl overflow-hidden">
      {available.map((ex) => (
        <button
          key={ex.id + ex.name}
          onClick={() => onPick(ex)}
          className="w-full flex items-center justify-between px-4 py-3 text-left active:opacity-70"
        >
          <div>
            <div className="text-sm">{ex.name}</div>
            <div className="text-xs text-[#8e8e93]">
              {secondary ? secondary(ex) : describeWeightType(ex.weightType)}
            </div>
          </div>
          <span className="text-[var(--color-accent)] text-sm">Add</span>
        </button>
      ))}
    </div>
  )
}

function describeWeightType(weightType: AccessoryWeightType): string {
  switch (weightType) {
    case AccessoryWeightType.Barbell: return 'Barbell'
    case AccessoryWeightType.Bodyweight: return 'Bodyweight'
    case AccessoryWeightType.NoWeight: return 'No Weight'
    case AccessoryWeightType.Standard: return 'Standard'
  }
}

/** Format an AccessoryExercise's secondary line as "{sets}x{reps} (Type)". */
export function accessorySecondary(ex: AccessoryExercise): string {
  const wt = describeWeightType(ex.weightType)
  return `${ex.sets}x${ex.reps}${wt && wt !== 'Standard' ? ` (${wt === 'Bodyweight' ? 'BW' : wt === 'No Weight' ? 'no weight' : wt})` : ''}`
}
