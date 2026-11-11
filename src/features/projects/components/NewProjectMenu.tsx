import { useCallback, useRef, useState } from 'react'
import Icon from '../../../components/common/Icon'
import { useDismiss } from '../../../hooks/useDismiss'

interface NewProjectMenuProps {
  isUploading: boolean
  onCreateBlank: () => void
  onUpload: () => void
}

/** Botón "Nuevo proyecto" con sus opciones: proyecto en blanco o subir un archivo .tex. */
export function NewProjectMenu({ isUploading, onCreateBlank, onUpload }: Readonly<NewProjectMenuProps>) {
  const [isOpen, setIsOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement | null>(null)
  const close = useCallback(() => setIsOpen(false), [])

  useDismiss(containerRef, isOpen, close)

  const choose = (action: () => void) => {
    close()
    action()
  }

  return (
    <div className="pm-new-menu" ref={containerRef}>
      <button
        type="button"
        className="pm-btn pm-btn-primary pm-btn-block"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
        aria-controls="new-project-options"
        disabled={isUploading}
      >
        {isUploading ? 'Subiendo...' : 'Nuevo proyecto'}
        <Icon name="chevronDown" size={14} />
      </button>

      {isOpen && (
        <ul id="new-project-options" className="pm-dropdown">
          <li>
            <button type="button" className="pm-dropdown-item" onClick={() => choose(onCreateBlank)}>
              <Icon name="file" />
              Proyecto en blanco
            </button>
          </li>
          <li>
            <button type="button" className="pm-dropdown-item" onClick={() => choose(onUpload)}>
              <Icon name="upload" />
              Subir proyecto (.tex)
            </button>
          </li>
        </ul>
      )}
    </div>
  )
}

export default NewProjectMenu
