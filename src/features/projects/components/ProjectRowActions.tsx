import Icon, { type IconName } from '../../../components/common/Icon'
import type { Project } from '../../../types/project'
import { isOwner } from '../utils/projectList'

export interface ProjectActionHandlers {
  onEdit: (project: Project) => void
  onDuplicate: (project: Project) => void
  onDownloadSource: (project: Project) => void
  onDownloadPdf: (project: Project) => void
  onArchive: (project: Project) => void
  onRestore: (project: Project) => void
  onDelete: (project: Project) => void
}

interface ActionDefinition {
  key: string
  label: string
  icon: IconName
  danger?: boolean
  onClick: () => void
}

interface ProjectRowActionsProps {
  project: Project
  isArchivedView: boolean
  handlers: ProjectActionHandlers
}

/**
 * Construye la lista de acciones disponibles según el rol del usuario y la sección actual.
 * Agregar una acción nueva solo requiere añadirla aquí (abierto a extensión).
 */
function buildActions(project: Project, isArchivedView: boolean, handlers: ProjectActionHandlers): ActionDefinition[] {
  const owner = isOwner(project)
  const actions: ActionDefinition[] = []

  if (owner && !isArchivedView) {
    actions.push({ key: 'edit', label: 'Renombrar', icon: 'edit', onClick: () => handlers.onEdit(project) })
  }

  actions.push({ key: 'copy', label: 'Duplicar', icon: 'copy', onClick: () => handlers.onDuplicate(project) })

  if (project.documentId) {
    actions.push(
      { key: 'tex', label: 'Descargar .tex', icon: 'download', onClick: () => handlers.onDownloadSource(project) },
      { key: 'pdf', label: 'Descargar PDF', icon: 'pdf', onClick: () => handlers.onDownloadPdf(project) },
    )
  }

  if (owner && isArchivedView) {
    actions.push({ key: 'restore', label: 'Restaurar', icon: 'restore', onClick: () => handlers.onRestore(project) })
  }

  if (owner && !isArchivedView) {
    actions.push({ key: 'archive', label: 'Archivar', icon: 'archive', onClick: () => handlers.onArchive(project) })
  }

  if (owner) {
    actions.push({
      key: 'delete',
      label: 'Eliminar',
      icon: 'trash',
      danger: true,
      onClick: () => handlers.onDelete(project),
    })
  }

  return actions
}

/** Íconos de acción de cada fila de la tabla, como en el panel de Overleaf. */
export function ProjectRowActions({ project, isArchivedView, handlers }: Readonly<ProjectRowActionsProps>) {
  return (
    <div className="pm-row-actions">
      {buildActions(project, isArchivedView, handlers).map((action) => (
        <button
          key={action.key}
          type="button"
          className={`pm-icon-btn ${action.danger ? 'is-danger' : ''}`}
          onClick={action.onClick}
          title={action.label}
          aria-label={`${action.label}: ${project.name}`}
        >
          <Icon name={action.icon} />
        </button>
      ))}
    </div>
  )
}

export default ProjectRowActions
