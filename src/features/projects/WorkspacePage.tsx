import { lazy, Suspense, useState } from 'react'
import type { Project } from '../../types/project'
import ProjectDashboard from './ProjectDashboard'

// El editor (incluye pdf.js) se descarga solo cuando el usuario abre un proyecto
const EditorPage = lazy(() => import('../editor/EditorPage'))

interface WorkspacePageProps {
  displayName: string
  onSignOut: () => void
}

/**
 * Espacio de trabajo autenticado. Igual que Overleaf, muestra el panel de proyectos
 * y, al abrir uno, el editor a pantalla completa con un acceso para volver al panel.
 */
export function WorkspacePage({ displayName, onSignOut }: Readonly<WorkspacePageProps>) {
  const [openProject, setOpenProject] = useState<Project | null>(null)

  if (!openProject?.documentId) {
    return <ProjectDashboard displayName={displayName} onOpenProject={setOpenProject} onSignOut={onSignOut} />
  }

  return (
    <Suspense fallback={<div className="loading-screen">Abriendo el editor...</div>}>
      <EditorPage
        key={openProject.documentId}
        documentId={openProject.documentId}
        projectName={openProject.name}
        onBack={() => setOpenProject(null)}
      />
    </Suspense>
  )
}

export default WorkspacePage
