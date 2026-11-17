import { useCallback, useMemo, useState } from 'react'
import type { Project } from '../../../types/project'

export interface UseProjectSelectionResult {
  selectedIds: ReadonlySet<string>
  selectedProjects: Project[]
  isSelected: (id: string) => boolean
  toggle: (id: string) => void
  toggleAll: () => void
  clear: () => void
  allSelected: boolean
  someSelected: boolean
}

/**
 * Selección múltiple de proyectos (casillas de la tabla).
 * Solo considera seleccionados los proyectos actualmente visibles.
 */
export function useProjectSelection(visibleProjects: readonly Project[]): UseProjectSelectionResult {
  const [rawSelection, setRawSelection] = useState<ReadonlySet<string>>(new Set())

  const selectedProjects = useMemo(
    () => visibleProjects.filter((project) => rawSelection.has(project.id)),
    [visibleProjects, rawSelection],
  )

  const selectedIds = useMemo(() => new Set(selectedProjects.map((project) => project.id)), [selectedProjects])

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds])

  const toggle = useCallback((id: string) => {
    setRawSelection((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }, [])

  const allSelected = visibleProjects.length > 0 && selectedProjects.length === visibleProjects.length
  const someSelected = selectedProjects.length > 0 && !allSelected

  const toggleAll = useCallback(() => {
    setRawSelection(allSelected ? new Set() : new Set(visibleProjects.map((project) => project.id)))
  }, [allSelected, visibleProjects])

  const clear = useCallback(() => setRawSelection(new Set()), [])

  return { selectedIds, selectedProjects, isSelected, toggle, toggleAll, clear, allSelected, someSelected }
}
