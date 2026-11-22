import { useState, type SyntheticEvent } from 'react'
import Modal from '../../../components/common/Modal'

const MAX_SUMMARY_LENGTH = 200

interface SaveVersionModalProps {
  onClose: () => void
  onSave: (summary: string) => Promise<void>
}

/** Guarda el contenido actual como una versión con una descripción opcional. */
export function SaveVersionModal({ onClose, onSave }: Readonly<SaveVersionModalProps>) {
  const [summary, setSummary] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (event: SyntheticEvent<HTMLFormElement>) => {
    event.preventDefault()
    setIsSaving(true)
    setError(null)
    try {
      await onSave(summary.trim())
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'No fue posible guardar la versión')
      setIsSaving(false)
    }
  }

  return (
    <Modal title="Guardar versión" icon="save" isBusy={isSaving} onClose={onClose}>
      <form className="pm-form" onSubmit={(event) => void handleSubmit(event)} noValidate>
        {error && (
          <p className="pm-alert pm-alert-error" role="alert">
            {error}
          </p>
        )}
        <div className="pm-field">
          <label htmlFor="version-summary">Descripción de los cambios (opcional)</label>
          <textarea
            id="version-summary"
            data-autofocus
            rows={3}
            maxLength={MAX_SUMMARY_LENGTH}
            placeholder="ej. Capítulo 2 terminado"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>
        <p className="pm-hint">Se guardará el contenido actual del archivo. Podrás restaurarlo en cualquier momento.</p>
        <div className="pm-dialog-actions">
          <button type="button" className="pm-btn pm-btn-ghost" onClick={onClose} disabled={isSaving}>
            Cancelar
          </button>
          <button type="submit" className="pm-btn pm-btn-primary" disabled={isSaving}>
            {isSaving ? 'Guardando...' : 'Guardar versión'}
          </button>
        </div>
      </form>
    </Modal>
  )
}

export default SaveVersionModal
