import { useState, useRef } from 'react'
import type { PrescribedSet } from '../types'
import { BARBELL_WEIGHT } from '../logic/plates'
import PlateBreakdown from './PlateBreakdown'

interface MainSetCardProps {
  set: PrescribedSet
  isActive: boolean
  isCompleted: boolean
  amrapReps: number
  setAmrapReps: (v: number) => void
  bestE1RM: number | null
  minRepsToBeat: (target: number, weight: number) => number | null
  overrideWeight: string | undefined
  overrideReps: string | undefined
  onWeightChange: (value: string) => void
  onRepsChange: (value: string) => void
  onToggle: () => void
}

export default function MainSetCard({
  set, isActive, isCompleted, amrapReps, setAmrapReps, bestE1RM, minRepsToBeat,
  overrideWeight, overrideReps, onWeightChange, onRepsChange, onToggle,
}: MainSetCardProps) {
  const [editingField, setEditingField] = useState<'weight' | 'reps' | null>(null)
  const weightRef = useRef<HTMLInputElement>(null)
  const repsRef = useRef<HTMLInputElement>(null)

  const displayWeight = (overrideWeight !== undefined && overrideWeight !== '')
    ? Number(overrideWeight) || set.weight
    : set.weight
  const displayReps = (overrideReps !== undefined && overrideReps !== '')
    ? Number(overrideReps) || set.targetReps
    : set.targetReps

  const prTarget = bestE1RM !== null ? minRepsToBeat(bestE1RM, displayWeight) : null

  const weightInputValue = overrideWeight !== undefined ? overrideWeight : String(set.weight)
  const repsInputValue = overrideReps !== undefined ? overrideReps : String(set.targetReps)

  function startEditWeight(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive || isCompleted) return
    if (overrideWeight === undefined) onWeightChange(String(set.weight))
    setEditingField('weight')
    setTimeout(() => weightRef.current?.select(), 0)
  }

  function startEditReps(e: React.MouseEvent) {
    e.stopPropagation()
    if (!isActive || isCompleted) return
    if (overrideReps === undefined) onRepsChange(String(set.targetReps))
    setEditingField('reps')
    setTimeout(() => repsRef.current?.select(), 0)
  }

  const isWeightEdited = overrideWeight !== undefined && overrideWeight !== '' && Number(overrideWeight) !== set.weight
  const isRepsEdited = overrideReps !== undefined && overrideReps !== '' && Number(overrideReps) !== set.targetReps

  return (
    <div className={`py-4 ${isCompleted && !set.isAMRAP ? 'opacity-50' : ''}`}>
      <div className="flex items-center gap-3">
        <button
          onClick={onToggle}
          className="flex items-center justify-center w-11 h-11 -ml-1 shrink-0"
          aria-label={isCompleted ? 'Mark incomplete' : 'Mark complete'}
        >
          <span className={`text-2xl ${isCompleted ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
            {isCompleted ? '✓' : '○'}
          </span>
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold uppercase ${set.isWarmup ? 'text-[#8e8e93]' : set.isSupplemental ? 'text-[var(--color-yellow)]' : 'text-[var(--color-accent)]'}`}>
              {set.isWarmup ? 'Warmup' : set.isSupplemental ? 'Supplemental' : 'Working'}
            </span>
            <span className="text-xs text-[#8e8e93]">{Math.round(set.percentage * 100)}%</span>
          </div>

          {/* Weight: tap text to edit, blur to close */}
          {editingField === 'weight' ? (
            <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
              <input
                ref={weightRef}
                type="number"
                inputMode="decimal"
                value={weightInputValue}
                onChange={(e) => onWeightChange(e.target.value)}
                onBlur={() => setEditingField(null)}
                autoFocus
                className="w-20 text-base font-semibold py-0.5 px-1"
              />
              <span className="text-sm text-[#8e8e93]">lbs</span>
            </div>
          ) : (
            <div
              className={`font-semibold text-base ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isWeightEdited ? 'text-[var(--color-orange)]' : ''}`}
              onClick={startEditWeight}
            >
              {displayWeight > 0 ? `${displayWeight} lbs` : 'Bar'}
            </div>
          )}
          {displayWeight > BARBELL_WEIGHT && <PlateBreakdown weight={displayWeight} />}
        </div>

        {/* Reps display: tap to edit */}
        {!set.isAMRAP && editingField === 'reps' ? (
          <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
            <input
              ref={repsRef}
              type="number"
              inputMode="numeric"
              value={repsInputValue}
              onChange={(e) => onRepsChange(e.target.value)}
              onBlur={() => setEditingField(null)}
              autoFocus
              className="w-14 text-center text-base py-0.5 px-1"
            />
            <span className="text-sm text-[#8e8e93]">reps</span>
          </div>
        ) : !set.isAMRAP ? (
          <span
            className={`text-base ${isCompleted ? 'text-[#8e8e93]' : ''} ${isActive && !isCompleted ? 'underline decoration-dotted decoration-[#48484a] underline-offset-2' : ''} ${isRepsEdited ? 'text-[var(--color-orange)]' : ''}`}
            onClick={startEditReps}
          >
            {displayReps} reps
          </span>
        ) : null}

        {set.isAMRAP && isCompleted && <span className="text-base font-bold text-[var(--color-green)]">{amrapReps} reps</span>}
        {set.isAMRAP && !isActive && !isCompleted && <span className="text-base">{set.targetReps}+ reps</span>}
      </div>

      {/* AMRAP stepper */}
      {set.isAMRAP && isActive && !isCompleted && (
        <div className="mt-3 ml-10 space-y-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center gap-3">
            <span className="text-sm text-[#8e8e93]">Reps:</span>
            <button
              onClick={() => setAmrapReps(Math.max(0, amrapReps - 1))}
              className="w-10 h-10 rounded-lg bg-[#38383a] text-center text-lg leading-10"
            >
              −
            </button>
            <span className="text-xl font-bold tabular-nums w-8 text-center">{amrapReps}</span>
            <button
              onClick={() => setAmrapReps(amrapReps + 1)}
              className="w-10 h-10 rounded-lg bg-[#38383a] text-center text-lg leading-10"
            >
              +
            </button>

            {prTarget !== null && (
              <span className="text-xs text-[#8e8e93] ml-2">
                {prTarget}+ to beat PR ({Math.round(bestE1RM!)} lbs)
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
