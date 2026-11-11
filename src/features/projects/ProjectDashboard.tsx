import { useMemo, useRef, useState, type ChangeEvent } from 'react'
import Icon from '../../components/common/Icon'
import type { Project } from '../../types/project'
import { downloadPdfFile, downloadSourceFile } from '../../services/documentService'
import { useProjects } from './hooks/useProjects'
import { useProjectSelection } from './hooks/useProjectSelection'
import { selectVisibleProjects } from './utils/projectList'
import { PROJECT_LIMITS, type ProjectFilter, type ProjectModalState, type SortKey, type SortState } from './types'
import DashboardSidebar from './components/DashboardSidebar'
import ProjectTable from './components/ProjectTable'
import BulkActionsBar from './components/BulkActionsBar'
import ProjectDialogs from './components/ProjectDialogs'
import type { ProjectActionHandlers } from './components/ProjectRowActions'
import './projects.css'

const SECTION_TITLES: Record<ProjectFilter, string> = {
  all: 'Todos los proyectos',
  owned: 'Tus proyectos',
  shared: 'Compartidos contigo',
  archived: 'Archivados',
}

const EMPTY_MESSAGES: Record<ProjectFilter, string> = {
  all: 'Aún no tienes proyectos. Crea el primero con "Nuevo proyecto".',
  owned: 'Todavía no has creado proyectos.',
  shared: 'Nadie ha compartido proyectos contigo todavía.',
  archived: 'No tienes proyectos archivados.',
}

const DEFAULT_SORT: SortState = { key: 'updatedAt', direction: 'desc' }

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

/** Lee y valida el archivo .tex elegido por el usuario. */
async function readTexFile(file: File): Promise<{ name: string; content: string }> {
  if (!file.name.toLowerCase().endsWith('.tex')) {
    throw new Error('Solo se pueden subir archivos .tex')
  }
  if (file.size > PROJECT_LIMITS.MAX_UPLOAD_BYTES) {
    throw new Error('El archivo supera el tamaño máximo permitido (2 MB)')
  }
  return { name: file.name.replace(/\.tex$/i, ''), content: await file.text() }
}

interface ProjectDashboardProps {
  displayName: string
  onOpenProject: (project: Project) => void
  onSignOut: () => void
}

/**
 * Panel principal de proyectos (HU-17), con la estructura del panel de Overleaf:
 * barra lateral con secciones, buscador, tabla ordenable y acciones por fila o en bloque.
 */
