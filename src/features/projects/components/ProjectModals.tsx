import { useState, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'
import { PROJECT_LIMITS } from '../types'

function toMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'No fue posible completar la operación'
}

/**
 * Ejecuta una acción asíncrona del modal controlando el estado "enviando" y el error.
 * Si termina bien, cierra el modal.
 */
function useModalSubmit(onClose: () => void) {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = async (action: () => Promise<void>) => {
    setIsSubmitting(true)
    setError(null)
    try {
      await action()
      onClose()
    } catch (err: unknown) {
      setError(toMessage(err))
      setIsSubmitting(false)
    }
  }

  return { isSubmitting, error, setError, run }
}

interface ProjectFormModalProps {
  title: string
  submitLabel: string
  submittingLabel: string
  initialName?: string
  initialDescription?: string
  showDescription?: boolean
  info?: string
  onClose: () => void
  onSubmit: (name: string, description: string) => Promise<void>
}

/** Formulario de nombre y descripción, reutilizado para crear, modificar y duplicar. */
export function ProjectFormModal({
  title,
  submitLabel,
  submittingLabel,
  initialName = '',
  initialDescription = '',
  showDescription = true,
  info,
  onClose,
  onSubmit,
}: Readonly<ProjectFormModalProps>) {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const { isSubmitting, error, setError, run } = useModalSubmit(onClose)

  const handleSubmit = (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!name.trim()) {
      setError('Por favor escribe un nombre para el proyecto')
      return
    }
    void run(() => onSubmit(name.trim(), description.trim()))
  }

  return (
    <Modal title={title} isBusy={isSubmitting} onClose={onClose}>
      <form onSubmit={handleSubmit} className="pm-form" noValidate>
        {error && (
          <p className="pm-alert pm-alert-error" role="alert">
            {error}
          </p>
        )}

        <div className="pm-field">
          <label htmlFor="project-name">Nombre del proyecto</label>
          <input
            id="project-name"
            type="text"
            placeholder="ej. Tesis de grado"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={PROJECT_LIMITS.MAX_NAME_LENGTH}
            autoComplete="off"
            required
          />
        </div>

        {showDescription && (
          <div className="pm-field">
            <label htmlFor="project-desc">Descripción (opcional)</label>
            <textarea
              id="project-desc"
              placeholder="ej. Borrador del capítulo 1"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={PROJECT_LIMITS.MAX_DESCRIPTION_LENGTH}
              rows={3}
            />
          </div>
        )}

        {info && <p className="pm-hint">{info}</p>}

        <div className="pm-dialog-actions">
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button type="submit" className="pm-btn pm-btn-primary" disabled={isSubmitting}>
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </form>
    </Modal>
  )
}

interface ConfirmModalProps {
  title: string
  message: string
  confirmLabel: string
  confirmingLabel: string
  danger?: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

/** Confirmación de acciones (archivar, eliminar). */
export function ConfirmModal({
  title,
  message,
  confirmLabel,
  confirmingLabel,
  danger = false,
  onClose,
  onConfirm,
}: Readonly<ConfirmModalProps>) {
  const { isSubmitting, error, run } = useModalSubmit(onClose)

  return (
    <Modal title={title} isBusy={isSubmitting} onClose={onClose}>
      <div className="pm-form">
        {error && (
          <p className="pm-alert pm-alert-error" role="alert">
            {error}
          </p>
        )}

        <p className="pm-confirm-text">{message}</p>

        <div className="pm-dialog-actions">
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isSubmitting}>
            Cancelar
          </button>
          <button
            type="button"
            className={`pm-btn ${danger ? 'pm-btn-danger' : 'pm-btn-primary'}`}
            onClick={() => void run(onConfirm)}
            disabled={isSubmitting}
          >
            {isSubmitting ? confirmingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  )
}
