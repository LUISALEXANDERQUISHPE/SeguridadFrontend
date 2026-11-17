import { lazy, Suspense, useCallback, useState } from 'react'
import type { Project } from '../../types/project'
import ProjectDashboard from './ProjectDashboard'

// El editor (incluye pdf.js) se descarga solo cuando el usuario abre un proyecto
const EditorPage = lazy(() => import('../editor/EditorPage'))

interface EditorTab {
  id: string
  name: string
}

interface WorkspacePageProps {
  displayName: string
  onSignOut: () => void
}

/**
 * Espacio de trabajo autenticado. Igual que Overleaf, muestra el panel de proyectos
 * y, al abrir uno, el editor a pantalla completa con pestañas para los archivos abiertos.
 */
export function WorkspacePage({ displayName, onSignOut }: Readonly<WorkspacePageProps>) {
  const [openProject, setOpenProject] = useState<Project | null>(null)
  const [openDocumentId, setOpenDocumentId] = useState<string | null>(null)
  const [openTabs, setOpenTabs] = useState<EditorTab[]>([])

  const openProjectInEditor = (project: Project) => {
    if (!project.documentId) return
    setOpenProject(project)
    setOpenTabs([{ id: project.documentId, name: project.documentName ?? 'Cargando...' }])
    setOpenDocumentId(project.documentId)
  }

  const closeEditor = () => {
    setOpenProject(null)
    setOpenDocumentId(null)
    setOpenTabs([])
  }

  // Abre un archivo del proyecto en una pestaña (o activa la pestaña si ya estaba abierta)
  const handleDocumentOpen = (documentId: string) => {
    if (!documentId) {
      setOpenDocumentId(null)
      return
    }
    setOpenTabs((previous) =>
      previous.some((tab) => tab.id === documentId) ? previous : [...previous, { id: documentId, name: 'Cargando...' }],
    )
    setOpenDocumentId(documentId)
  }

  const handleDocumentNameLoaded = useCallback((id: string, name: string) => {
    setOpenTabs((previous) => previous.map((tab) => (tab.id === id ? { ...tab, name } : tab)))
  }, [])

  const handleTabClose = (documentId: string) => {
    const remaining = openTabs.filter((tab) => tab.id !== documentId)
    setOpenTabs(remaining)
    if (documentId === openDocumentId) {
      setOpenDocumentId(remaining.at(-1)?.id ?? null)
    }
  }

  const handleDocumentDeleted = (documentId: string) => {
    setOpenTabs((previous) => previous.filter((tab) => tab.id !== documentId))
  }

  if (!openProject) {
    return <ProjectDashboard displayName={displayName} onOpenProject={openProjectInEditor} onSignOut={onSignOut} />
  }

  return (
    <Suspense fallback={<div className="loading-screen">Abriendo el editor...</div>}>
      <EditorPage
        key={openProject.id}
        documentId={openDocumentId}
        projectId={openProject.id}
        projectName={openProject.name}
        onBack={closeEditor}
        onDocumentOpen={handleDocumentOpen}
        onDocumentDeleted={handleDocumentDeleted}
        openTabs={openTabs}
        onCloseTab={handleTabClose}
        onDocumentNameLoaded={handleDocumentNameLoaded}
      />
    </Suspense>
  )
}

export default WorkspacePage
