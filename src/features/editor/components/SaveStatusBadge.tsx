import type { SaveStatus } from '../../../types/document'

const STATUS_TEXT: Readonly<Record<SaveStatus, string>> = {
  saved: 'Guardado',
  saving: 'Guardando...',
  unsaved: 'Cambios sin guardar',
  error: 'Error al guardar',
  idle: '',
}

interface SaveStatusBadgeProps {
  status: SaveStatus
  lastSavedAt: string | null
}

/** Indicador del estado de guardado del documento. */
export function SaveStatusBadge({ status, lastSavedAt }: Readonly<SaveStatusBadgeProps>) {
  if (status === 'idle') return null

  const title = status === 'saved' && lastSavedAt ? `Guardado a las ${lastSavedAt}` : undefined

  return (
    <output className={`ide-save-status is-${status}`} title={title}>
      <span className="ide-save-dot" aria-hidden="true" />
      {STATUS_TEXT[status]}
    </output>
  )
}

export default SaveStatusBadge
