import { ProgramType } from '../types'
import type { ProgramType as ProgramId } from '../types'
import { PROGRAMS } from '../logic/programs'

interface Props {
  value: ProgramId
  onChange: (program: ProgramId) => void
  disabled?: boolean
  compact?: boolean
}

/** Presentation-only grouping: selecting a style still uses its original
 * program ID, archive, and explicit activation flow. */
export default function ProgramPicker({ value, onChange, disabled, compact }: Props) {
  function choice(id: ProgramId, style?: string) {
    const program = PROGRAMS[id]
    return <button key={id} type="button" disabled={disabled}
      aria-label={program.label} aria-pressed={value === id}
      onClick={() => onChange(id)}
      className={`w-full rounded-lg p-3 text-left transition-colors disabled:opacity-50 ${value === id
        ? 'border-2 border-[var(--color-accent)] bg-[#2c2c2e]'
        : 'border border-[#38383a] bg-[#1c1c1e]'}`}>
      <div className="font-semibold text-sm">{style ?? program.label}</div>
      {!compact && <div className="text-xs text-[#8e8e93] mt-1">{program.description}</div>}
    </button>
  }
  return <div className="space-y-2">
    {choice(ProgramType.FiveThreeOne)}
    {choice(ProgramType.Hypertrophy)}
    <fieldset className="border border-[#38383a] rounded-xl p-3 space-y-2" disabled={disabled}>
      <legend className="px-1 text-sm font-semibold">Upper/Lower</legend>
      <p className="text-xs text-[#8e8e93]">Choose your training style</p>
      <div className={compact ? 'grid grid-cols-2 gap-2' : 'space-y-2'}>
        {choice(ProgramType.UpperLower, 'Top Set')}
        {choice(ProgramType.ChestArms, 'Hypertrophy')}
      </div>
    </fieldset>
  </div>
}
