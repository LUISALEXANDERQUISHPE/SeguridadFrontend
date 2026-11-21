import { useState, type FocusEvent, type KeyboardEvent } from 'react'
import Icon from '../../../components/common/Icon'

interface PdfPageNavigatorProps {
  currentPage: number
  numPages: number
  onGoToPage: (pageNumber: number) => void
}

/** Anterior / campo "página N de M" / siguiente. Escribir un número y pulsar Enter salta a esa página. */
export function PdfPageNavigator({ currentPage, numPages, onGoToPage }: Readonly<PdfPageNavigatorProps>) {
  // Texto que el usuario está escribiendo; null mientras no edita (se muestra la página actual)
  const [draft, setDraft] = useState<string | null>(null)

  const commit = (value: string) => {
    setDraft(null)
    const pageNumber = Number.parseInt(value, 10)
    if (Number.isInteger(pageNumber)) {
      onGoToPage(Math.min(Math.max(pageNumber, 1), numPages))
    }
  }

  // Al salir del campo se aplica lo escrito (si el usuario llegó a editarlo)
  const handleBlur = (event: FocusEvent<HTMLInputElement>) => {
    if (draft !== null) commit(event.currentTarget.value)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      commit(event.currentTarget.value)
    } else if (event.key === 'Escape') {
      setDraft(null)
    }
  }

  return (
    <div className="pdf-page-nav">
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={() => onGoToPage(currentPage - 1)}
        disabled={currentPage <= 1}
        aria-label="Página anterior"
        title="Página anterior"
      >
        <Icon name="arrowUp" />
      </button>
      <input
        type="text"
        inputMode="numeric"
        className="pdf-page-input"
        value={draft ?? String(currentPage)}
        onChange={(event) => setDraft(event.target.value.replaceAll(/\D/g, ''))}
        onFocus={(event) => event.currentTarget.select()}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        aria-label={`Página actual, de ${numPages}`}
      />
      <span className="pdf-page-total">/ {numPages}</span>
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={() => onGoToPage(currentPage + 1)}
        disabled={currentPage >= numPages}
        aria-label="Página siguiente"
        title="Página siguiente"
      >
        <Icon name="arrowDown" />
      </button>
    </div>
  )
}

export default PdfPageNavigator
