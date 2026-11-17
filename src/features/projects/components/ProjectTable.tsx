import { useEffect, useRef } from 'react'
import Icon from '../../../components/common/Icon'
import type { Project } from '../../../types/project'
import type { SortKey, SortState } from '../types'
import type { UseProjectSelectionResult } from '../hooks/useProjectSelection'
import { formatFullDate, formatRelativeDate, getOwnerLabel, getRoleLabel, isOwner } from '../utils/projectList'
import ProjectRowActions, { type ProjectActionHandlers } from './ProjectRowActions'

interface ColumnDefinition {
  key: SortKey
  label: string
  className: string
}

const COLUMNS: readonly ColumnDefinition[] = [
  { key: 'name', label: 'Título', className: 'pm-col-title' },
  { key: 'owner', label: 'Propietario', className: 'pm-col-owner' },
  { key: 'updatedAt', label: 'Última modificación', className: 'pm-col-date' },
]

function toAriaSort(column: SortKey, sort: SortState): 'ascending' | 'descending' | 'none' {
  if (column !== sort.key) return 'none'
  return sort.direction === 'asc' ? 'ascending' : 'descending'
}

interface SelectAllCheckboxProps {
  checked: boolean
  indeterminate: boolean
  disabled: boolean
  onChange: () => void
}

function SelectAllCheckbox({ checked, indeterminate, disabled, onChange }: Readonly<SelectAllCheckboxProps>) {
  const ref = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (ref.current) ref.current.indeterminate = indeterminate
  }, [indeterminate])

  return (
    <input
      ref={ref}
      type="checkbox"
      className="pm-checkbox"
      checked={checked}
      disabled={disabled}
      onChange={onChange}
      aria-label="Seleccionar todos los proyectos"
    />
  )
}

interface ProjectTableProps {
  projects: readonly Project[]
  sort: SortState
  selection: UseProjectSelectionResult
  isArchivedView: boolean
  actionHandlers: ProjectActionHandlers
  onSortChange: (key: SortKey) => void
  onOpen: (project: Project) => void
}

/** Tabla de proyectos con selección múltiple y columnas ordenables. */
export function ProjectTable({
  projects,
  sort,
  selection,
  isArchivedView,
  actionHandlers,
  onSortChange,
  onOpen,
}: Readonly<ProjectTableProps>) {
  return (
    <table className="pm-table">
      <thead>
        <tr>
          <th scope="col" className="pm-col-check">
            <SelectAllCheckbox
              checked={selection.allSelected}
              indeterminate={selection.someSelected}
              disabled={projects.length === 0}
              onChange={selection.toggleAll}
            />
          </th>
          {COLUMNS.map((column) => (
            <th key={column.key} scope="col" className={column.className} aria-sort={toAriaSort(column.key, sort)}>
              <button type="button" className="pm-sort-btn" onClick={() => onSortChange(column.key)}>
                {column.label}
                {sort.key === column.key && (
                  <Icon name={sort.direction === 'asc' ? 'arrowUp' : 'arrowDown'} size={13} />
                )}
              </button>
            </th>
          ))}
          <th scope="col" className="pm-col-actions">
            <span className="pm-sr-only">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {projects.map((project) => (
          <tr key={project.id} className={selection.isSelected(project.id) ? 'is-selected' : undefined}>
            <td className="pm-col-check">
              <input
                type="checkbox"
                className="pm-checkbox"
                checked={selection.isSelected(project.id)}
                onChange={() => selection.toggle(project.id)}
                aria-label={`Seleccionar ${project.name}`}
              />
            </td>
            <td className="pm-col-title">
              {isArchivedView ? (
                <span className="pm-project-name">{project.name}</span>
              ) : (
                <button
                  type="button"
                  className="pm-project-link"
                  onClick={() => onOpen(project)}
                  title={project.description || 'Abrir en el editor'}
                >
                  {project.name}
                </button>
              )}
              {project.description && <span className="pm-project-desc">{project.description}</span>}
            </td>
            <td className="pm-col-owner">
              {getOwnerLabel(project)}
              {!isOwner(project) && <span className="pm-role-tag">{getRoleLabel(project.role)}</span>}
            </td>
            <td className="pm-col-date" title={formatFullDate(project.updatedAt)}>
              {formatRelativeDate(project.updatedAt)}
            </td>
            <td className="pm-col-actions">
              <ProjectRowActions project={project} isArchivedView={isArchivedView} handlers={actionHandlers} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

export default ProjectTable
