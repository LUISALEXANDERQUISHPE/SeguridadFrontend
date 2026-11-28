import Icon from '../../../components/common/Icon'
import type { CollabStatus, ProjectPresenceUser } from './useCollaboration'

const STATUS_TEXT: Partial<Record<CollabStatus, string>> = {
  connecting: 'Conectando...',
  reconnecting: 'Reconectando...',
  error: 'Sin colaboración',
}

const MAX_AVATARS = 4

/** "William Andrés" -> "WA", "ana@correo.com" -> "AC". */
function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

interface CollaboratorsBarProps {
  status: CollabStatus
  /** Personas conectadas al proyecto (en cualquiera de sus archivos), sin incluirse a uno mismo. */
  users: ProjectPresenceUser[]
  errorMessage: string | null
  /** Archivo abierto por el usuario actual: indica quién está en el mismo archivo. */
  currentDocumentId?: string | null
  onShare?: () => void
}

/**
 * Avatares de quienes están en el proyecto ahora, junto al botón "Compartir" (como en Overleaf):
 * la inicial de cada persona y, al pasar el mouse, su nombre completo y el archivo que tiene abierto.
 */
export function CollaboratorsBar({ status, users, errorMessage, currentDocumentId, onShare }: Readonly<CollaboratorsBarProps>) {
  const visible = users.slice(0, MAX_AVATARS)
  const hidden = users.slice(MAX_AVATARS)
  const statusText = STATUS_TEXT[status]

  return (
    <div className="collab-bar">
      {statusText && (
        <span className={`collab-status is-${status}`} title={errorMessage ?? undefined}>
          <span className="collab-status-dot" aria-hidden="true" />
          {statusText}
        </span>
      )}

      {visible.length > 0 && (
        <ul className="collab-avatars" aria-label="Personas conectadas al proyecto">
          {visible.map((user) => {
            const where = user.documentId === currentDocumentId ? 'En este archivo' : `En ${user.documentName}`
            return (
              <li key={user.userId} className="collab-avatar-item">
                <span
                  className="collab-avatar"
                  style={{ background: user.color }}
                  tabIndex={0}
                  aria-label={`${user.name}. ${where}${user.canEdit ? '' : '. Solo lectura'}`}
                >
                  {initials(user.name)}
                </span>
                {/* Tooltip propio: aparece al pasar el mouse o al enfocar con el teclado */}
                <span className="collab-tooltip" role="tooltip">
                  <strong>{user.name}</strong>
                  <span>{where}</span>
                  {!user.canEdit && <span className="collab-tooltip-tag">Solo lectura</span>}
                </span>
              </li>
            )
          })}
          {hidden.length > 0 && (
            <li className="collab-avatar-item">
              <span className="collab-avatar collab-avatar-more" tabIndex={0} aria-label={`${hidden.length} personas más`}>
                +{hidden.length}
              </span>
              <span className="collab-tooltip" role="tooltip">
                {hidden.map((user) => <span key={user.userId}>{user.name}</span>)}
              </span>
            </li>
          )}
        </ul>
      )}

      {onShare && (
        <button type="button" className="ide-menu-trigger ide-menu-trigger-strong" onClick={onShare} title="Compartir proyecto">
          <Icon name="users" /> Compartir
        </button>
      )}
    </div>
  )
}

export default CollaboratorsBar
