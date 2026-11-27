import { useState, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'
import Icon from '../../../components/common/Icon'
import type { LatexTemplate } from '../../../types/template'
import { PROJECT_LIMITS } from '../../projects/types'
import { useTemplateDetail } from '../hooks/useTemplates'
import { formatFileSize } from '../utils/templateFilters'
import TemplateThumbnail from './TemplateThumbnail'

const PREVIEW_WIDTH = 360

interface TemplateDetailModalProps {
  template: LatexTemplate
  onClose: () => void
  /** Crea el proyecto (copia de la plantilla) y lo abre. */
  onUse: (template: LatexTemplate, name: string, description: string) => Promise<void>
}

function FileList({ templateId }: Readonly<{ templateId: string }>) {
  const { template, loading, error } = useTemplateDetail(templateId)

  if (loading) return <p className="tpl-muted">Cargando archivos...</p>
  if (error || !template?.files) return <p className="tpl-muted">{error ?? 'No se pudieron cargar los archivos.'}</p>

  return (
    <ul className="tpl-files">
      {template.files.map((file) => (
        <li key={file.path}>
          <Icon name={file.path.includes('/') ? 'folder' : 'file'} size={14} />
          <span className="tpl-file-path">{file.path}</span>
          <span className="tpl-muted">{formatFileSize(file.sizeBytes)}</span>
        </li>
      ))}
    </ul>
  )
}

/**
 * Detalle de una plantilla con su vista previa y el formulario para usarla.
 * Usarla crea un proyecto nuevo que es una COPIA: la plantilla del sistema no cambia.
 */
export function TemplateDetailModal({ template, onClose, onUse }: Readonly<TemplateDetailModalProps>) {
  const [name, setName] = useState(template.name)
  const [description, setDescription] = useState('')
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Escribe un nombre para tu proyecto')
      return
    }
    setIsCreating(true)
    setError(null)
    try {
      await onUse(template, name.trim(), description.trim())
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible crear el proyecto')
      setIsCreating(false)
    }
  }

  return (
    <Modal title={template.name} icon="file" size="large" isBusy={isCreating} onClose={onClose}>
      <div className="tpl-detail">
        <div className="tpl-detail-preview">
          <TemplateThumbnail
            templateId={template.id}
            width={PREVIEW_WIDTH}
            label={template.name}
            onPageCount={setPageCount}
          />
          {pageCount !== null && <span className="tpl-muted">Ejemplo de {pageCount} página(s)</span>}
        </div>

        <div className="tpl-detail-info">
          <span className="tpl-badge">{template.categoryLabel}</span>
          <p className="tpl-detail-description">{template.description}</p>
          {template.tags.length > 0 && (
            <ul className="tpl-tags" aria-label="Etiquetas">
              {template.tags.map((tag) => (
                <li key={tag}>{tag}</li>
              ))}
            </ul>
          )}

          <h3 className="tpl-section-title">Archivos incluidos</h3>
          <FileList templateId={template.id} />

          <form className="pm-form tpl-use-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
            {error && (
              <p className="pm-alert pm-alert-error" role="alert">
                {error}
              </p>
            )}
            <div className="pm-field">
              <label htmlFor="template-project-name">Nombre de tu proyecto</label>
              <input
                id="template-project-name"
                data-autofocus
                type="text"
                value={name}
                maxLength={PROJECT_LIMITS.MAX_NAME_LENGTH}
                onChange={(event) => setName(event.target.value)}
                autoComplete="off"
                required
              />
            </div>
            <div className="pm-field">
              <label htmlFor="template-project-desc">Descripción (opcional)</label>
              <input
                id="template-project-desc"
                type="text"
                value={description}
                maxLength={PROJECT_LIMITS.MAX_DESCRIPTION_LENGTH}
                placeholder="ej. Trabajo de titulación 2026"
                onChange={(event) => setDescription(event.target.value)}
              />
            </div>
            <p className="pm-hint">
              Se creará una copia en tus proyectos. Puedes editarla libremente: la plantilla original no cambia y
              seguirá disponible para todos.
            </p>
            <div className="pm-dialog-actions">
              <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isCreating}>
                Cancelar
              </button>
              <button type="submit" className="pm-btn pm-btn-primary" disabled={isCreating}>
                {isCreating ? 'Creando proyecto...' : 'Usar esta plantilla'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Modal>
  )
}

export default TemplateDetailModal
