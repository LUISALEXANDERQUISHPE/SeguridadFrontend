import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import Icon from './Icon'

interface ModalProps {
  title: string
  /** Mientras es true no se permite cerrar el modal (operación en curso). */
  isBusy?: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Modal accesible basado en el elemento nativo <dialog>:
 * atrapa el foco, se cierra con Escape y muestra el fondo con ::backdrop.
 * Los modales concretos se construyen por composición sobre este (abierto/cerrado).
 */
export function Modal({ title, isBusy = false, onClose, children }: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
    }
    return () => dialog?.close()
  }, [])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    if (!isBusy) onClose()
  }

  return (
    <dialog ref={dialogRef} className="pm-dialog" aria-labelledby={titleId} onCancel={handleCancel}>
      <header className="pm-dialog-header">
        <h2 id={titleId}>{title}</h2>
        <button type="button" className="pm-icon-btn" onClick={onClose} disabled={isBusy} aria-label="Cerrar">
          <Icon name="close" />
        </button>
      </header>
      <div className="pm-dialog-body">{children}</div>
    </dialog>
  )
}

export default Modal
