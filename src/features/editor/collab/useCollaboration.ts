import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import * as Y from 'yjs'
import { getAuthToken } from '../../../services/documentService'
import { REALTIME_URL } from '../../../services/realtime'
import { base64ToBytes, bytesToBase64, computeTextChange, mapIndexThroughDelta, type TextDelta } from './textSync'

// Debe coincidir con TEXT_KEY del backend (src/realtime/collabRoom.js)
const TEXT_KEY = 'content'
const LOCAL_ORIGIN = 'local'
const REMOTE_ORIGIN = 'remote'
const CURSOR_THROTTLE_MS = 60
const MAX_RECONNECT_DELAY_MS = 10000
// Cierres en los que reintentar no sirve (sin permisos, documento inexistente, mensaje inválido)
const FATAL_CLOSE_CODES = new Set([4400, 4403, 4404])


export type CollabStatus = 'disabled' | 'connecting' | 'connected' | 'reconnecting' | 'error'

interface RelativeCursor {
  anchor: unknown
  head: unknown
}

interface PresenceUser {
  clientId: number
  userId: string
  name: string
  color: string
  canEdit: boolean
  cursor: RelativeCursor | null
}

/** Colaborador conectado con su cursor ya convertido a posiciones del texto actual. */
export interface Collaborator {
  clientId: number
  userId: string
  name: string
  color: string
  canEdit: boolean
  anchor: number | null
  head: number | null
}

type ServerMessage =
  | { type: 'init'; clientId: number; canEdit: boolean; state: string; users: PresenceUser[] }
  | { type: 'update'; update: string }
  | { type: 'presence'; users: PresenceUser[] }
  | { type: 'cursor'; clientId: number; cursor: RelativeCursor | null }
  | { type: 'saved'; savedAt: string }
  | { type: 'save-error'; message: string }
  | { type: 'error'; message: string }
  // HU-25: el propietario cambió el rol de este usuario mientras tenía el archivo abierto
  | { type: 'access'; canEdit: boolean }

/** HU-25: el servidor cerró la conexión porque el usuario ya no tiene acceso al proyecto. */
const ACCESS_REVOKED_CODE = 4403
/** Cierre propio (no fatal) para reconectar y partir del estado del servidor. */
const RESYNC_CODE = 4000

interface UseCollaborationOptions {
  documentId: string | null
  enabled: boolean
  /** Contenido inicial recibido del servidor (reemplaza lo que muestre el editor). */
  onSynced: (content: string) => void
  /** Cambio hecho por otro colaborador; mapIndex ajusta posiciones locales (cursor) al texto nuevo. */
  onRemoteChange: (content: string, mapIndex: (index: number) => number) => void
  onSaved: (savedAt: string) => void
  onSaveError: () => void
  /** HU-25: cambió el permiso de edición del usuario (ej. pasó de editor a lector). */
  onAccessChanged?: (canEdit: boolean) => void
  /** HU-25: al usuario le quitaron el acceso al proyecto. */
  onAccessRevoked?: (reason: string) => void
}

/**
 * Edición colaborativa en tiempo real de un archivo de texto.
 *
 * El contenido vive en un Y.Text (CRDT de Yjs) sincronizado por WebSocket con el servidor,
 * que fusiona las ediciones simultáneas de todos los colaboradores sin conflictos y guarda el
 * resultado en la base de datos. Cada reconexión parte de un documento nuevo con el estado del
 * servidor, por eso el editor queda en solo lectura mientras no hay conexión.
 */
