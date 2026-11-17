import type { Project } from '../../types/project'

/** Secciones del panel lateral (equivalentes a "All / Your / Shared / Archived" de Overleaf). */
export type ProjectFilter = 'all' | 'owned' | 'shared' | 'archived'

export type SortKey = 'name' | 'owner' | 'updatedAt'

export type SortDirection = 'asc' | 'desc'

export interface SortState {
  key: SortKey
  direction: SortDirection
}

/** Modal abierto en el panel de proyectos (como máximo uno a la vez). */
export type ProjectModalState =
  | { type: 'create' }
  | { type: 'edit'; project: Project }
  | { type: 'duplicate'; project: Project }
  | { type: 'archive'; projects: Project[] }
  | { type: 'delete'; projects: Project[] }
  | null

export const PROJECT_LIMITS = {
  MAX_NAME_LENGTH: 120,
  MAX_DESCRIPTION_LENGTH: 500,
  MAX_UPLOAD_BYTES: 2 * 1024 * 1024,
} as const

export const OWNER_ROLE = 'propietario'
