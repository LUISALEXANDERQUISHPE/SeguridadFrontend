import { useEffect, useRef, type KeyboardEvent } from 'react'
import Icon from '../../../components/common/Icon'
import { MAX_MATCHES } from './pdfTextSearch'

interface PdfSearchBarProps {
  query: string
  indexing: boolean
  total: number
  activeIndex: number
  onQueryChange: (query: string) => void
  onNext: () => void
  onPrevious: () => void
  onClose: () => void
}

function describeResults(query: string, indexing: boolean, total: number, activeIndex: number): string {
  if (!query.trim()) return ''
  if (indexing) return 'Buscando...'
  if (total === 0) return 'Sin resultados'
  const suffix = total >= MAX_MATCHES ? '+' : ''
  return `${activeIndex + 1} de ${total}${suffix}`
}

/**
 * Barra de búsqueda dentro del PDF.
 * Enter: siguiente · Shift+Enter: anterior · Escape: cerrar.
 */
export function PdfSearchBar({
  query,
  indexing,
  total,
  activeIndex,
  onQueryChange,
  onNext,
  onPrevious,
  onClose,
}: Readonly<PdfSearchBarProps>) {
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    inputRef.current?.focus()
    inputRef.current?.select()
  }, [])

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      if (event.shiftKey) {
        onPrevious()
      } else {
        onNext()
      }
    } else if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
    }
  }

  const status = describeResults(query, indexing, total, activeIndex)
  const hasResults = total > 0

  return (
    <search className="pdf-search-bar">
      <Icon name="search" />
      <input
        ref={inputRef}
        type="search"
        className="pdf-search-input"
        placeholder="Buscar en el PDF"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={handleKeyDown}
        aria-label="Buscar en el PDF"
      />
      <output className={`pdf-search-status ${query && !indexing && !hasResults ? 'no-results' : ''}`} aria-live="polite">
        {status}
      </output>
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={onPrevious}
        disabled={!hasResults}
        aria-label="Coincidencia anterior"
        title="Anterior (Shift+Enter)"
      >
        <Icon name="arrowUp" />
      </button>
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={onNext}
        disabled={!hasResults}
        aria-label="Coincidencia siguiente"
        title="Siguiente (Enter)"
      >
        <Icon name="arrowDown" />
      </button>
      <button type="button" className="pdf-logs-btn" onClick={onClose} aria-label="Cerrar búsqueda" title="Cerrar (Esc)">
        <Icon name="close" />
      </button>
    </search>
  )
}

export default PdfSearchBar
