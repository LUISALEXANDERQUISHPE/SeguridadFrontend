import Icon from '../../../components/common/Icon'
import type { Collaborator, CollabStatus } from './useCollaboration'

const STATUS_TEXT: Partial<Record<CollabStatus, string>> = {
  connecting: 'Conectando...',
  reconnecting: 'Reconectando...',
  error: 'Sin colaboración',
}

const MAX_AVATARS = 4

function initials(name: string): string {
  const parts = name.trim().split(/[\s@._-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

interface CollaboratorsBarProps {
  status: CollabStatus
  collaborators: Collaborator[]
  errorMessage: string | null
  onShare?: () => void
}

/** Estado de la conexión en tiempo real, avatares de quienes editan ahora y botón para compartir. */
export function CollaboratorsBar({ status, collaborators, errorMessage, onShare }: Readonly<CollaboratorsBarProps>) {
  // Un mismo usuario puede tener el proyecto abierto en varias pestañas: se muestra una sola vez
  const uniqueUsers = [...new Map(collaborators.map((user) => [user.userId, user])).values()]
  const visible = uniqueUsers.slice(0, MAX_AVATARS)
  const hidden = uniqueUsers.length - visible.length
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
        <ul className="collab-avatars" aria-label="Colaboradores conectados">
          {visible.map((user) => (
            <li
              key={user.userId}
              className="collab-avatar"
              style={{ background: user.color }}
              title={`${user.name}${user.canEdit ? '' : ' (solo lectura)'} está editando`}
            >
              {initials(user.name)}
            </li>
          ))}
          {hidden > 0 && <li className="collab-avatar collab-avatar-more" title={`${hidden} más`}>+{hidden}</li>}
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
