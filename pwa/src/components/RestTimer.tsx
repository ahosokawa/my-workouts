import { useEffect } from 'react'
import { TimerIcon } from './Icons'
import { useStore } from '../store'
import { useElapsedTimer } from '../hooks/useElapsedTimer'
import { scheduleRestNotification, cancelRestNotification } from '../notifications'

interface RestTimerProps {
  lastSetTime: number  // timestamp ms
}

export default function RestTimer({ lastSetTime }: RestTimerProps) {
  const elapsed = useElapsedTimer(true, lastSetTime)
  const notifyEnabled = useStore((s) => s.restNotifyEnabled)
  const notifyMinutes = useStore((s) => s.restNotifyMinutes)

  useEffect(() => {
    if (notifyEnabled) {
      scheduleRestNotification(lastSetTime, notifyMinutes)
    }
    return () => cancelRestNotification()
  }, [lastSetTime, notifyEnabled, notifyMinutes])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#38383a]">
      <div className="flex items-center gap-3">
        <TimerIcon className="w-4 h-4 text-[#8e8e93]" />
        <span className="font-semibold tabular-nums text-base">
          Rest: {minutes}:{String(seconds).padStart(2, '0')}
        </span>
      </div>
    </div>
  )
}
