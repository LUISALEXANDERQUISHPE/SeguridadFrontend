import Icon from '../../../components/common/Icon'
import type { Project } from '../../../types/project'
import { isOwner } from '../utils/projectList'

interface BulkActionsBarProps {
  selectedProjects: readonly Project[]
  isArchivedView: boolean
  onArchive: (projects: Project[]) => void
  onRestore: (projects: Project[]) => void
  onDelete: (projects: Project[]) => void
  onClear: () => void
}

/**
 * Acciones sobre varios proyectos seleccionados.
 * Solo se aplican a los proyectos de los que el usuario es propietario.
 */
export function BulkActionsBar({
  selectedProjects,
  isArchivedView,
  onArchive,
  onRestore,
  onDelete,
  onClear,
}: Readonly<BulkActionsBarProps>) {
  const owned = selectedProjects.filter(isOwner)
  const skipped = selectedProjects.length - owned.length
  const hasOwned = owned.length > 0

  return (
    <div className="pm-bulk-bar">
      <span className="pm-bulk-count">
        {selectedProjects.length} seleccionado(s)
        {skipped > 0 && <span className="pm-bulk-note"> · {skipped} compartido(s) no se modificarán</span>}
      </span>

      <div className="pm-bulk-actions">
        {isArchivedView ? (
          <button type="button" className="pm-btn pm-btn-ghost" disabled={!hasOwned} onClick={() => onRestore(owned)}>
            <Icon name="restore" /> Restaurar
          </button>
        ) : (
          <button type="button" className="pm-btn pm-btn-ghost" disabled={!hasOwned} onClick={() => onArchive(owned)}>
            <Icon name="archive" /> Archivar
          </button>
        )}
        <button type="button" className="pm-btn pm-btn-ghost is-danger" disabled={!hasOwned} onClick={() => onDelete(owned)}>
          <Icon name="trash" /> Eliminar
        </button>
        <button type="button" className="pm-icon-btn" onClick={onClear} aria-label="Quitar selección" title="Quitar selección">
          <Icon name="close" />
        </button>
      </div>
    </div>
  )
}

export default BulkActionsBar
