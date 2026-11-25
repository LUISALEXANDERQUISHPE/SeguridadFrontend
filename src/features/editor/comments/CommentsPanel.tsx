import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import Icon from '../../../components/common/Icon'
import type { CommentReply, CommentThread } from '../../../services/commentService'
import type { ResolvedAnchor } from './commentAnchors'

const MAX_LENGTH = 2000

export interface CommentDraft {
  start: number
  end: number
  quote: string
}

interface CommentsPanelProps {
  threads: CommentThread[]
  anchors: Map<string, ResolvedAnchor>
  activeThreadId: string | null
  isLoading: boolean
  error: string | null
  canComment: boolean
  canResolve: boolean
  draft: CommentDraft | null
  onStartComment: () => void
  onSubmitDraft: (content: string) => Promise<boolean>
  onCancelDraft: () => void
  onActivate: (thread: CommentThread) => void
  onReply: (threadId: string, content: string) => Promise<boolean>
  onEdit: (commentId: string, content: string) => Promise<boolean>
  onSetResolved: (threadId: string, resolved: boolean) => Promise<boolean>
  onDelete: (commentId: string) => Promise<boolean>
  onDismissError: () => void
  onClose: () => void
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('es', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })

const shorten = (text: string, max = 90) => (text.length > max ? `${text.slice(0, max)}…` : text)

/** Cuadro de texto de comentario: Ctrl+Enter envía, Escape cancela. */
function CommentBox({
  initial = '',
  placeholder,
  submitLabel,
  onSubmit,
  onCancel,
}: Readonly<{
  initial?: string
  placeholder: string
  submitLabel: string
  onSubmit: (content: string) => Promise<boolean>
  onCancel?: () => void
}>) {
  const [text, setText] = useState(initial)
  const [isSending, setIsSending] = useState(false)
  const ref = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    ref.current?.focus()
  }, [])

  const submit = async () => {
    if (!text.trim() || isSending) return
    setIsSending(true)
    const ok = await onSubmit(text)
    setIsSending(false)
    if (ok) setText('')
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
      event.preventDefault()
      void submit()
    } else if (event.key === 'Escape' && onCancel) {
      event.preventDefault()
      onCancel()
    }
  }

  return (
    <div className="comment-box">
      <textarea
        ref={ref}
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        maxLength={MAX_LENGTH}
        rows={3}
        aria-label={placeholder}
      />
      <div className="comment-box-actions">
        {onCancel && (
          <button type="button" className="comment-btn" onClick={onCancel} disabled={isSending}>
            Cancelar
          </button>
        )}
        <button type="button" className="comment-btn is-primary" onClick={() => void submit()} disabled={isSending || !text.trim()}>
          {isSending ? 'Enviando...' : submitLabel}
        </button>
      </div>
    </div>
  )
}

