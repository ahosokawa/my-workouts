import { liftDisplayName } from '../types'
import type { MainLift } from '../types'

interface DayOrderEditorProps {
  /** Current training-week lift order — a permutation of the four main lifts. */
  dayOrder: readonly MainLift[]
  /** Called with the new order after a swap. */
  onChange: (next: MainLift[]) => void
  /** When true, the reorder buttons are inert (e.g. mid-cycle in Settings). */
  disabled?: boolean
  /** Optional explanation shown below the list while `disabled`. */
  note?: string
}

/**
 * Self-contained card for reordering which main lift falls on each training day.
 * Shared by the cycle-boundary screens (onboarding, cycle completion) and the
 * read-only/gated view in Settings. 5/3/1 only — hypertrophy days have fixed
 * Lower/Upper-focus semantics, so callers omit this for that program.
 */
export default function DayOrderEditor({ dayOrder, onChange, disabled = false, note }: DayOrderEditorProps) {
  function moveDay(index: number, delta: number) {
    if (disabled) return
    const next = [...dayOrder]
    const j = index + delta
    if (j < 0 || j >= next.length) return
    ;[next[index], next[j]] = [next[j], next[index]]
    onChange(next)
  }

  return (
    <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
      <div className="px-4 pt-3 pb-1">
        <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Workout Day Order</h2>
      </div>
      <div className="px-4 pb-3 divide-y divide-[#38383a]">
        <div className="py-2 text-xs text-[#8e8e93]">
          Set which main lift falls on each training day.
        </div>
        {dayOrder.map((lift, i) => (
          <div key={lift} className="flex items-center justify-between py-2">
            <div>
              <div className="text-sm font-medium">Day {i + 1}</div>
              <div className="text-xs text-[#8e8e93]">{liftDisplayName(lift)}</div>
            </div>
            <div className="flex gap-1.5">
              <button
                onClick={() => moveDay(i, -1)}
                disabled={disabled || i === 0}
                aria-label={`Move ${liftDisplayName(lift)} earlier`}
                className="w-9 h-9 rounded-lg bg-[#38383a] text-base font-semibold disabled:opacity-30"
              >
                ↑
              </button>
              <button
                onClick={() => moveDay(i, 1)}
                disabled={disabled || i === dayOrder.length - 1}
                aria-label={`Move ${liftDisplayName(lift)} later`}
                className="w-9 h-9 rounded-lg bg-[#38383a] text-base font-semibold disabled:opacity-30"
              >
                ↓
              </button>
            </div>
          </div>
        ))}
        {disabled && note && (
          <div className="py-2 text-xs text-[var(--color-orange)]">{note}</div>
        )}
      </div>
    </div>
  )
}
