import { useState, useEffect } from 'react'

/** Returns elapsed seconds since `startTime`, updating every second. Returns 0 when inactive.
 *
 *  Elapsed is derived from the wall clock at render time, so it is correct immediately —
 *  including when a persisted workout is resumed with a `startTime` in the past. The
 *  interval only forces the once-per-second re-render. */
export function useElapsedTimer(isActive: boolean, startTime: number | null): number {
  const [, setTick] = useState(0)

  useEffect(() => {
    if (!isActive || !startTime) return
    const interval = setInterval(() => setTick((t) => t + 1), 1000)
    return () => clearInterval(interval)
  }, [isActive, startTime])

  if (!isActive || !startTime) return 0
  // Reading the clock in render is intentional: a live timer must reflect the current
  // time on every render, not a value snapshotted at mount or on the last interval tick.
  // eslint-disable-next-line react-hooks/purity
  return Math.max(0, Math.floor((Date.now() - startTime) / 1000))
}