/** Un comentario (principal o respuesta) con sus acciones de editar y eliminar. */
function CommentItem({
  comment,
  canDelete,
  canEditOwn,
  onEdit,
  onDelete,
}: Readonly<{
  comment: CommentReply
  canDelete: boolean
  canEditOwn: boolean
  onEdit: (commentId: string, content: string) => Promise<boolean>
  onDelete: (commentId: string) => Promise<boolean>
}>) {
  const [isEditing, setIsEditing] = useState(false)

  return (
    <div className="comment-item">
      <div className="comment-meta">
        <span className="comment-avatar" aria-hidden="true">{comment.author.name.charAt(0).toUpperCase()}</span>
        <span className="comment-author">{comment.isOwn ? 'Tú' : comment.author.name}</span>
        <span className="comment-date">
          {formatDate(comment.createdAt)}
          {comment.updatedAt && ' · editado'}
        </span>
      </div>
      {isEditing ? (
        <CommentBox
          initial={comment.content}
          placeholder="Edita tu comentario"
          submitLabel="Guardar"
          onCancel={() => setIsEditing(false)}
          onSubmit={async (content) => {
            const ok = await onEdit(comment.id, content)
            if (ok) setIsEditing(false)
            return ok
          }}
        />
      ) : (
        // Texto plano: React escapa el contenido, así un comentario nunca se interpreta como HTML
        <p className="comment-content">{comment.content}</p>
      )}
      {!isEditing && (canEditOwn || canDelete) && (
        <div className="comment-item-actions">
          {canEditOwn && (
            <button type="button" className="comment-link" onClick={() => setIsEditing(true)}>Editar</button>
          )}
          {canDelete && (
            <button
              type="button"
              className="comment-link is-danger"
              onClick={() => {
                if (window.confirm('¿Eliminar este comentario?')) void onDelete(comment.id)
              }}
            >
              Eliminar
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * HU-25: Panel de comentarios del archivo (como el panel de revisión de Overleaf):
 * hilos ordenados por posición, respuestas, resolver/reabrir, editar y eliminar.
 */
export function CommentsPanel({
  threads,
  anchors,
  activeThreadId,
  isLoading,
  error,
  canComment,
  canResolve,
  draft,
  onStartComment,
  onSubmitDraft,
  onCancelDraft,
  onActivate,
  onReply,
  onEdit,
  onSetResolved,
  onDelete,
  onDismissError,
  onClose,
}: Readonly<CommentsPanelProps>) {
  const [showResolved, setShowResolved] = useState(false)
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const activeRef = useRef<HTMLElement | null>(null)

  const open = threads.filter((thread) => !thread.resolved)
  const resolved = threads.filter((thread) => thread.resolved)
  const visible = showResolved ? resolved : open

  // Al activar un hilo desde el texto, se lleva a la vista en el panel
  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [activeThreadId])

  const canDelete = (comment: CommentReply) => (comment.isOwn && canComment) || canResolve

  return (
    <aside className="comments-panel" aria-label="Comentarios">
      <header className="comments-header">
        <h2 className="comments-title">
          <Icon name="edit" size={15} /> Comentarios
        </h2>
        <button type="button" className="comments-close" onClick={onClose} aria-label="Cerrar comentarios">
          <Icon name="close" size={14} />
        </button>
      </header>

      <div className="comments-tabs" role="tablist" aria-label="Filtrar comentarios">
        <button type="button" role="tab" aria-selected={!showResolved} className={`comments-tab ${!showResolved ? 'is-active' : ''}`} onClick={() => setShowResolved(false)}>
          Abiertos <span className="comments-count">{open.length}</span>
        </button>
        <button type="button" role="tab" aria-selected={showResolved} className={`comments-tab ${showResolved ? 'is-active' : ''}`} onClick={() => setShowResolved(true)}>
          Resueltos <span className="comments-count">{resolved.length}</span>
        </button>
      </div>

      {canComment ? (
        draft ? (
          <section className="comment-thread is-draft">
            <p className="comment-quote" title={draft.quote}>«{shorten(draft.quote)}»</p>
            <CommentBox placeholder="Escribe un comentario (Ctrl+Enter para enviar)" submitLabel="Comentar" onSubmit={onSubmitDraft} onCancel={onCancelDraft} />
          </section>
        ) : (
          <button type="button" className="comments-add-btn" onClick={onStartComment}>
            <Icon name="plus" size={14} /> Comentar la selección
          </button>
        )
      ) : (
        <p className="comments-note">Tienes acceso de solo lectura: puedes ver los comentarios, pero no agregar nuevos.</p>
      )}

      {error && (
        <p className="comments-error" role="alert">
          {error}
          <button type="button" onClick={onDismissError} aria-label="Cerrar aviso"><Icon name="close" size={12} /></button>
        </p>
      )}

      <div className="comments-list">
        {isLoading && <p className="comments-empty">Cargando comentarios...</p>}
        {!isLoading && visible.length === 0 && (
          <p className="comments-empty">
            {showResolved ? 'No hay hilos resueltos.' : 'No hay comentarios abiertos. Selecciona texto en el editor y pulsa "Comentar la selección".'}
          </p>
        )}
        {visible.map((thread) => {
          const anchor = anchors.get(thread.id)
          const isActive = thread.id === activeThreadId
          return (
            <section
              key={thread.id}
              ref={isActive ? (element) => { activeRef.current = element } : undefined}
              className={`comment-thread ${isActive ? 'is-active' : ''} ${thread.resolved ? 'is-resolved' : ''}`}
            >
              {thread.quotedText && (
                <button
                  type="button"
                  className="comment-quote"
                  onClick={() => onActivate(thread)}
                  disabled={anchor?.status === 'lost'}
                  title={anchor?.status === 'lost' ? 'El texto comentado ya no está en el documento' : 'Ir al texto comentado'}
                >
                  «{shorten(thread.quotedText)}»
                  {anchor?.status === 'lost' && <span className="comment-lost-tag">texto modificado</span>}
                </button>
              )}

              <CommentItem comment={thread} canDelete={canDelete(thread)} canEditOwn={thread.isOwn && canComment} onEdit={onEdit} onDelete={onDelete} />
              {thread.replies.map((reply) => (
                <CommentItem key={reply.id} comment={reply} canDelete={canDelete(reply)} canEditOwn={reply.isOwn && canComment} onEdit={onEdit} onDelete={onDelete} />
              ))}

              {replyingTo === thread.id ? (
                <CommentBox
                  placeholder="Responder (Ctrl+Enter para enviar)"
                  submitLabel="Responder"
                  onCancel={() => setReplyingTo(null)}
                  onSubmit={async (content) => {
                    const ok = await onReply(thread.id, content)
                    if (ok) setReplyingTo(null)
                    return ok
                  }}
                />
              ) : (
                <div className="comment-thread-actions">
                  {canComment && !thread.resolved && (
                    <button type="button" className="comment-btn" onClick={() => setReplyingTo(thread.id)}>Responder</button>
                  )}
                  {canResolve && (
                    <button type="button" className="comment-btn" onClick={() => void onSetResolved(thread.id, !thread.resolved)}>
                      {thread.resolved ? 'Reabrir' : 'Resolver'}
                    </button>
                  )}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </aside>
  )
}

export default CommentsPanel
