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

/**
 * Comparte el proyecto con otro usuario registrado (entra como editor)
 */
export async function shareProject(id: string, email: string): Promise<ProjectMember> {
  const response = await requestWithAuth<{ member: ProjectMember }>(`/projects/${id}/members`, {
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  return response.member
}

