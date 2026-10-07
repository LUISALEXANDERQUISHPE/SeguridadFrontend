import React, { useState } from 'react'
import type { Project } from '../../types/project'
import EditorPage from '../editor/EditorPage'
import ProjectsSidebar from './components/ProjectsSidebar'

interface WorkspacePageProps {
  displayName: string
}

export const WorkspacePage: React.FC<WorkspacePageProps> = ({ displayName }) => {
  // El editor solo se muestra cuando hay un proyecto abierto (creado o seleccionado en la barra lateral)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const [editorReloadKey, setEditorReloadKey] = useState(0)
  const [isCreateOpen, setIsCreateOpen] = useState(false)

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
    }
  }

  return (
    <div className="workspace-root">
      <ProjectsSidebar
        openDocumentId={openDocumentId}
        isCreateOpen={isCreateOpen}
        onCreateOpenChange={setIsCreateOpen}
        onOpenProject={setOpenDocumentId}
        onProjectUpdated={handleProjectUpdated}
        onProjectClosed={handleProjectClosed}
      />

      <div className="workspace-main">
        {openDocumentId ? (
          <EditorPage key={`${openDocumentId}-${editorReloadKey}`} documentId={openDocumentId} />
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
