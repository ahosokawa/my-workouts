import { AccessoryWeightType } from '../types'

interface ExerciseDefFieldsProps {
  name: string
  weightType: AccessoryWeightType
  onNameChange: (v: string) => void
  onWeightTypeChange: (v: AccessoryWeightType) => void
  autoFocusName?: boolean
}

const WEIGHT_TYPE_OPTIONS = [
  { value: AccessoryWeightType.Standard, label: 'Standard' },
  { value: AccessoryWeightType.Barbell, label: 'Barbell' },
  { value: AccessoryWeightType.Bodyweight, label: 'Bodyweight' },
  { value: AccessoryWeightType.NoWeight, label: 'No Weight' },
] as const

/**
 * Reusable form fields for the identity of an exercise: name + how it's weighted.
 * Composed by WorkoutPlanEditor — accessory creation wraps it with sets/reps fields,
 * supplemental-override creation wraps it with a TM input.
 */
export default function ExerciseDefFields({
  name,
  weightType,
  onNameChange,
  onWeightTypeChange,
  autoFocusName = false,
}: ExerciseDefFieldsProps) {
  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm text-[#8e8e93] mb-1">Name</label>
        <input
          type="text"
          placeholder="e.g. Front Squat"
          value={name}
          onChange={(e) => onNameChange(e.target.value)}
          className="w-full text-sm"
          autoFocus={autoFocusName}
        />
      </div>

      <div>
        <label className="block text-sm text-[#8e8e93] mb-2">Weight Type</label>
        <div className="flex gap-2">
          {WEIGHT_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onWeightTypeChange(opt.value)}
              className={`flex-1 py-2 text-xs font-medium rounded-lg transition-colors ${
                weightType === opt.value
                  ? 'bg-[var(--color-accent)] text-white'
                  : 'bg-[#38383a] text-[#8e8e93]'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
