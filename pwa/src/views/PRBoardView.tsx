import { useStore } from '../store'
import { MAIN_LIFTS, liftDisplayName, liftShortName } from '../types'

export default function PRBoardView() {
  const setLogs = useStore((s) => s.setLogs)
  const completedMain = setLogs.filter((l) => l.isMainLift && l.isCompleted)

  if (completedMain.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <div className="text-4xl mb-3">📊</div>
        <h2 className="font-semibold mb-1">No Data Yet</h2>
        <p className="text-sm text-[#8e8e93]">Complete workouts to populate the PR board.</p>
      </div>
    )
  }

  const oneWeekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000

  // Build data: { exerciseName -> { rep -> { weight, isRecent } } }
  const data: Record<string, Record<number, { weight: number; isRecent: boolean }>> = {}

  for (const log of completedMain) {
    const reps = log.isAMRAP && log.actualReps != null ? log.actualReps : log.targetReps
    if (reps < 1 || reps > 20) continue

    const isRecent = log.completedAt ? new Date(log.completedAt).getTime() > oneWeekAgo : false
    const exercise = log.exerciseName

    if (!data[exercise]) data[exercise] = {}

    // Record at exact rep count
    const existing = data[exercise][reps]
    if (!existing || log.weight > existing.weight) {
      data[exercise][reps] = { weight: log.weight, isRecent }
    } else if (log.weight === existing.weight && isRecent) {
      data[exercise][reps] = { weight: existing.weight, isRecent: true }
    }

    // Back-fill lower reps
    for (let r = 1; r < reps; r++) {
      const ex = data[exercise][r]
      if (!ex || log.weight > ex.weight) {
        data[exercise][r] = { weight: log.weight, isRecent }
      }
    }
  }

  const repRange = Array.from({ length: 20 }, (_, i) => i + 1)

  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <table className="w-full min-w-[340px]">
        <thead>
          <tr className="text-xs font-bold text-[#8e8e93]">
            <th className="text-left py-2 w-12">Reps</th>
            {MAIN_LIFTS.map((lift) => (
              <th key={lift} className="text-right py-2 w-16">{liftShortName(lift)}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#38383a]">
          {repRange.map((reps) => (
            <tr key={reps}>
              <td className="py-1.5 text-sm font-medium tabular-nums">{reps}</td>
              {MAIN_LIFTS.map((lift) => {
                const entry = data[liftDisplayName(lift)]?.[reps]
                return (
                  <td key={lift} className="text-right py-1.5">
                    {entry ? (
                      <span
                        className={`text-sm tabular-nums ${
                          entry.isRecent ? 'font-bold text-[var(--color-accent)]' : ''
                        }`}
                      >
                        {Math.round(entry.weight)}
                      </span>
                    ) : (
                      <span className="text-sm text-[#38383a]">--</span>
                    )}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
