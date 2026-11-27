import type { LastCompilation } from './document'

// HU-25: roles visibles propietario, editor y lector; revisor e invitado son heredados
export type ProjectRole = 'propietario' | 'editor' | 'lector' | 'revisor' | 'invitado'

/** Roles que el propietario puede asignar al invitar o cambiar el acceso. */
export type AssignableRole = 'editor' | 'lector'

export interface Project {
  id: string
  name: string
  description: string
  isArchived: boolean
  role: ProjectRole
  ownerId: string
  ownerName: string
  documentId: string | null
  documentName: string | null
  sizeBytes: number
  createdAt: string
  updatedAt: string | null
  lastCompilation: LastCompilation | null
}

export interface CreateProjectRequest {
  name: string
  description?: string
  content?: string
  /** HU-16: crea el proyecto como copia de esta plantilla del sistema. */
  templateId?: string
}

export interface UpdateProjectRequest {
  name?: string
  description?: string
}

export interface GetProjectsResponse {
  projects: Project[]
}

export interface ProjectResponse {
  message?: string
  project: Project
}
