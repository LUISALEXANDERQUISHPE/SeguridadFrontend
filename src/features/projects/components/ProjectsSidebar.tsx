import React, { useCallback, useEffect, useRef, useState } from 'react'
import type { Project } from '../../../types/project'
import {
  archiveProject,
  createProject,
  deleteProject,
  duplicateProject,
  getProjects,
  restoreProject,
  updateProject,
} from '../../../services/projectService'
import { downloadPdfFile, downloadSourceFile } from '../../../services/documentService'
import { ConfirmModal, ProjectFormModal } from './ProjectModals'

type ProjectsView = 'active' | 'archived'

type ModalState =
  | { type: 'edit'; project: Project }
  | { type: 'duplicate'; project: Project }
  | { type: 'archive'; project: Project }
  | { type: 'delete'; project: Project }
  | null

// Tamaño máximo aceptado al subir un archivo .tex (2 MB)
const MAX_UPLOAD_BYTES = 2 * 1024 * 1024

const ROLE_LABELS: Record<string, string> = {
  propietario: 'Propietario',
  editor: 'Editor',
  revisor: 'Revisor',
  invitado: 'Invitado',
}

interface ProjectsSidebarProps {
  // Documento abierto actualmente en el editor (para resaltar su proyecto)
  openDocumentId: string | null
  isCreateOpen: boolean
  onCreateOpenChange: (open: boolean) => void
  onOpenProject: (documentId: string) => void
  // Se invoca cuando un proyecto cambia de nombre, se archiva o se elimina
  onProjectUpdated: (project: Project) => void
  onProjectClosed: (project: Project) => void
}

