import { useCallback, useEffect, useRef, useState } from 'react'
import {
  createCommentThread,
  deleteComment,
  editComment,
  getCommentThreads,
  replyToComment,
  setCommentResolved,
  type CommentThread,
  type NewCommentRequest,
} from '../../../services/commentService'

const EMPTY: CommentThread[] = []

const toMessage = (error: unknown) => (error instanceof Error ? error.message : 'No fue posible completar la operación')

/**
 * HU-25: Hilos de comentarios del archivo abierto. Se recargan cuando el servidor avisa
 * (comments-changed) que otro colaborador los modificó.
 */
export function useComments(documentId: string | null, enabled: boolean) {
  // Los hilos se guardan con el archivo al que pertenecen: al cambiar de archivo no se muestran los anteriores
  const [loaded, setLoaded] = useState<{ documentId: string; threads: CommentThread[] } | null>(null)
  const [error, setError] = useState<string | null>(null)
  const requestRef = useRef(0)

  const isCurrent = Boolean(enabled && documentId && loaded?.documentId === documentId)
  const threads = isCurrent ? loaded!.threads : EMPTY
  const isLoading = Boolean(enabled && documentId && !isCurrent && !error)

  const reload = useCallback(async () => {
    if (!documentId || !enabled) return
    const request = ++requestRef.current
    try {
      const list = await getCommentThreads(documentId)
      // Ignora respuestas viejas si se cambió de archivo mientras tanto
      if (request === requestRef.current) {
        setLoaded({ documentId, threads: list })
        setError(null)
      }
    } catch (err: unknown) {
      if (request === requestRef.current) setError(toMessage(err))
    }
  }, [documentId, enabled])

  useEffect(() => {
    void reload()
  }, [reload])

  /** Ejecuta una operación y recarga los hilos; devuelve false si falló (el error queda en "error"). */
  const run = useCallback(async (operation: () => Promise<unknown>): Promise<boolean> => {
    setError(null)
    try {
      await operation()
      await reload()
      return true
    } catch (err: unknown) {
      setError(toMessage(err))
      return false
    }
  }, [reload])

  return {
    threads,
    isLoading,
    error,
    clearError: () => setError(null),
    reload,
    create: (data: NewCommentRequest) => run(() => createCommentThread(documentId!, data)),
    reply: (threadId: string, content: string) => run(() => replyToComment(threadId, content)),
    edit: (commentId: string, content: string) => run(() => editComment(commentId, content)),
    setResolved: (threadId: string, resolved: boolean) => run(() => setCommentResolved(threadId, resolved)),
    remove: (commentId: string) => run(() => deleteComment(commentId)),
  }
}

export default useComments
