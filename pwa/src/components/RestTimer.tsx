import { useState, useEffect } from 'react'
import { TimerIcon } from './Icons'

interface RestTimerProps {
  lastSetTime: number  // timestamp ms
  onDismiss: () => void
}

export default function RestTimer({ lastSetTime, onDismiss }: RestTimerProps) {
  const [elapsed, setElapsed] = useState(0)

  useEffect(() => {
    setElapsed(Math.floor((Date.now() - lastSetTime) / 1000))
    const interval = setInterval(() => {
      setElapsed(Math.floor((Date.now() - lastSetTime) / 1000))
    }, 1000)
    return () => clearInterval(interval)
  }, [lastSetTime])

  const minutes = Math.floor(elapsed / 60)
  const seconds = elapsed % 60

  return (
    <div className="sticky top-0 z-30 -mx-4 px-4 py-2.5 bg-[#0a0a0a]/95 backdrop-blur-sm border-b border-[#38383a]">
      <div className="flex items-center gap-3">
        <TimerIcon className="w-4 h-4 text-[#8e8e93]" />
        <span className="font-semibold tabular-nums text-base">
          Rest: {minutes}:{String(seconds).padStart(2, '0')}
        </span>
        <div className="flex-1" />
        <button
          onClick={(e) => { e.stopPropagation(); onDismiss() }}
          className="text-[#8e8e93] text-lg leading-none px-2 py-1"
        >
          ✕
        </button>
      </div>
    </div>
  )
}
