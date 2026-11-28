import { useEffect, useId, useRef, type ReactNode, type SyntheticEvent } from 'react'
import Icon, { type IconName } from './Icon'

export type ModalTone = 'default' | 'danger'

/** "wide" para formularios amplios (ej. compartir); "large" para vistas previas (ej. plantillas). */
export type ModalSize = 'default' | 'wide' | 'large'

const SIZE_CLASSES: Readonly<Record<ModalSize, string>> = {
  default: '',
  wide: 'is-wide',
  large: 'is-large',
}

/** Los elementos con data-autofocus reciben el foco al abrir el modal. */
const AUTOFOCUS_SELECTOR = '[data-autofocus]'

interface ModalProps {
  title: string
  /** Ícono opcional junto al título (ej. "trash" al eliminar). */
  icon?: IconName
  /** "danger" resalta en rojo las acciones destructivas. */
  tone?: ModalTone
  size?: ModalSize
  /** Mientras es true no se permite cerrar el modal (operación en curso). */
  isBusy?: boolean
  onClose: () => void
  children: ReactNode
}

/**
 * Modal accesible basado en el elemento nativo <dialog>, centrado en la pantalla:
 * atrapa el foco, se cierra con Escape y oscurece el fondo con ::backdrop.
 * Los modales concretos se construyen por composición sobre este (abierto/cerrado).
 */
export function Modal({ title, icon, tone = 'default', size = 'default', isBusy = false, onClose, children }: Readonly<ModalProps>) {
  const dialogRef = useRef<HTMLDialogElement | null>(null)
  const titleId = useId()

  useEffect(() => {
    const dialog = dialogRef.current
    if (dialog && !dialog.open) {
      dialog.showModal()
      // El foco va al elemento marcado (primer campo o la opción segura "Cancelar"),
      // no al botón de cerrar que el navegador enfoca por defecto
      dialog.querySelector<HTMLElement>(AUTOFOCUS_SELECTOR)?.focus()
    }
    return () => dialog?.close()
  }, [])

  const handleCancel = (event: SyntheticEvent<HTMLDialogElement>) => {
    event.preventDefault()
    if (!isBusy) onClose()
  }

  return (
    <dialog
      ref={dialogRef}
      className={`pm-dialog ${tone === 'danger' ? 'is-danger' : ''} ${SIZE_CLASSES[size]}`}
      aria-labelledby={titleId}
      onCancel={handleCancel}
    >
      <header className="pm-dialog-header">
        {icon && (
          <span className="pm-dialog-icon" aria-hidden="true">
            <Icon name={icon} size={18} />
          </span>
        )}
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
