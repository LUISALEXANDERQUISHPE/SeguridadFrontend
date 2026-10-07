import React, { useEffect, useState } from 'react'

interface ProjectFormModalProps {
  isOpen: boolean
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

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({
  isOpen,
  title,
  submitLabel,
  submittingLabel,
  initialName = '',
  initialDescription = '',
  showDescription = true,
  info,
  onClose,
  onSubmit,
}) => {
  const [name, setName] = useState(initialName)
  const [description, setDescription] = useState(initialDescription)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) {
      setName(initialName)
      setDescription(initialDescription)
      setError(null)
    }
  }, [isOpen, initialName, initialDescription])

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor escribe un nombre para el proyecto')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      await onSubmit(name.trim(), description.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la operación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-field">
            <label htmlFor="project-name">Nombre del proyecto:</label>
            <input
              id="project-name"
              type="text"
              placeholder="ej. Tesis de grado"
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={120}
              autoFocus
              required
            />
          </div>

          {showDescription && (
            <div className="modal-field">
              <label htmlFor="project-desc">Descripción (opcional):</label>
              <input
                id="project-desc"
                type="text"
                placeholder="ej. Borrador del capítulo 1"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                maxLength={500}
              />
            </div>
          )}

          {info && (
            <div className="modal-info">
              <p>{info}</p>
            </div>
          )}

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="modal-btn-submit" disabled={isSubmitting}>
              {isSubmitting ? submittingLabel : submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface ConfirmModalProps {
  isOpen: boolean
  title: string
  message: string
  confirmLabel: string
  confirmingLabel: string
  danger?: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  title,
  message,
  confirmLabel,
  confirmingLabel,
  danger = false,
  onClose,
  onConfirm,
}) => {
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isOpen) setError(null)
  }, [isOpen])

  if (!isOpen) return null

  const handleConfirm = async () => {
    setIsSubmitting(true)
    setError(null)
    try {
      await onConfirm()
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible completar la operación')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={isSubmitting ? undefined : onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button type="button" className="modal-close-btn" onClick={onClose} disabled={isSubmitting}>
            ✕
          </button>
        </div>

        <div className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <p className="modal-confirm-text">{message}</p>

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button
              type="button"
              className={danger ? 'modal-btn-danger' : 'modal-btn-submit'}
              onClick={() => void handleConfirm()}
              disabled={isSubmitting}
            >
              {isSubmitting ? confirmingLabel : confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