export const ProjectsSidebar: React.FC<ProjectsSidebarProps> = ({
  openDocumentId,
  isCreateOpen,
  onCreateOpenChange,
  onOpenProject,
  onProjectUpdated,
  onProjectClosed,
}) => {
  const [projects, setProjects] = useState<Project[]>([])
  const [view, setView] = useState<ProjectsView>('active')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [modal, setModal] = useState<ModalState>(null)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [isCollapsed, setIsCollapsed] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const loadProjects = useCallback(async (currentView: ProjectsView) => {
    setLoading(true)
    setError(null)
    try {
      setProjects(await getProjects(currentView === 'archived'))
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al listar los proyectos')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadProjects(view)
  }, [view, loadProjects])

  const changeView = (newView: ProjectsView) => {
    if (newView === view) return
    setProjects([])
    setNotice(null)
    setExpandedId(null)
    setView(newView)
  }

  const filteredProjects = projects.filter((project) => {
    const term = searchTerm.toLowerCase()
    return (
      project.name.toLowerCase().includes(term) ||
      project.description.toLowerCase().includes(term) ||
      project.ownerName.toLowerCase().includes(term)
    )
  })

  // 1. Abrir proyecto en el editor
  const handleOpen = (project: Project) => {
    if (!project.documentId) {
      setError('Este proyecto no tiene un archivo .tex principal para abrir')
      return
    }
    setError(null)
    setNotice(null)
    onOpenProject(project.documentId)
  }

  // 2. Crear proyecto y abrirlo en el editor
  const handleCreate = async (name: string, description: string) => {
    const project = await createProject({ name, description })
    setNotice(`Proyecto "${project.name}" creado`)
    if (view === 'active') {
      await loadProjects(view)
    } else {
      changeView('active')
    }
    if (project.documentId) {
      onOpenProject(project.documentId)
    }
  }

  // Crear un proyecto a partir de un archivo .tex del equipo del usuario
  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return

    if (!file.name.toLowerCase().endsWith('.tex')) {
      setError('Solo se pueden subir archivos .tex')
      return
    }
    if (file.size > MAX_UPLOAD_BYTES) {
      setError('El archivo supera el tamaño máximo permitido (2 MB)')
      return
    }

    setIsUploading(true)
    setError(null)
    try {
      const content = await file.text()
      const project = await createProject({ name: file.name.replace(/\.tex$/i, ''), content })
      setNotice(`Proyecto "${project.name}" creado desde ${file.name}`)
      if (view === 'active') {
        await loadProjects(view)
      } else {
        changeView('active')
      }
      if (project.documentId) {
        onOpenProject(project.documentId)
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al subir el archivo')
    } finally {
      setIsUploading(false)
    }
  }

  // 3. Modificar nombre y descripción
  const handleEdit = async (project: Project, name: string, description: string) => {
    const updated = await updateProject(project.id, { name, description })
    setProjects((prev) => prev.map((p) => (p.id === project.id ? { ...p, ...updated, ownerName: p.ownerName } : p)))
    setNotice(`Proyecto "${updated.name}" actualizado`)
    onProjectUpdated(updated)
  }

  // 4. Duplicar proyecto
  const handleDuplicate = async (project: Project, name: string) => {
    const copy = await duplicateProject(project.id, name)
    setNotice(`Se creó la copia "${copy.name}"`)
    if (view === 'active') {
      await loadProjects(view)
    }
  }

  // 5. Archivar y restaurar
  const handleArchive = async (project: Project) => {
    await archiveProject(project.id)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    setNotice(`Proyecto "${project.name}" archivado`)
    onProjectClosed(project)
  }

  const handleRestore = async (project: Project) => {
    setBusyId(project.id)
    setError(null)
    try {
      await restoreProject(project.id)
      setProjects((prev) => prev.filter((p) => p.id !== project.id))
      setNotice(`Proyecto "${project.name}" restaurado`)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al restaurar el proyecto')
    } finally {
      setBusyId(null)
    }
  }

  // 6. Eliminar de forma permanente
  const handleDelete = async (project: Project) => {
    await deleteProject(project.id)
    setProjects((prev) => prev.filter((p) => p.id !== project.id))
    setNotice(`Proyecto "${project.name}" eliminado`)
    onProjectClosed(project)
  }

  // 7. Descargas
  const handleDownloadSource = async (project: Project) => {
    if (!project.documentId) return
    setError(null)
    await downloadSourceFile(project.documentId, project.documentName || `${project.name}.tex`)
  }

  const handleDownloadPdf = async (project: Project) => {
    if (!project.documentId) return
    setError(null)
    try {
      await downloadPdfFile(project.documentId, project.name)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al descargar el PDF')
    }
  }

  const renderCompilation = (project: Project) => {
    if (project.lastCompilation?.status === 'exitosa') {
      return <span className="table-badge badge-ok">✓ Compilado</span>
    }
    if (project.lastCompilation?.status) {
      return <span className="table-badge badge-err">✕ {project.lastCompilation.status}</span>
    }
    return <span className="table-badge badge-neutral">Sin compilar</span>
  }

  const renderActions = (project: Project) => {
    const isOwner = project.role === 'propietario'
    const isBusy = busyId === project.id

    return (
      <div className="project-actions">
        {view === 'active' && isOwner && (
          <button
            type="button"
            className="project-action-btn"
            onClick={() => setModal({ type: 'edit', project })}
            title="Modificar nombre y descripción"
          >
            Editar
          </button>
        )}
        <button
          type="button"
          className="project-action-btn"
          onClick={() => setModal({ type: 'duplicate', project })}
          title="Crear una copia del proyecto"
        >
          Duplicar
        </button>
        {project.documentId && (
          <>
            <button
              type="button"
              className="project-action-btn"
              onClick={() => void handleDownloadSource(project)}
              title="Descargar el código fuente .tex"
            >
              ⬇ .tex
            </button>
            <button
              type="button"
              className="project-action-btn"
              onClick={() => void handleDownloadPdf(project)}
              title="Descargar el último PDF compilado"
            >
              ⬇ PDF
            </button>
          </>
        )}
        {view === 'active' && isOwner && (
          <button
            type="button"
            className="project-action-btn"
            onClick={() => setModal({ type: 'archive', project })}
            title="Ocultar del listado principal sin eliminar"
          >
            Archivar
          </button>
        )}
        {view === 'archived' && isOwner && (
          <button
            type="button"
            className="project-action-btn"
            onClick={() => void handleRestore(project)}
            disabled={isBusy}
            title="Devolver al listado principal"
          >
            {isBusy ? 'Restaurando...' : 'Restaurar'}
          </button>
        )}
        {isOwner && (
          <button
            type="button"
            className="project-action-btn action-danger"
            onClick={() => setModal({ type: 'delete', project })}
            title="Eliminar de forma permanente"
          >
            Eliminar
          </button>
        )}
      </div>
    )
  }

  return (
    <aside className={`projects-sidebar ${isCollapsed ? 'collapsed' : ''}`}>
      {isCollapsed ? (
        <button
          type="button"
          className="sidebar-toggle-btn"
          onClick={() => setIsCollapsed(false)}
          title="Mostrar la barra de proyectos"
        >
          »
        </button>
      ) : (
        <>
          <div className="sidebar-header">
            <span className="sidebar-title">Proyectos</span>
            <button
              type="button"
              className="sidebar-toggle-btn"
              onClick={() => setIsCollapsed(true)}
              title="Ocultar la barra de proyectos"
            >
              «
            </button>
          </div>

          <div className="sidebar-controls">
            <button
              type="button"
              className="toolbar-btn btn-compile sidebar-new-btn"
              onClick={() => onCreateOpenChange(true)}
            >
              ➕ Nuevo proyecto
            </button>
            <button
              type="button"
              className="toolbar-btn btn-secondary sidebar-new-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="Crear un proyecto a partir de un archivo .tex de tu equipo"
            >
              {isUploading ? 'Subiendo...' : '⬆ Subir archivo .tex'}
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".tex"
              hidden
              onChange={(e) => void handleUpload(e)}
            />
            <input
              type="text"
              placeholder="Buscar proyecto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="modal-search-input sidebar-search"
            />
            <div className="sidebar-tabs">
              <button
                type="button"
                className={`nav-link ${view === 'active' ? 'active' : ''}`}
                onClick={() => changeView('active')}
              >
                Activos
              </button>
              <button
                type="button"
                className={`nav-link ${view === 'archived' ? 'active' : ''}`}
                onClick={() => changeView('archived')}
              >
                Archivados
              </button>
            </div>
          </div>

          {error && <div className="modal-error sidebar-message">{error}</div>}
          {notice && !error && <div className="form-message success-message sidebar-message">{notice}</div>}

          <div className="sidebar-list">
            {loading ? (
              <div className="modal-loading">Cargando tus proyectos...</div>
            ) : filteredProjects.length === 0 ? (
              <div className="modal-empty-state">
                <p>
                  {searchTerm
                    ? 'No hay proyectos que coincidan con la búsqueda.'
                    : view === 'archived'
                      ? 'No tienes proyectos archivados.'
                      : 'Aún no tienes proyectos. Crea el primero.'}
                </p>
              </div>
            ) : (
              filteredProjects.map((project) => {
                const isOwner = project.role === 'propietario'
                const isOpen = !!project.documentId && project.documentId === openDocumentId
                const isExpanded = expandedId === project.id

                return (
                  <div key={project.id} className={`sidebar-project ${isOpen ? 'is-open' : ''}`}>
                    <div className="sidebar-project-row">
                      <button
                        type="button"
                        className="sidebar-project-main"
                        onClick={view === 'active' ? () => handleOpen(project) : undefined}
                        disabled={view === 'archived'}
                        title={view === 'active' ? 'Abrir en el editor' : project.name}
                      >
                        <span className="sidebar-project-name">
                          <span className="doc-type-icon">📁</span>
                          <strong>{project.name}</strong>
                        </span>
                        {project.description && (
                          <span className="sidebar-project-desc">{project.description}</span>
                        )}
                        <span className="sidebar-project-meta">
                          {project.updatedAt ? new Date(project.updatedAt).toLocaleString() : '—'}
                          {!isOwner && ` · ${project.ownerName || '—'} (${ROLE_LABELS[project.role] || project.role})`}
                        </span>
                        <span className="sidebar-project-meta">{renderCompilation(project)}</span>
                      </button>
                      <button
                        type="button"
                        className="sidebar-more-btn"
                        onClick={() => setExpandedId(isExpanded ? null : project.id)}
                        title="Opciones del proyecto"
                        aria-expanded={isExpanded}
                      >
                        ⋯
                      </button>
                    </div>
                    {isExpanded && renderActions(project)}
                  </div>
                )
              })
            )}
          </div>
        </>
      )}

      {/* Modales */}
      <ProjectFormModal
        isOpen={isCreateOpen}
        title="Crear Nuevo Proyecto LaTeX"
        submitLabel="Crear proyecto"
        submittingLabel="Creando..."
        info="Se inicializará con la plantilla estándar de LaTeX y se abrirá en el editor."
        onClose={() => onCreateOpenChange(false)}
        onSubmit={handleCreate}
      />

      <ProjectFormModal
        isOpen={modal?.type === 'edit'}
        title="Modificar Proyecto"
        submitLabel="Guardar cambios"
        submittingLabel="Guardando..."
        initialName={modal?.type === 'edit' ? modal.project.name : ''}
        initialDescription={modal?.type === 'edit' ? modal.project.description : ''}
        onClose={() => setModal(null)}
        onSubmit={(name, description) =>
          modal?.type === 'edit' ? handleEdit(modal.project, name, description) : Promise.resolve()
        }
      />

      <ProjectFormModal
        isOpen={modal?.type === 'duplicate'}
        title="Duplicar Proyecto"
        submitLabel="Duplicar"
        submittingLabel="Duplicando..."
        initialName={modal?.type === 'duplicate' ? `${modal.project.name} (copia)`.slice(0, 120) : ''}
        showDescription={false}
        info="Se copiarán todos los archivos del proyecto. Serás el propietario de la copia."
        onClose={() => setModal(null)}
        onSubmit={(name) => (modal?.type === 'duplicate' ? handleDuplicate(modal.project, name) : Promise.resolve())}
      />

      <ConfirmModal
        isOpen={modal?.type === 'archive'}
        title="Archivar Proyecto"
        message={
          modal?.type === 'archive'
            ? `El proyecto "${modal.project.name}" dejará de mostrarse en el listado principal. Podrás restaurarlo desde la pestaña Archivados.`
            : ''
        }
        confirmLabel="Archivar"
        confirmingLabel="Archivando..."
        onClose={() => setModal(null)}
        onConfirm={() => (modal?.type === 'archive' ? handleArchive(modal.project) : Promise.resolve())}
      />

      <ConfirmModal
        isOpen={modal?.type === 'delete'}
        title="Eliminar Proyecto"
        message={
          modal?.type === 'delete'
            ? `Se eliminará de forma permanente el proyecto "${modal.project.name}" junto con sus archivos, historial de versiones y compilaciones. Esta acción no se puede deshacer.`
            : ''
        }
        confirmLabel="Eliminar definitivamente"
        confirmingLabel="Eliminando..."
        danger
        onClose={() => setModal(null)}
        onConfirm={() => (modal?.type === 'delete' ? handleDelete(modal.project) : Promise.resolve())}
      />
    </aside>
  )
}

export default ProjectsSidebar
