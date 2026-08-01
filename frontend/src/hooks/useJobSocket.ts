import { useCallback, useEffect, useRef, useState } from 'react'
import { api, jobSocketUrl } from '../api'
import type { Job, SocketFrame } from '../types'
import { ACTIVE_STAGES } from '../types'

type Status = 'idle' | 'connecting' | 'open' | 'closed'

/**
 * Live job state. Prefers the WebSocket; falls back to polling if the socket
 * cannot be established (some corporate proxies drop ws upgrades on localhost).
 */
export function useJobSocket(jobId: string | null) {
  const [job, setJob] = useState<Job | null>(null)
  const [status, setStatus] = useState<Status>('idle')

  const socketRef = useRef<WebSocket | null>(null)
  const pollRef = useRef<number | null>(null)
  const retriesRef = useRef(0)
  const doneRef = useRef(false)

  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current)
      pollRef.current = null
    }
  }, [])

  const startPolling = useCallback(
    (id: string) => {
      if (pollRef.current !== null) return
      pollRef.current = window.setInterval(async () => {
        try {
          const fresh = await api.getJob(id)
          setJob(fresh)
          if (!ACTIVE_STAGES.includes(fresh.stage)) {
            doneRef.current = true
            stopPolling()
          }
        } catch {
          /* keep trying; the next tick may succeed */
        }
      }, 1500)
    },
    [stopPolling],
  )

  useEffect(() => {
    doneRef.current = false
    retriesRef.current = 0

    if (!jobId) {
      setJob(null)
      setStatus('idle')
      return
    }

    let cancelled = false

    // Seed immediately so the panel isn't blank while the socket handshakes.
    api.getJob(jobId).then(
      (j) => !cancelled && setJob(j),
      () => undefined,
    )

    const connect = () => {
      if (cancelled || doneRef.current) return
      setStatus('connecting')

      let ws: WebSocket
      try {
        ws = new WebSocket(jobSocketUrl(jobId))
      } catch {
        startPolling(jobId)
        return
      }
      socketRef.current = ws

      ws.onopen = () => {
        if (cancelled) return
        retriesRef.current = 0
        setStatus('open')
        stopPolling()
      }

      ws.onmessage = (ev) => {
        if (cancelled) return
        let frame: SocketFrame
        try {
          frame = JSON.parse(ev.data as string)
        } catch {
          return
        }
        if (frame.type === 'progress' || frame.type === 'done') {
          setJob(frame.job)
          if (frame.type === 'done') {
            doneRef.current = true
            stopPolling()
          }
        }
      }

      ws.onclose = () => {
        if (cancelled) return
        setStatus('closed')
        socketRef.current = null
        if (doneRef.current) return

        // Reconnect with backoff, then degrade to polling.
        retriesRef.current += 1
        if (retriesRef.current <= 3) {
          window.setTimeout(connect, 400 * retriesRef.current)
        } else {
          startPolling(jobId)
        }
      }

      ws.onerror = () => ws.close()
    }

    connect()

    return () => {
      cancelled = true
      stopPolling()
      const ws = socketRef.current
      socketRef.current = null
      if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        ws.onclose = null
        ws.close()
      }
    }
  }, [jobId, startPolling, stopPolling])

  /** Let callers splice in server responses (e.g. after generating assets). */
  const patchJob = useCallback((updater: (prev: Job) => Job) => {
    setJob((prev) => (prev ? updater(prev) : prev))
  }, [])

  return { job, status, setJob, patchJob }
}
