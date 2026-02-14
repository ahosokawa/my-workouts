import { useParams, useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { liftDisplayName, liftFromDay } from '../types'
import { BARBELL_WEIGHT } from '../logic/plates'
import PlateBreakdown from '../components/PlateBreakdown'

export default function WorkoutDetailView() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const sessions = useStore((s) => s.sessions)
  const allLogs = useStore((s) => s.setLogs)
  const navigate = useNavigate()

  const session = sessions.find((s) => s.id === sessionId)
  if (!session) {
    return (
      <div className="p-6 text-center text-[#8e8e93]">
        Session not found.
        <button onClick={() => navigate('/history')} className="block mt-2 text-[var(--color-accent)]">
          Back to History
        </button>
      </div>
    )
  }

  const logs = allLogs.filter((l) => l.sessionId === session.id)
  const mainLogs = logs.filter((l) => l.isMainLift).sort((a, b) => a.setIndex - b.setIndex)
  const accessoryLogs = logs.filter((l) => !l.isMainLift)

  // Group accessories by exercise name
  const accGroups: Record<string, typeof accessoryLogs> = {}
  for (const l of accessoryLogs) {
    if (!accGroups[l.exerciseName]) accGroups[l.exerciseName] = []
    accGroups[l.exerciseName].push(l)
  }

  const lift = liftFromDay(session.liftRawValue)
  const date = new Date(session.date)
  const mins = Math.floor(session.durationSeconds / 60)
  const secs = session.durationSeconds % 60

  return (
    <div className="p-4 space-y-4">
      {/* Back button */}
      <button onClick={() => navigate('/history')} className="text-sm text-[var(--color-accent)]">
        ← History
      </button>

      {/* Header */}
      <div className="bg-[#1c1c1e] rounded-xl p-4">
        <h1 className="text-lg font-bold">Week {session.week}: {lift ? liftDisplayName(lift) : 'Unknown'}</h1>
        <p className="text-xs text-[#8e8e93]">
          {date.toLocaleDateString()} · Cycle {session.cycleNumber} · {mins}:{String(secs).padStart(2, '0')}
        </p>
      </div>

      {/* Main Lift */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">{lift ? liftDisplayName(lift) : 'Main Lift'}</h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          {mainLogs.map((log) => (
            <div key={log.id} className={`flex items-center gap-3 py-2 ${!log.isCompleted ? 'opacity-40' : ''}`}>
              <span className={`text-lg ${log.isCompleted ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                {log.isCompleted ? '✓' : '○'}
              </span>
              <div className="flex-1">
                <div className="text-sm font-medium">{log.weight > 0 ? `${log.weight} lbs` : 'Bar'}</div>
                {log.weight > BARBELL_WEIGHT && <PlateBreakdown weight={log.weight} />}
              </div>
              <span className={`text-sm ${log.isAMRAP && log.isCompleted ? 'font-bold text-[var(--color-green)]' : 'text-[#8e8e93]'}`}>
                {log.isAMRAP && log.actualReps != null ? `${log.actualReps} reps` : `${log.targetReps} reps`}
                {log.isAMRAP && ' (AMRAP)'}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Accessories */}
      {Object.entries(accGroups).map(([name, groupLogs]) => (
        <div key={name} className="bg-[#1c1c1e] rounded-xl overflow-hidden">
          <div className="px-4 pt-3 pb-1">
            <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">{name}</h2>
          </div>
          <div className="px-4 pb-3 divide-y divide-[#38383a]">
            {groupLogs.sort((a, b) => a.setIndex - b.setIndex).map((log) => (
              <div key={log.id} className={`flex items-center gap-3 py-2 ${!log.isCompleted ? 'opacity-40' : ''}`}>
                <span className={`text-lg ${log.isCompleted ? 'text-[var(--color-green)]' : 'text-[#48484a]'}`}>
                  {log.isCompleted ? '✓' : '○'}
                </span>
                <span className="text-sm">Set {log.setIndex + 1}</span>
                <div className="flex-1" />
                {log.weight > 0 && <span className="text-sm text-[#8e8e93]">{Math.round(log.weight)} lbs</span>}
                <span className="text-sm">{log.targetReps} reps</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