export function ProjectDashboard({ displayName, onOpenProject, onSignOut }: Readonly<ProjectDashboardProps>) {
  const [filter, setFilter] = useState<ProjectFilter>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [sort, setSort] = useState<SortState>(DEFAULT_SORT)
  const [modal, setModal] = useState<ProjectModalState>(null)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const isArchivedView = filter === 'archived'
  const store = useProjects(isArchivedView)

  const visibleProjects = useMemo(
    () => selectVisibleProjects(store.projects, filter, searchTerm, sort),
    [store.projects, filter, searchTerm, sort],
  )
  const selection = useProjectSelection(visibleProjects)

  const changeFilter = (next: ProjectFilter) => {
    setFilter(next)
    selection.clear()
    store.clearMessages()
  }

  const changeSort = (key: SortKey) => {
    setSort((prev) => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }))
  }

  const openProject = (project: Project) => {
    if (!project.documentId) {
      store.setError('Este proyecto no tiene un archivo .tex principal para abrir')
      return
    }
    onOpenProject(project)
  }

  const createAndOpen = async (name: string, description: string, content?: string) => {
    const project = await store.create({ name, description, content })
    if (filter !== 'all' && filter !== 'owned') changeFilter('all')
    openProject(project)
  }

  const handleUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setIsUploading(true)
    store.clearMessages()
    try {
      const { name, content } = await readTexFile(file)
      await createAndOpen(name, '', content)
    } catch (err: unknown) {
      store.setError(toMessage(err, 'Error al subir el archivo'))
    } finally {
      setIsUploading(false)
    }
  }

  const runWithFeedback = async (action: () => Promise<void>, fallback: string) => {
    store.clearMessages()
    try {
      await action()
    } catch (err: unknown) {
      store.setError(toMessage(err, fallback))
    }
  }

  const actionHandlers: ProjectActionHandlers = {
    onEdit: (project) => setModal({ type: 'edit', project }),
    onDuplicate: (project) => setModal({ type: 'duplicate', project }),
    onArchive: (project) => setModal({ type: 'archive', projects: [project] }),
    onDelete: (project) => setModal({ type: 'delete', projects: [project] }),
    onRestore: (project) => void runWithFeedback(() => store.restore([project]), 'Error al restaurar el proyecto'),
    onDownloadSource: (project) =>
      void runWithFeedback(
        () => downloadSourceFile(project.documentId ?? '', project.documentName ?? `${project.name}.tex`),
        'Error al descargar el código fuente',
      ),
    onDownloadPdf: (project) =>
      void runWithFeedback(
        () => downloadPdfFile(project.documentId ?? '', project.name),
        'Error al descargar el PDF',
      ),
  }

  const renderContent = () => {
    if (store.loading) {
      return <p className="pm-empty">Cargando tus proyectos...</p>
    }
    if (visibleProjects.length === 0) {
      const message = searchTerm ? 'No hay proyectos que coincidan con la búsqueda.' : EMPTY_MESSAGES[filter]
      return <p className="pm-empty">{message}</p>
    }
    return (
      <ProjectTable
        projects={visibleProjects}
        sort={sort}
        selection={selection}
        isArchivedView={isArchivedView}
        actionHandlers={actionHandlers}
        onSortChange={changeSort}
        onOpen={openProject}
      />
    )
  }

  return (
    <div className="pm-dashboard">
      <DashboardSidebar
        activeFilter={filter}
        displayName={displayName}
        isUploading={isUploading}
        onFilterChange={changeFilter}
        onCreateBlank={() => setModal({ type: 'create' })}
        onUpload={() => fileInputRef.current?.click()}
        onSignOut={onSignOut}
      />

      <input
        ref={fileInputRef}
        type="file"
        accept=".tex"
        hidden
        aria-label="Subir archivo .tex"
        onChange={(event) => void handleUpload(event)}
      />

      <main className="pm-main">
        <div className="pm-panel">
          <header className="pm-panel-header">
            <h1>{SECTION_TITLES[filter]}</h1>
            <span className="pm-count">{visibleProjects.length} proyecto(s)</span>
          </header>

          <div className="pm-search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Buscar en todos los proyectos..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              aria-label="Buscar proyectos"
            />
          </div>

          {store.error && (
            <p className="pm-alert pm-alert-error" role="alert">
              {store.error}
            </p>
          )}
          {store.notice && !store.error && (
            <output className="pm-alert pm-alert-success">{store.notice}</output>
          )}

          {selection.selectedProjects.length > 0 && (
            <BulkActionsBar
              selectedProjects={selection.selectedProjects}
              isArchivedView={isArchivedView}
              onArchive={(projects) => setModal({ type: 'archive', projects })}
              onDelete={(projects) => setModal({ type: 'delete', projects })}
              onRestore={(projects) =>
                void runWithFeedback(() => store.restore(projects), 'Error al restaurar los proyectos')
              }
              onClear={selection.clear}
            />
          )}

          <div className="pm-table-wrap">{renderContent()}</div>
        </div>
      </main>

      <ProjectDialogs
        modal={modal}
        onClose={() => setModal(null)}
        onCreate={(name, description) => createAndOpen(name, description)}
        onEdit={async (project, name, description) => {
          await store.update(project, { name, description })
        }}
        onDuplicate={async (project, name) => {
          await store.duplicate(project, name)
        }}
        onArchive={store.archive}
        onDelete={store.remove}
      />
    </div>
  )
}

export default ProjectDashboard
