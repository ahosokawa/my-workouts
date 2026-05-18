import { useState, useEffect } from 'react'

/** Returns elapsed seconds since `startTime`, updating every second. Returns 0 when inactive. */
export function useElapsedTimer(isActive: boolean, startTime: number | null): number {
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isActive || !startTime) return
    const interval = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(interval)
  }, [isActive, startTime])

  if (!isActive || !startTime) return 0
  return Math.max(0, Math.floor((now - startTime) / 1000))
}
