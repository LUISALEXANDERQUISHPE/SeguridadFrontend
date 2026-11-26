import { useEffect, useLayoutEffect, useRef } from 'react'
import { getAuthToken } from '../../../services/documentService'
import { REALTIME_URL } from '../../../services/realtime'
import { openSecureWebSocket, type SecureWebSocket } from '../../../security'

/** HU-25: avisos en tiempo real relacionados con invitaciones y acceso a proyectos. */
export type ProjectNotification =
  | { type: 'invitation-received'; invitationId: string; projectId: string; projectName: string; invitedBy: string | null; role: string }
  | { type: 'invitation-revoked'; invitationId: string; projectId: string }
  | { type: 'invitation-accepted'; invitationId: string; projectId: string; projectName: string; acceptedBy: string | null; role: string }
  | { type: 'invitation-declined'; invitationId: string; projectId: string; projectName: string | null; declinedBy: string | null }
  | { type: 'access-changed'; projectId: string; projectName: string; role: string }
  | { type: 'access-removed'; projectId: string; projectName: string }
  | { type: 'member-left'; projectId: string; projectName: string; userName: string | null }

const NOTIFICATION_TYPES = new Set<string>([
  'invitation-received',
  'invitation-revoked',
  'invitation-accepted',
  'invitation-declined',
  'access-changed',
  'access-removed',
  'member-left',
])

const MAX_RECONNECT_DELAY_MS = 30000
// Sin token válido no tiene sentido reintentar hasta que cambie la sesión
const FATAL_CLOSE_CODES = new Set([4400, 4401])

/**
 * Escucha los avisos en tiempo real del usuario (ej. cuando alguien lo invita a un proyecto).
 * Se reconecta solo si se pierde la conexión.
 */
export function useProjectNotifications(onNotification: (event: ProjectNotification) => void) {
  const callbackRef = useRef(onNotification)
  useLayoutEffect(() => {
    callbackRef.current = onNotification
  })

  useEffect(() => {
    let disposed = false
    let attempts = 0
    let socket: SecureWebSocket | null = null
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const connect = () => {
      const token = getAuthToken()
      if (!token) return

      // Avisos cifrados con ChaCha20, igual que la edición en tiempo real
      socket = openSecureWebSocket(REALTIME_URL)
      socket.onopen = () => socket?.send(JSON.stringify({ type: 'subscribe', token }))
      socket.onmessage = (event) => {
        try {
          const message = JSON.parse(String(event.data)) as { type: string }
          if (message.type === 'subscribed') attempts = 0
          if (NOTIFICATION_TYPES.has(message.type)) callbackRef.current(message as ProjectNotification)
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
