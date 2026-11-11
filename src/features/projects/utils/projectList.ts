import type { Project } from '../../../types/project'
import { OWNER_ROLE, type ProjectFilter, type SortState } from '../types'

const ROLE_LABELS: Record<string, string> = {
  propietario: 'Propietario',
  editor: 'Editor',
  revisor: 'Revisor',
  invitado: 'Invitado',
}

const RELATIVE_UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 365 * 24 * 60 * 60],
  ['month', 30 * 24 * 60 * 60],
  ['week', 7 * 24 * 60 * 60],
  ['day', 24 * 60 * 60],
  ['hour', 60 * 60],
  ['minute', 60],
]

const relativeFormatter = new Intl.RelativeTimeFormat('es', { numeric: 'auto' })
const collator = new Intl.Collator('es', { sensitivity: 'base', numeric: true })

export function isOwner(project: Project): boolean {
  return project.role === OWNER_ROLE
}

export function getRoleLabel(role: string): string {
  return ROLE_LABELS[role] ?? role
}

/** Nombre a mostrar en la columna "Propietario". */
export function getOwnerLabel(project: Project): string {
  if (isOwner(project)) return 'Tú'
  return project.ownerName || '—'
}

/** Fecha relativa al estilo "hace 5 meses". */
export function formatRelativeDate(isoDate: string | null, now: number = Date.now()): string {
  if (!isoDate) return '—'

  const elapsedSeconds = Math.round((new Date(isoDate).getTime() - now) / 1000)
  const match = RELATIVE_UNITS.find(([, seconds]) => Math.abs(elapsedSeconds) >= seconds)

  if (!match) return 'hace un momento'

  const [unit, seconds] = match
  return relativeFormatter.format(Math.round(elapsedSeconds / seconds), unit)
}

export function formatFullDate(isoDate: string | null): string {
  return isoDate ? new Date(isoDate).toLocaleString('es') : ''
}

function matchesFilter(project: Project, filter: ProjectFilter): boolean {
  if (filter === 'owned') return isOwner(project)
  if (filter === 'shared') return !isOwner(project)
  return true
}

function matchesSearch(project: Project, term: string): boolean {
  if (!term) return true
  return [project.name, project.description, project.ownerName].some((field) =>
    field.toLowerCase().includes(term),
  )
}

function compareProjects(a: Project, b: Project, sort: SortState): number {
  if (sort.key === 'name') return collator.compare(a.name, b.name)
  if (sort.key === 'owner') return collator.compare(getOwnerLabel(a), getOwnerLabel(b))
  return new Date(a.updatedAt ?? 0).getTime() - new Date(b.updatedAt ?? 0).getTime()
}

/** Aplica sección, búsqueda y orden a la lista de proyectos (función pura). */
export function selectVisibleProjects(
  projects: readonly Project[],
  filter: ProjectFilter,
  searchTerm: string,
  sort: SortState,
): Project[] {
  const term = searchTerm.trim().toLowerCase()
  const factor = sort.direction === 'asc' ? 1 : -1

  return projects
    .filter((project) => matchesFilter(project, filter) && matchesSearch(project, term))
    .toSorted((a, b) => compareProjects(a, b, sort) * factor)
}
