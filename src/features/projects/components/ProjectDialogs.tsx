import type { Project } from '../../../types/project'
import { PROJECT_LIMITS, type ProjectModalState } from '../types'
import { ConfirmModal, ProjectFormModal } from './ProjectModals'

interface ProjectDialogsProps {
  modal: ProjectModalState
  onClose: () => void
  onCreate: (name: string, description: string) => Promise<void>
  onEdit: (project: Project, name: string, description: string) => Promise<void>
  onDuplicate: (project: Project, name: string) => Promise<void>
  onArchive: (projects: Project[]) => Promise<void>
  onDelete: (projects: Project[]) => Promise<void>
}

function describeTarget(projects: readonly Project[]): string {
  return projects.length === 1 ? `el proyecto "${projects[0].name}"` : `${projects.length} proyectos`
}

/** Muestra el modal correspondiente al estado actual del panel de proyectos. */
export function ProjectDialogs({
  modal,
  onClose,
  onCreate,
  onEdit,
  onDuplicate,
  onArchive,
  onDelete,
}: Readonly<ProjectDialogsProps>) {
  if (!modal) return null

  switch (modal.type) {
    case 'create':
      return (
        <ProjectFormModal
          title="Nuevo proyecto"
          submitLabel="Crear"
          submittingLabel="Creando..."
          info="Se inicializará con la plantilla estándar de LaTeX y se abrirá en el editor."
          onClose={onClose}
          onSubmit={onCreate}
        />
      )
    case 'edit':
      return (
        <ProjectFormModal
          title="Renombrar proyecto"
          submitLabel="Guardar cambios"
          submittingLabel="Guardando..."
          initialName={modal.project.name}
          initialDescription={modal.project.description}
          onClose={onClose}
          onSubmit={(name, description) => onEdit(modal.project, name, description)}
        />
      )
    case 'duplicate':
      return (
        <ProjectFormModal
          title="Duplicar proyecto"
          submitLabel="Duplicar"
          submittingLabel="Duplicando..."
          initialName={`${modal.project.name} (copia)`.slice(0, PROJECT_LIMITS.MAX_NAME_LENGTH)}
          showDescription={false}
          info="Se copiarán todos los archivos del proyecto. Serás el propietario de la copia."
          onClose={onClose}
          onSubmit={(name) => onDuplicate(modal.project, name)}
        />
      )
    case 'archive':
      return (
        <ConfirmModal
          title="Archivar proyecto"
          message={`Vas a archivar ${describeTarget(modal.projects)}. Dejará de mostrarse en el listado principal y podrás restaurarlo desde "Archivados".`}
          confirmLabel="Archivar"
          confirmingLabel="Archivando..."
          onClose={onClose}
          onConfirm={() => onArchive(modal.projects)}
        />
      )
    case 'delete':
      return (
        <ConfirmModal
          title="Eliminar proyecto"
          message={`Se eliminará de forma permanente ${describeTarget(modal.projects)} junto con sus archivos, historial de versiones y compilaciones. Esta acción no se puede deshacer.`}
          confirmLabel="Eliminar definitivamente"
          confirmingLabel="Eliminando..."
          danger
          onClose={onClose}
          onConfirm={() => onDelete(modal.projects)}
        />
      )
    default:
      return null
  }
}

export default ProjectDialogs
