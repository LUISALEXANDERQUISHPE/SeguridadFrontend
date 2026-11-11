import { useCallback, useId, useRef, useState, type ReactNode } from 'react'
import { useDismiss } from '../../hooks/useDismiss'

export interface DropdownMenuItem {
  id: string
  label: string
  onSelect: () => void
  /** Atajo de teclado informativo, ej. "Ctrl+S". */
  shortcut?: string
  /** Marca la opción activa (ej. el diseño seleccionado). */
  checked?: boolean
  disabled?: boolean
}

interface DropdownMenuProps {
  label: ReactNode
  /** Nombre accesible cuando "label" no es texto. */
  ariaLabel?: string
  items: readonly DropdownMenuItem[]
  align?: 'left' | 'right'
  triggerClassName?: string
}

/** Menú desplegable genérico (barra de menús del editor, selector de diseño, etc.). */
export function DropdownMenu({
  label,
  ariaLabel,
  items,
  align = 'left',
  triggerClassName = 'ide-menu-trigger',
}: Readonly<DropdownMenuProps>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const listId = useId()
  const close = useCallback(() => setIsOpen(false), [])

  useDismiss(containerRef, isOpen, close)

  const select = (item: DropdownMenuItem) => {
    close()
    item.onSelect()
  }

  return (
    <div className="ide-menu" ref={containerRef}>
      <button
        type="button"
        className={`${triggerClassName} ${isOpen ? 'is-open' : ''}`}
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls={listId}
        aria-label={ariaLabel}
      >
        {label}
      </button>

      {isOpen && (
        <ul id={listId} className={`ide-menu-list align-${align}`}>
          {items.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                className="ide-menu-item"
                onClick={() => select(item)}
                disabled={item.disabled}
                aria-pressed={item.checked}
              >
                <span className="ide-menu-check" aria-hidden="true">
                  {item.checked ? '✓' : ''}
                </span>
                <span className="ide-menu-label">{item.label}</span>
                {item.shortcut && <kbd className="ide-menu-shortcut">{item.shortcut}</kbd>}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default DropdownMenu