export function useCollaboration({
  documentId,
  enabled,
  onSynced,
  onRemoteChange,
  onSaved,
  onSaveError,
  onAccessChanged,
  onAccessRevoked,
}: UseCollaborationOptions) {
  const [status, setStatus] = useState<CollabStatus>('disabled')
  const [canEdit, setCanEdit] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [collaborators, setCollaborators] = useState<Collaborator[]>([])

  const docRef = useRef<Y.Doc | null>(null)
  const socketRef = useRef<WebSocket | null>(null)
  const syncedRef = useRef(false)
  const canEditRef = useRef(false)
  const presenceRef = useRef<Map<number, PresenceUser>>(new Map())
  const ownClientIdRef = useRef<number | null>(null)
  const pendingCursorRef = useRef<RelativeCursor | null>(null)
  const cursorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Callbacks en refs: así la conexión no se reinicia cuando el componente se vuelve a renderizar
  const callbacksRef = useRef({ onSynced, onRemoteChange, onSaved, onSaveError, onAccessChanged, onAccessRevoked })
  useLayoutEffect(() => {
    callbacksRef.current = { onSynced, onRemoteChange, onSaved, onSaveError, onAccessChanged, onAccessRevoked }
  })

  /** Recalcula las posiciones absolutas de los cursores remotos en el texto actual. */
  const refreshCollaborators = useCallback(() => {
    const doc = docRef.current
    const users = [...presenceRef.current.values()].filter((user) => user.clientId !== ownClientIdRef.current)
    if (users.length === 0) {
      // Evita renderizar en cada tecla cuando se edita a solas
      setCollaborators((previous) => (previous.length === 0 ? previous : []))
      return
    }
    const toIndex = (position: unknown): number | null => {
      if (!doc || !position) return null
      try {
        const absolute = Y.createAbsolutePositionFromRelativePosition(Y.createRelativePositionFromJSON(position), doc)
        return absolute ? absolute.index : null
      } catch {
        return null
      }
    }
    setCollaborators(
      users.map((user) => ({
        clientId: user.clientId,
        userId: user.userId,
        name: user.name,
        color: user.color,
        canEdit: user.canEdit,
        anchor: toIndex(user.cursor?.anchor),
        head: toIndex(user.cursor?.head),
      })),
    )
  }, [])

  useEffect(() => {
    if (!enabled || !documentId) {
      setStatus('disabled')
      setCollaborators([])
      return
    }

    let disposed = false
    let attempts = 0
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null

    const send = (payload: object) => {
      const socket = socketRef.current
      if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(payload))
    }

    const connect = () => {
      // Documento nuevo por conexión: el estado del servidor es siempre la fuente de verdad
      const doc = new Y.Doc()
      const text = doc.getText(TEXT_KEY)
      docRef.current = doc
      syncedRef.current = false
      presenceRef.current = new Map()

      doc.on('update', (update: Uint8Array, origin: unknown) => {
        if (origin === LOCAL_ORIGIN) send({ type: 'update', update: bytesToBase64(update) })
      })

      text.observe((event, transaction) => {
        if (transaction.origin !== REMOTE_ORIGIN || !syncedRef.current) return
        const delta = event.delta as TextDelta
        callbacksRef.current.onRemoteChange(text.toString(), (index) => mapIndexThroughDelta(index, delta))
        refreshCollaborators()
      })

      setStatus(attempts === 0 ? 'connecting' : 'reconnecting')
      const socket = new WebSocket(REALTIME_URL)
      socketRef.current = socket

      socket.onopen = () => {
        // El token va en el primer mensaje (no en la URL) para que no quede en registros
        socket.send(JSON.stringify({ type: 'join', documentId, token: getAuthToken() }))
      }

      socket.onmessage = (event) => {
        let message: ServerMessage
        try {
          message = JSON.parse(String(event.data)) as ServerMessage
        } catch {
          return
        }

        switch (message.type) {
          case 'init': {
            Y.applyUpdate(doc, base64ToBytes(message.state), REMOTE_ORIGIN)
            attempts = 0
            ownClientIdRef.current = message.clientId
            canEditRef.current = message.canEdit
            presenceRef.current = new Map(message.users.map((user) => [user.clientId, user]))
            syncedRef.current = true
            setCanEdit(message.canEdit)
            setErrorMessage(null)
            setStatus('connected')
            callbacksRef.current.onSynced(text.toString())
            refreshCollaborators()
            break
          }
          case 'update':
            Y.applyUpdate(doc, base64ToBytes(message.update), REMOTE_ORIGIN)
            break
          case 'presence':
            presenceRef.current = new Map(message.users.map((user) => [user.clientId, user]))
            refreshCollaborators()
            break
          case 'cursor': {
            const user = presenceRef.current.get(message.clientId)
            if (user) {
              presenceRef.current.set(message.clientId, { ...user, cursor: message.cursor })
              refreshCollaborators()
            }
            break
          }
          case 'saved':
            callbacksRef.current.onSaved(message.savedAt)
            break
          case 'save-error':
            callbacksRef.current.onSaveError()
            break
          case 'error':
            setErrorMessage(message.message)
            break
          case 'access': {
            const lostEdit = canEditRef.current && !message.canEdit
            canEditRef.current = message.canEdit
            setCanEdit(message.canEdit)
            callbacksRef.current.onAccessChanged?.(message.canEdit)
            // Al perder la edición, cambios locales aún no aceptados quedarían solo en este equipo:
            // se reconecta para partir exactamente del contenido del servidor
            if (lostEdit) socket.close(RESYNC_CODE, 'Permisos actualizados')
            break
          }
        }
      }

      socket.onclose = (event) => {
        if (socketRef.current === socket) socketRef.current = null
        syncedRef.current = false
        doc.destroy()
        if (disposed) return

        setCollaborators([])
        if (FATAL_CLOSE_CODES.has(event.code)) {
          setStatus('error')
          setErrorMessage(event.reason || 'No fue posible unirse a la edición colaborativa')
          if (event.code === ACCESS_REVOKED_CODE) {
            callbacksRef.current.onAccessRevoked?.(event.reason || 'Ya no tienes acceso a este proyecto')
          }
          return
        }

        // Resincronización pedida por este mismo cliente: reconectar de inmediato
        if (event.code !== RESYNC_CODE) attempts++
        setStatus('reconnecting')
        const delay = Math.min(MAX_RECONNECT_DELAY_MS, 500 * 2 ** Math.min(attempts, 5))
        reconnectTimer = setTimeout(connect, delay)
      }
    }

    connect()

    return () => {
      disposed = true
      if (reconnectTimer) clearTimeout(reconnectTimer)
      if (cursorTimerRef.current) clearTimeout(cursorTimerRef.current)
      cursorTimerRef.current = null
      socketRef.current?.close(1000, 'Documento cerrado')
      socketRef.current = null
      docRef.current = null
      syncedRef.current = false
      setCollaborators([])
    }
  }, [documentId, enabled, refreshCollaborators])

  /**
   * Aplica una edición local (el texto completo del editor tras el cambio) al documento compartido.
   * @returns false si no hay conexión o el usuario no puede editar, para que el editor no la acepte
   */
  const applyLocalChange = useCallback((nextContent: string): boolean => {
    const doc = docRef.current
    if (!doc || !syncedRef.current || !canEditRef.current) return false

    const text = doc.getText(TEXT_KEY)
    const change = computeTextChange(text.toString(), nextContent)
    if (!change) return true

    doc.transact(() => {
      if (change.deleteCount > 0) text.delete(change.index, change.deleteCount)
      if (change.insert) text.insert(change.index, change.insert)
    }, LOCAL_ORIGIN)
    refreshCollaborators()
    return true
  }, [refreshCollaborators])

  /** Comparte la posición del cursor/selección local con el resto (limitado a ~16 envíos por segundo). */
  const updateCursor = useCallback((anchor: number, head: number) => {
    const doc = docRef.current
    if (!doc || !syncedRef.current) return
    const text = doc.getText(TEXT_KEY)
    pendingCursorRef.current = {
      anchor: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, Math.min(anchor, text.length))),
      head: Y.relativePositionToJSON(Y.createRelativePositionFromTypeIndex(text, Math.min(head, text.length))),
    }
    if (cursorTimerRef.current) return
    cursorTimerRef.current = setTimeout(() => {
      cursorTimerRef.current = null
      const socket = socketRef.current
      if (socket?.readyState === WebSocket.OPEN && pendingCursorRef.current) {
        socket.send(JSON.stringify({ type: 'cursor', cursor: pendingCursorRef.current }))
      }
    }, CURSOR_THROTTLE_MS)
  }, [])

  const isActive = status !== 'disabled'
  const isSynced = status === 'connected'

  return { status, isActive, isSynced, canEdit, errorMessage, collaborators, applyLocalChange, updateCursor }
}

export default useCollaboration
