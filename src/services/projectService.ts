import { authorizedRequest as requestWithAuth } from './api'
import type {
  CreateProjectRequest,
  GetProjectsResponse,
  Project,
  ProjectResponse,
  ProjectRole,
  UpdateProjectRequest,
} from '../types/project'

/**
 * Obtiene los proyectos del usuario (activos o archivados)
 */
export async function getProjects(archived = false): Promise<Project[]> {
  const response = await requestWithAuth<GetProjectsResponse>(`/projects?archived=${archived}`)
  return response.projects || []
}

/**
 * Crea un nuevo proyecto con su archivo principal .tex
 */
export async function createProject(data: CreateProjectRequest): Promise<Project> {
  const response = await requestWithAuth<ProjectResponse>('/projects', {
    method: 'POST',
    body: JSON.stringify(data),
  })
  return response.project
}

/**
 * Modifica el nombre o la descripción de un proyecto
 */
export async function updateProject(id: string, data: UpdateProjectRequest): Promise<Project> {
  const response = await requestWithAuth<ProjectResponse>(`/projects/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })
  return response.project
}

/**
 * Duplica un proyecto con todos sus archivos
 */
export async function duplicateProject(id: string, name?: string): Promise<Project> {
  const response = await requestWithAuth<ProjectResponse>(`/projects/${id}/duplicate`, {
    method: 'POST',
    body: JSON.stringify(name ? { name } : {}),
  })
  return response.project
}

/**
 * Archiva un proyecto (deja de mostrarse en el listado principal)
 */
export async function archiveProject(id: string): Promise<Project> {
  const response = await requestWithAuth<ProjectResponse>(`/projects/${id}/archive`, { method: 'POST' })
  return response.project
}

/**
 * Restaura un proyecto archivado
 */
export async function restoreProject(id: string): Promise<Project> {
  const response = await requestWithAuth<ProjectResponse>(`/projects/${id}/restore`, { method: 'POST' })
  return response.project
}

/**
 * Elimina un proyecto de forma permanente
 */
export async function deleteProject(id: string): Promise<void> {
  await requestWithAuth<{ message: string }>(`/projects/${id}`, { method: 'DELETE' })
}

/** Colaborador de un proyecto (el propietario no se incluye). */
export interface ProjectMember {
  userId: string
  name: string | null
  email: string | null
  role: ProjectRole
  joinedAt: string | null
}

/**
 * Lista los colaboradores de un proyecto
 */
export async function getProjectMembers(id: string): Promise<ProjectMember[]> {
  const response = await requestWithAuth<{ members: ProjectMember[] }>(`/projects/${id}/members`)
  return response.members || []
}

/** Usuario registrado sugerido al escribir un correo para compartir. */
export interface ShareSuggestion {
  name: string | null
  email: string
}

/** Mínimo de caracteres para pedir sugerencias (el backend aplica el mismo límite). */
export const SHARE_SUGGESTION_MIN_LENGTH = 3

/**
 * Usuarios cuyo correo empieza con el texto escrito y que aún no tienen acceso al proyecto
 */
export async function getShareSuggestions(id: string, query: string, signal?: AbortSignal): Promise<ShareSuggestion[]> {
  const response = await requestWithAuth<{ users: ShareSuggestion[] }>(
    `/projects/${id}/share-suggestions?q=${encodeURIComponent(query)}`,
    { signal },
  )
  return response.users || []
}
