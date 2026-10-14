import type { LastCompilation } from './document'

export type ProjectRole = 'propietario' | 'editor' | 'revisor' | 'invitado'

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
