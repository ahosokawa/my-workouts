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
    <div className="mx-4 mb-2 flex items-center gap-3 p-3 bg-[#2c2c2e] rounded-2xl">
      <TimerIcon className="w-4 h-4 text-[#8e8e93]" />
      <span className="font-semibold tabular-nums">
        Rest: {minutes}:{String(seconds).padStart(2, '0')}
      </span>
      <div className="flex-1" />
      <button onClick={onDismiss} className="text-[#8e8e93] text-xl leading-none">✕</button>
    </div>
  )
}
