import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store'
import { MUSCLE_GROUPS, liftDisplayName, toDisplayWeight } from '../types'
import type { UserProfile } from '../types'
import { getProgram } from '../logic/programs'
import { accessoryTagIndex, muscleGroupLabel } from '../logic/muscleGroups'
import { weeklyVolume, sessionsPerWeek, consistencyStreakWeeks, stalledLifts } from '../logic/metrics'
import { topSetLifts, weeksSinceLastDeload } from '../logic/deloadTriggers'

const CONSISTENCY_WEEKS = 8

export default function TrendsView({ profile }: { profile: UserProfile }) {
  const sessions = useStore((s) => s.sessions)
  const setLogs = useStore((s) => s.setLogs)
  const customAccessories = useStore((s) => s.customAccessories)
  const navigate = useNavigate()

  const units = profile.units ?? 'lbs'
  const def = getProgram(profile.programType)
  const now = useMemo(() => new Date(), [])

  const volume = useMemo(
    () => weeklyVolume(setLogs, 2, now, accessoryTagIndex(customAccessories)),
    [setLogs, now, customAccessories],
  )
  const [lastWeek, thisWeek] = volume
  const groupsWithVolume = MUSCLE_GROUPS.filter(
    (g) => (thisWeek.volumeByGroup[g] ?? 0) > 0 || (lastWeek.volumeByGroup[g] ?? 0) > 0,
  )
  const maxVolume = Math.max(
    1,
    ...groupsWithVolume.flatMap((g) => [thisWeek.volumeByGroup[g] ?? 0, lastWeek.volumeByGroup[g] ?? 0]),
  )

  const weekCounts = useMemo(() => sessionsPerWeek(sessions, CONSISTENCY_WEEKS, now), [sessions, now])
  const targetPerWeek = def.days.length
  const streak = useMemo(
    () => consistencyStreakWeeks(sessions, targetPerWeek, now),
    [sessions, targetPerWeek, now],
  )

  const stalled = useMemo(
    () => stalledLifts(setLogs, topSetLifts(def).length > 0 ? topSetLifts(def) : [1, 2, 3, 4], now),
    [setLogs, def, now],
  )
  const deloadWeeks = weeksSinceLastDeload(profile, now)

  const fmtVolume = (lbs: number) => `${Math.round(toDisplayWeight(lbs, units)).toLocaleString()}`

  if (sessions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <h2 className="font-semibold mb-1">No Trends Yet</h2>
        <p className="text-sm text-[#8e8e93]">Finish a few workouts to see weekly volume and consistency.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Weekly volume by muscle group */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1 flex items-center justify-between">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Weekly Volume by Muscle</h2>
          <span className="text-[10px] text-[#8e8e93]">weight × reps, {units}</span>
        </div>
        <div className="px-4 pb-3">
          {groupsWithVolume.length === 0 ? (
            <p className="text-sm text-[#8e8e93] py-2">No logged sets with weight this week or last.</p>
          ) : (
            <div className="space-y-3 py-2">
              {groupsWithVolume.map((g) => {
                const cur = thisWeek.volumeByGroup[g] ?? 0
                const prev = lastWeek.volumeByGroup[g] ?? 0
                return (
                  <div key={g}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="font-medium">{muscleGroupLabel(g)}</span>
                      <span className="text-[#8e8e93] tabular-nums">
                        {fmtVolume(cur)} <span className="text-[#636366]">· last wk {fmtVolume(prev)}</span>
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-[#2c2c2e] overflow-hidden mb-1">
                      <div
                        className="h-full rounded-full bg-[var(--color-accent)]"
                        style={{ width: `${Math.min(100, (cur / maxVolume) * 100)}%` }}
                      />
                    </div>
                    <div className="h-2 rounded-full bg-[#2c2c2e] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#48484a]"
                        style={{ width: `${Math.min(100, (prev / maxVolume) * 100)}%` }}
                      />
                    </div>
                  </div>
                )
              })}
              <p className="text-[10px] text-[#636366]">
                Blue = this week, gray = last week. Bodyweight/band sets without a logged weight aren't counted.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Consistency */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Consistency</h2>
        </div>
        <div className="px-4 pb-3">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Streak ({targetPerWeek}+ sessions/week)</span>
            <span className="text-xl font-bold text-[var(--color-accent)]">
              {streak} {streak === 1 ? 'week' : 'weeks'}
            </span>
          </div>
          <div className="flex items-end gap-1.5 h-16 pt-1">
            {weekCounts.map((w) => {
              const met = w.count >= targetPerWeek
              const height = Math.min(100, (w.count / Math.max(targetPerWeek, 1)) * 100)
              return (
                <div key={w.weekStart} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full h-12 flex items-end">
                    <div
                      className={`w-full rounded-sm ${met ? 'bg-[var(--color-green)]' : 'bg-[#48484a]'}`}
                      style={{ height: `${w.count > 0 ? Math.max(height, 12) : 0}%` }}
                    />
                  </div>
                  <span className="text-[9px] text-[#636366] tabular-nums">{w.count}</span>
                </div>
              )
            })}
          </div>
          <p className="text-[10px] text-[#636366] mt-1">Sessions per week, last {CONSISTENCY_WEEKS} weeks (oldest → newest).</p>
        </div>
      </div>

      {/* Recovery & stalls */}
      <div className="bg-[#1c1c1e] rounded-xl overflow-hidden">
        <div className="px-4 pt-3 pb-1">
          <h2 className="text-xs uppercase tracking-wider text-[#8e8e93]">Recovery</h2>
        </div>
        <div className="px-4 pb-3 divide-y divide-[#38383a]">
          <div className="flex items-center justify-between py-2">
            <span className="text-sm">Time since last deload</span>
            <span className="text-sm text-[#8e8e93]">
              {deloadWeeks === null
                ? '—'
                : `${deloadWeeks} ${deloadWeeks === 1 ? 'week' : 'weeks'}${profile.lastDeloadEndedAt ? '' : ' (never deloaded)'}`}
            </span>
          </div>
          <div className="py-2">
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm">Stalled lifts</span>
              {stalled.length === 0 && <span className="text-sm text-[var(--color-green)]">None — all progressing</span>}
            </div>
            {stalled.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-1">
                {stalled.map((lift) => (
                  <button
                    key={lift}
                    onClick={() => navigate(`/prs/chart/${lift}`)}
                    className="px-3 py-1.5 rounded-lg bg-[#3a2a1e] text-xs font-semibold text-[var(--color-orange)]"
                  >
                    {liftDisplayName(lift)} — no e1RM progress in 4 wks ›
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

    </div>
  )
}
