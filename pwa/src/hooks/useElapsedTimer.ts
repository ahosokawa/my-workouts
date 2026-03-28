import { useState, useEffect } from 'react'

/** Returns elapsed seconds since `startTime`, updating every second. Returns 0 when inactive. */
export function useElapsedTimer(isActive: boolean, startTime: number | null): number {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    if (!isActive || !startTime) return
    setElapsed(Math.floor((Date.now() - startTime) / 1000))
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - startTime) / 1000)), 1000)
    return () => clearInterval(interval)
  }, [isActive, startTime])

  return elapsed
}
