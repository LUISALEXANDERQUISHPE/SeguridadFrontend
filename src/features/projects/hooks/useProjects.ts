import { useCallback, useEffect, useState } from 'react'
import type { CreateProjectRequest, Project, UpdateProjectRequest } from '../../../types/project'
import {
  archiveProject,
  createProject,
  deleteProject,
  duplicateProject,
  getProjects,
  restoreProject,
  updateProject,
} from '../../../services/projectService'

function toMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback
}

interface BatchResult {
  succeededIds: string[]
  errorMessage: string | null
}

/**
 * Ejecuta la misma operación sobre varios proyectos.
 * Devuelve los que se procesaron con éxito y, si alguno falló, un mensaje para el usuario.
 */
async function runForEach(
  projects: readonly Project[],
  operation: (id: string) => Promise<unknown>,
): Promise<BatchResult> {
  const results = await Promise.allSettled(projects.map((project) => operation(project.id)))
  const succeededIds = projects
    .filter((_, index) => results[index].status === 'fulfilled')
    .map((project) => project.id)

  const firstFailure = results.find((result): result is PromiseRejectedResult => result.status === 'rejected')
  if (!firstFailure) {
    return { succeededIds, errorMessage: null }
  }

  const reason = toMessage(firstFailure.reason, 'No fue posible completar la operación')
  if (projects.length === 1) {
    return { succeededIds, errorMessage: reason }
  }

  const failed = projects.length - succeededIds.length
  return {
    succeededIds,
    errorMessage: `No se pudieron procesar ${failed} de ${projects.length} proyectos. ${reason}`,
  }
}

function describe(projects: readonly Project[]): string {
  return projects.length === 1 ? `"${projects[0].name}"` : `${projects.length} proyectos`
}

export interface UseProjectsResult {
  projects: Project[]
  loading: boolean
  error: string | null
  notice: string | null
  setError: (message: string | null) => void
  clearMessages: () => void
  create: (data: CreateProjectRequest) => Promise<Project>
  update: (project: Project, data: UpdateProjectRequest) => Promise<Project>
  duplicate: (project: Project, name: string) => Promise<Project>
  archive: (projects: readonly Project[]) => Promise<void>
  restore: (projects: readonly Project[]) => Promise<void>
  remove: (projects: readonly Project[]) => Promise<void>
}

/**
 * Estado y operaciones de la lista de proyectos (HU-17).
 * Separa la lógica de datos de los componentes visuales (responsabilidad única).
 *
 * @param archived true para trabajar con los proyectos archivados, false para los activos
 */
export function useProjects(archived: boolean): UseProjectsResult {
  const [projects, setProjects] = useState<Project[]>([])
  // Sección (activos/archivados) cuya lista ya se cargó; mientras no coincida, se está cargando
  const [loadedArchived, setLoadedArchived] = useState<boolean | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  const loading = loadedArchived !== archived

  useEffect(() => {
    // Ignora respuestas de una sección anterior si el usuario cambió de sección antes de que llegaran
    let isCurrent = true

    getProjects(archived)
      .then((list) => {
        if (!isCurrent) return
        setProjects(list)
        setError(null)
      })
      .catch((err: unknown) => {
        if (!isCurrent) return
        setProjects([])
        setError(toMessage(err, 'Error al listar los proyectos'))
      })
      .finally(() => {
        if (isCurrent) setLoadedArchived(archived)
      })

    return () => {
      isCurrent = false
    }
  }, [archived])

  const clearMessages = useCallback(() => {
    setError(null)
    setNotice(null)
  }, [])

  const removeFromList = useCallback((ids: readonly string[]) => {
    setProjects((prev) => prev.filter((project) => !ids.includes(project.id)))
  }, [])

  /** Quita de la lista los proyectos procesados, incluso si algunos fallaron. */
  const runAndRemove = useCallback(
    async (items: readonly Project[], operation: (id: string) => Promise<unknown>, verb: string) => {
      const { succeededIds, errorMessage } = await runForEach(items, operation)
      removeFromList(succeededIds)
      if (errorMessage) {
        throw new Error(errorMessage)
      }
      setNotice(`${describe(items)} ${verb}`)
    },
    [removeFromList],
  )

  const create = useCallback(
    async (data: CreateProjectRequest) => {
      const project = await createProject(data)
      setNotice(`Proyecto "${project.name}" creado`)
      if (!archived) setProjects((prev) => [project, ...prev])
      return project
    },
    [archived],
  )

  const update = useCallback(async (project: Project, data: UpdateProjectRequest) => {
    const updated = await updateProject(project.id, data)
    setProjects((prev) =>
      prev.map((item) => (item.id === project.id ? { ...item, ...updated, ownerName: item.ownerName } : item)),
    )
    setNotice(`Proyecto "${updated.name}" actualizado`)
    return updated
  }, [])

  const duplicate = useCallback(
    async (project: Project, name: string) => {
      const copy = await duplicateProject(project.id, name)
      setNotice(`Se creó la copia "${copy.name}"`)
      if (!archived) setProjects((prev) => [copy, ...prev])
      return copy
    },
    [archived],
  )

  const archive = useCallback(
    (items: readonly Project[]) => runAndRemove(items, archiveProject, 'archivado(s)'),
    [runAndRemove],
  )

  const restore = useCallback(
    (items: readonly Project[]) => runAndRemove(items, restoreProject, 'restaurado(s)'),
    [runAndRemove],
  )

  const remove = useCallback(
    (items: readonly Project[]) => runAndRemove(items, deleteProject, 'eliminado(s)'),
    [runAndRemove],
  )

  return {
    projects,
    loading,
    error,
    notice,
    setError,
    clearMessages,
    create,
    update,
    duplicate,
    archive,
    restore,
    remove,
  }
}
