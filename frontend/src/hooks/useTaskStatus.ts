import { useEffect, useRef } from 'react'

interface UseTaskStatusOptions {
  enabled: boolean
  pollIntervalMs?: number
  throttleMs?: number
  refresh: () => Promise<void>
}

export const useTaskStatus = ({
  enabled,
  pollIntervalMs = 3000,
  throttleMs = 800,
  refresh,
}: UseTaskStatusOptions) => {
  const inFlightRef = useRef(false)
  const lastRunRef = useRef(0)

  useEffect(() => {
    if (!enabled) return

    let isCancelled = false

    const runRefresh = async () => {
      if (isCancelled || inFlightRef.current) return

      const now = Date.now()
      if (now - lastRunRef.current < throttleMs) return

      inFlightRef.current = true
      lastRunRef.current = now

      try {
        await refresh()
      } finally {
        inFlightRef.current = false
      }
    }

    runRefresh()
    const intervalId = setInterval(runRefresh, pollIntervalMs)

    return () => {
      isCancelled = true
      clearInterval(intervalId)
    }
  }, [enabled, pollIntervalMs, refresh, throttleMs])
}
