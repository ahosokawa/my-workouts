import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts'
import { useStore } from '../store'
import { MainLift, liftDisplayName } from '../types'
import { estimated1RM } from '../logic/brzycki'

type Interval = 'week' | 'month'

export default function E1RMChartView() {
  const { liftId } = useParams<{ liftId: string }>()
  const navigate = useNavigate()
  const setLogs = useStore((s) => s.setLogs)
  const [interval, setInterval] = useState<Interval>('month')

  const lift = Number(liftId) as MainLift
  const liftName = liftDisplayName(lift)

  const filtered = setLogs.filter(
    (l) =>
      l.exerciseName === liftName &&
      l.isAMRAP &&
      l.isMainLift &&
      l.isCompleted &&
      l.actualReps != null &&
      l.completedAt != null,
  )

  // Compute best e1RM
  let bestE1RM = 0
  for (const l of filtered) {
    const e = estimated1RM(l.weight, l.actualReps!)
    if (e !== null && e > bestE1RM) bestE1RM = e
  }

  // Group by interval
  const buckets: Record<string, number> = {}
  for (const l of filtered) {
    const d = new Date(l.completedAt!)
    let key: string
    if (interval === 'week') {
      // ISO week start (Monday)
      const day = d.getDay()
      const diff = d.getDate() - day + (day === 0 ? -6 : 1)
      const monday = new Date(d)
      monday.setDate(diff)
      key = monday.toISOString().slice(0, 10)
    } else {
      key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
    }
    const e = estimated1RM(l.weight, l.actualReps!)
    if (e !== null) {
      buckets[key] = Math.max(buckets[key] ?? 0, e)
    }
  }

  const dataPoints = Object.entries(buckets)
    .map(([date, e1rm]) => ({ date, e1rm: Math.round(e1rm) }))
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="p-4 space-y-4">
      <button onClick={() => navigate('/prs')} className="text-sm text-[var(--color-accent)]">
        ← Personal Records
      </button>

      <h1 className="text-xl font-bold">{liftName}</h1>

      {/* Best e1RM */}
      {bestE1RM > 0 && (
        <div className="text-center py-2">
          <div className="text-xs text-[#8e8e93]">Best Est. 1RM</div>
          <div className="text-4xl font-bold text-[var(--color-accent)]">{Math.round(bestE1RM)} lbs</div>
        </div>
      )}

      {/* Interval picker */}
      <div className="flex bg-[#1c1c1e] rounded-lg p-0.5">
        {(['week', 'month'] as Interval[]).map((i) => (
          <button
            key={i}
            onClick={() => setInterval(i)}
            className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-colors ${
              interval === i ? 'bg-[#38383a] text-white' : 'text-[#8e8e93]'
            }`}
          >
            {i === 'week' ? 'Weekly' : 'Monthly'}
          </button>
        ))}
      </div>

      {/* Chart */}
      {dataPoints.length >= 2 ? (
        <div className="bg-[#1c1c1e] rounded-xl p-4">
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={dataPoints}>
              <CartesianGrid strokeDasharray="3 3" stroke="#38383a" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 10, fill: '#8e8e93' }}
                tickFormatter={(v: string) => {
                  const d = new Date(v)
                  return `${d.getMonth() + 1}/${d.getDate()}`
                }}
              />
              <YAxis
                tick={{ fontSize: 10, fill: '#8e8e93' }}
                domain={['auto', 'auto']}
                label={{ value: 'lbs', angle: -90, position: 'insideLeft', style: { fontSize: 10, fill: '#8e8e93' } }}
              />
              <Tooltip
                contentStyle={{ backgroundColor: '#2c2c2e', border: 'none', borderRadius: 8, fontSize: 12 }}
                labelFormatter={(v: string) => new Date(v).toLocaleDateString()}
                formatter={(v: number) => [`${v} lbs`, 'Est. 1RM']}
              />
              <Line type="monotone" dataKey="e1rm" stroke="#007AFF" strokeWidth={2} dot={{ fill: '#007AFF', r: 4 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      ) : dataPoints.length === 1 ? (
        <div className="bg-[#1c1c1e] rounded-xl p-6 text-center">
          <div className="text-2xl font-bold">{dataPoints[0].e1rm} lbs</div>
          <div className="text-sm text-[#8e8e93] mt-1">{new Date(dataPoints[0].date).toLocaleDateString()}</div>
          <div className="text-xs text-[#8e8e93] mt-2">Complete more workouts to see a trend line.</div>
        </div>
      ) : (
        <div className="text-center py-12">
          <div className="text-4xl mb-3">📈</div>
          <p className="text-sm text-[#8e8e93]">Complete AMRAP sets for {liftName} to see your estimated 1RM over time.</p>
        </div>
      )}
    </div>
  )
}
