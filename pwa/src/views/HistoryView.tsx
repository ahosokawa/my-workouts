import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { liftDisplayName, liftFromDay } from '../types'

export default function HistoryView() {
  const sessions = useStore((s) => s.sessions)
  const navigate = useNavigate()

  const sorted = [...sessions].sort((a, b) => b.date.localeCompare(a.date))

  if (sorted.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center p-6">
        <div className="text-4xl mb-3">📋</div>
        <h2 className="font-semibold mb-1">No Workouts Yet</h2>
        <p className="text-sm text-[#8e8e93]">Complete a workout to see it here.</p>
      </div>
    )
  }

  return (
    <div className="p-4 space-y-2">
      <h1 className="text-xl font-bold mb-3">History</h1>
      {sorted.map((s) => {
        const lift = liftFromDay(s.liftRawValue)
        const date = new Date(s.date)
        const mins = Math.floor(s.durationSeconds / 60)
        const secs = s.durationSeconds % 60
        return (
          <div
            key={s.id}
            onClick={() => navigate(`/history/${s.id}`)}
            className="bg-[#1c1c1e] rounded-xl p-4 flex items-center justify-between cursor-pointer active:opacity-70"
          >
            <div>
              <div className="font-medium text-sm">
                Week {s.week}: {lift ? liftDisplayName(lift) : 'Unknown'}
              </div>
              <div className="text-xs text-[#8e8e93]">
                {date.toLocaleDateString()} · Cycle {s.cycleNumber}
              </div>
            </div>
            <div className="text-right">
              <div className="text-sm tabular-nums">{mins}:{String(secs).padStart(2, '0')}</div>
              <div className="text-[10px] text-[#8e8e93]">duration</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
