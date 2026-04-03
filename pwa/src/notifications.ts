// Rest timer notification via Service Worker (works when app is backgrounded on iOS 16.4+)

let restTimerId: ReturnType<typeof setTimeout> | null = null

export async function requestNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

export function scheduleRestNotification(lastSetTime: number, minutes: number) {
  cancelRestNotification()

  if (!('Notification' in window) || Notification.permission !== 'granted') return
  if (!('serviceWorker' in navigator)) return

  const thresholdMs = minutes * 60 * 1000
  const elapsed = Date.now() - lastSetTime
  const delay = thresholdMs - elapsed
  if (delay <= 0) return

  restTimerId = setTimeout(async () => {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification('Rest Timer', {
        body: `You've been resting for ${minutes} minute${minutes === 1 ? '' : 's'}`,
        tag: 'rest-timer',
      })
    } catch (e) {
      console.warn('Rest notification failed:', e)
    }
  }, delay)
}

export function cancelRestNotification() {
  if (restTimerId !== null) {
    clearTimeout(restTimerId)
    restTimerId = null
  }
}
