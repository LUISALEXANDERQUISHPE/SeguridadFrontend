import React, { useCallback, useState } from 'react'
import type { Project } from '../../types/project'
import EditorPage from '../editor/EditorPage'
import ProjectsSidebar from './components/ProjectsSidebar'

interface WorkspacePageProps {
  displayName: string
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ displayName }) => {
  // El editor solo se muestra cuando hay un proyecto abierto (creado o seleccionado en la barra lateral)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const [isEditorOpen, setIsEditorOpen] = useState(false)
  const [editorReloadKey, setEditorReloadKey] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [openTabs, setOpenTabs] = useState<Array<{ id: string; name: string }>>([])
  const [openProjectId, setOpenProjectId] = useState<string | null>(null)

  const handleDocumentOpen = (documentId: string) => {
    if (!documentId) {
      setOpenDocumentId(null)
      return
    }
    setIsEditorOpen(true)
    setOpenTabs((previous) => previous.some((tab) => tab.id === documentId)
      ? previous
      : [...previous, { id: documentId, name: 'Cargando...' }])
    setOpenDocumentId(documentId)
  }

  const handleDocumentNameLoaded = useCallback((id: string, name: string) => {
    setOpenTabs((previous) => previous.map((tab) => tab.id === id ? { ...tab, name } : tab))
  }, [])

  const handleTabClose = (documentId: string) => {
    setOpenTabs((previous) => {
      const next = previous.filter((tab) => tab.id !== documentId)
      if (documentId === openDocumentId) {
        setOpenDocumentId(next[next.length - 1]?.id || null)
      }
      return next
    })
  }

  const handleDocumentDeleted = (documentId: string) => {
    setOpenTabs((previous) => previous.filter((tab) => tab.id !== documentId))
  }

  // Si se renombra el proyecto abierto, recargar el editor para reflejar el nuevo nombre
  const handleProjectUpdated = (project: Project) => {
    if (project.documentId && project.documentId === openDocumentId) {
      setEditorReloadKey((prev) => prev + 1)
    }
  }

  // Si se archiva o elimina el proyecto abierto, cerrar el editor
  const handleProjectClosed = (project: Project) => {
    if (project.documentId && project.documentId === openDocumentId) {
      setOpenDocumentId(null)
      setOpenTabs([])
      setIsEditorOpen(false)
      setOpenProjectId(null)
    }
  }

  return (
    <div className="workspace-root">
      {!isEditorOpen && (
        <ProjectsSidebar
          openDocumentId={openDocumentId}
          isCreateOpen={isCreateOpen}
          onCreateOpenChange={setIsCreateOpen}
          onOpenProject={handleDocumentOpen}
          onProjectUpdated={handleProjectUpdated}
          onProjectClosed={handleProjectClosed}
        />
      )}

      <div className="workspace-main">
        {isEditorOpen ? (
          <EditorPage
            documentId={openDocumentId}
            projectId={openProjectId}
            onDocumentOpen={handleDocumentOpen}
            onDocumentDeleted={handleDocumentDeleted}
            openTabs={openTabs}
            onCloseTab={handleTabClose}
            onDocumentNameLoaded={handleDocumentNameLoaded}
          />
        ) : (
          <section className="workspace-empty">
            <span className="eyebrow">Sesión activa</span>
            <h1>Tu espacio está listo.</h1>
            <p>
              Has iniciado sesión como <strong>{displayName}</strong>. Crea un proyecto nuevo o abre uno existente
              desde la barra lateral para comenzar a escribir.
            </p>
            <button type="button" className="submit-button" onClick={() => setIsCreateOpen(true)}>
              ➕ Nuevo proyecto
            </button>
          </section>
        )}
      </div>
    </div>
  )
}

export default WorkspacePage
