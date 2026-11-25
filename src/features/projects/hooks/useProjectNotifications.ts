import { useEffect, useLayoutEffect, useRef } from 'react'
import { getAuthToken } from '../../../services/documentService'
import { REALTIME_URL } from '../../../services/realtime'

export interface ProjectSharedEvent {
  type: 'project-shared'
  projectId: string
  projectName: string
  sharedBy: string | null
}

const MAX_RECONNECT_DELAY_MS = 30000
// Sin token válido no tiene sentido reintentar hasta que cambie la sesión
const FATAL_CLOSE_CODES = new Set([4400, 4401])

/**
 * Escucha los avisos en tiempo real del usuario (ej. cuando alguien le comparte un proyecto).
 * Se reconecta solo si se pierde la conexión.
 */
export function useProjectNotifications(onProjectShared: (event: ProjectSharedEvent) => void) {
  const callbackRef = useRef(onProjectShared)
  useLayoutEffect(() => {
    callbackRef.current = onProjectShared
  })

  useEffect(() => {
    let disposed = false
    let attempts = 0
    let socket: WebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const token = getAuthToken()
      if (!token) return

      socket = new WebSocket(REALTIME_URL)
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'subscribe', token }))
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type: string }
          if (message.type === 'subscribed') attempts = 0
          if (message.type === 'project-shared') callbackRef.current(message as ProjectSharedEvent)
        } catch {
          // Mensaje no válido: se ignora
        }
      }
      socket.onclose = (event) => {
        socket = null
        if (disposed || FATAL_CLOSE_CODES.has(event.code)) return
        attempts++
        reconnectTimer = setTimeout(connect, Math.min(MAX_RECONNECT_DELAY_MS, 1000 * 2 ** Math.min(attempts, 5)))
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      socket?.close(1000, 'Panel cerrado')
    }
  }, [])
}

export default useProjectNotifications
