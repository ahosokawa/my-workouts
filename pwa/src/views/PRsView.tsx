import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { MainLift, MAIN_LIFTS, liftDisplayName } from '../types'
import { estimated1RM } from '../logic/brzycki'
import { formatWilks } from '../logic/wilks'
import PRBoardView from './PRBoardView'

type Tab = 'e1rm' | 'board' | 'wilks'

export default function PRsView() {
  const [tab, setTab] = useState<Tab>('e1rm')
  const setLogs = useStore((s) => s.setLogs)
  const wilksEntries = useStore((s) => s.wilksEntries)
  const navigate = useNavigate()

  const amrapLogs = setLogs.filter(
    (l) => l.isAMRAP && l.isMainLift && l.isCompleted && l.actualReps != null,
  )

  function bestE1RM(lift: MainLift): { weight: number; reps: number; e1rm: number } | null {
    let best: { weight: number; reps: number; e1rm: number } | null = null
    for (const l of amrapLogs) {
      if (l.exerciseName !== liftDisplayName(lift)) continue
      const e = estimated1RM(l.weight, l.actualReps!)
      if (e !== null && (best === null || e > best.e1rm)) {
        best = { weight: l.weight, reps: l.actualReps!, e1rm: e }
      }
    }
    return best
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'e1rm', label: 'Est. 1RM' },
    { key: 'board', label: 'PR Board' },
    { key: 'wilks', label: 'Wilks' },
  ]

  return (
    <div className="p-4 space-y-4">
      <h1 className="text-xl font-bold">Personal Records</h1>

      {/* Tab selector */}
      <div className="flex bg-[#1c1c1e] rounded-lg p-0.5">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              tab === t.key ? 'bg-[#38383a] text-white' : 'text-[#8e8e93]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === 'e1rm' && (
        amrapLogs.length === 0 ? (
          <EmptyState title="No PRs Yet" message="Complete AMRAP sets to see your personal records." />
        ) : (
          <div className="space-y-4">
            {/* Est 1RM */}
            <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Estimated 1RM</h2>
              </div>
              <div className="px-4 pb-3 divide-y divide-[#38383a]">
                {MAIN_LIFTS.map((lift) => {
                  const best = bestE1RM(lift)
                  return (
                    <div
                      key={lift}
                      onClick={() => navigate(`/prs/chart/${lift}`)}
                      className="flex items-center justify-between py-3 cursor-pointer active:opacity-70"
                    >
                      <div>
                        <div className="font-medium text-sm">{liftDisplayName(lift)}</div>
                        {best && <div className="text-xs text-[#8e8e93]">{Math.round(best.weight)} lbs x {best.reps}</div>}
                      </div>
                      <div className="flex items-center gap-2">
                        {best ? (
                          <span className="text-xl font-bold text-[var(--color-accent)]">{Math.round(best.e1rm)} lbs</span>
                        ) : (
                          <span className="text-xl text-[#8e8e93]">--</span>
                        )}
                        <span className="text-[#8e8e93]">›</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Best AMRAP */}
            <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
              <div className="px-4 pt-3 pb-1">
                <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Best AMRAP Sets</h2>
              </div>
              <div className="px-4 pb-3 divide-y divide-[#38383a]">
                {MAIN_LIFTS.map((lift) => {
                  const best = bestE1RM(lift)
                  return (
                    <div key={lift} className="flex items-center gap-3 py-2">
                      <div className="flex-1">
                        <div className="text-sm font-medium">{liftDisplayName(lift)}</div>
                        {best && <div className="text-xs text-[#8e8e93]">{Math.round(best.weight)} lbs x {best.reps} reps</div>}
                      </div>
                      {best ? (
                        <span className="text-sm font-semibold text-[var(--color-accent)]">e1RM: {Math.round(best.e1rm)} lbs</span>
                      ) : (
                        <span className="text-sm text-[#8e8e93]">No data</span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        )
      )}

      {tab === 'board' && <PRBoardView />}

      {tab === 'wilks' && (
        (() => {
          const sorted = [...wilksEntries].sort((a, b) => b.date.localeCompare(a.date))
          const latest = sorted[0]
          if (!latest) {
            return <EmptyState title="No Wilks Data" message="Complete AMRAP sets and enter your body weight to calculate your Wilks score." />
          }
          return (
            <div className="space-y-4">
              {/* Current score */}
              <div className="bg-[#1c1c1e] rounded-xl p-6 text-center">
                <div className="text-xs text-[#8e8e93] mb-1">Current Wilks Score</div>
                <div className="text-5xl font-bold text-[var(--color-accent)] mb-3">{formatWilks(latest.wilksScore)}</div>
                <div className="flex justify-center gap-6 mb-3">
                  <div className="text-center">
                    <div className="text-[10px] text-[#8e8e93]">Body Weight</div>
                    <div className="text-sm font-medium">{Math.round(latest.bodyWeightLbs)} lbs</div>
                  </div>
                  <div className="text-center">
                    <div className="text-[10px] text-[#8e8e93]">Total</div>
                    <div className="text-sm font-medium">{Math.round(latest.total)} lbs</div>
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  {[
                    { label: 'SQ', value: latest.squatE1RM },
                    { label: 'BP', value: latest.benchE1RM },
                    { label: 'DL', value: latest.deadliftE1RM },
                  ].map((c) => (
                    <div key={c.label} className="bg-[#38383a] rounded-lg px-3 py-1.5">
                      <div className="text-[10px] font-bold text-[#8e8e93]">{c.label}</div>
                      <div className="text-xs font-medium">{Math.round(c.value)}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* History */}
              {sorted.length > 1 && (
                <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
                  <div className="px-4 pt-3 pb-1">
                    <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">History</h2>
                  </div>
                  <div className="px-4 pb-3 divide-y divide-[#38383a]">
                    {sorted.slice(0, 20).map((e) => (
                      <div key={e.id} className="flex items-center justify-between py-2">
                        <div>
                          <div className="text-sm font-medium tabular-nums">{formatWilks(e.wilksScore)}</div>
                          <div className="text-xs text-[#8e8e93]">{new Date(e.date).toLocaleDateString()}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-sm">{Math.round(e.total)} lbs total</div>
                          <div className="text-xs text-[#8e8e93]">{Math.round(e.bodyWeightLbs)} lbs BW</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )
        })()
      )}
    </div>
  )
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h2 className="font-semibold mb-1">{title}</h2>
      <p className="text-sm text-[#8e8e93]">{message}</p>
    </div>
  )
}
