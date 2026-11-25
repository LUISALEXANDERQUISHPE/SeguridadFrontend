import React, { useMemo, useState } from 'react'
import type { CompilationError } from '../../../types/document'
import Icon from '../../../components/common/Icon'

interface CompilationConsoleProps {
  errors: CompilationError[]
  warnings: CompilationError[]
  log?: string
  compilationTime?: number
  // file: ruta relativa al proyecto del archivo con el error (ej. "capitulos/intro.tex")
  onErrorClick: (line: number, file?: string) => void
  /** Nombre base para el archivo .log descargado */
  documentName?: string
}

type LogLevel = 'error' | 'warning' | 'info'
type LogFilter = 'all' | LogLevel

interface LogEntry {
  level: LogLevel
  issue: CompilationError
}

/**
 * Traduce o añade explicaciones comprensibles para errores comunes de pdflatex
 */
export function getFriendlyExplanation(message: string): string | null {
  if (!message) return null
  const clean = message.replace(/\\+/g, '\\')

  if (/misplaced\s*\\?noalign/i.test(clean)) {
    return 'LaTeX encontró un problema con la estructura de una tabla. Revisa \\hline, los saltos de fila \\\\ y el cierre de tabular o tabularx.'
  }
  if (/undefined\s+control\s+sequence/i.test(clean)) {
    return 'Comando no reconocido o paquete faltante. Revisa la ortografía del comando o si necesitas importar un paquete con \\usepackage{...} en el preámbulo.'
  }
  if (/missing\s*\$\s*inserted/i.test(clean)) {
    return 'Falta un delimitador de modo matemático ($). Revisa si escribiste símbolos como _ o ^ fuera de una fórmula matemática.'
  }
  if (/file\s+.*not\s+found/i.test(clean)) {
    return 'No se encontró el archivo especificado (como una imagen o paquete). Comprueba el nombre y la ruta en \\includegraphics o \\usepackage.'
  }
  if (/runaway\s+argument/i.test(clean)) {
    return 'Una llave { o corchete [ no se cerró antes del final de la línea o párrafo.'
  }
  if (/emergency\s+stop/i.test(clean)) {
    return 'La compilación se detuvo críticamente debido a un error previo grave.'
  }
  if (/citation\s+.*undefined/i.test(clean)) {
    return 'La clave usada en \\cite{...} no está en ningún .bib cargado. Revisa que la clave exista en el .bib y que el documento tenga \\bibliographystyle{...} y \\bibliography{...}.'
  }
  if (/reference\s+.*undefined/i.test(clean)) {
    return 'Un \\ref{...} apunta a un \\label{...} que no existe. Revisa que la etiqueta esté bien escrita.'
  }
  return null
}

// Las cajas Overfull/Underfull son avisos de composición tipográfica: en Overleaf no cuentan como advertencias
function isTypesettingInfo(issue: CompilationError): boolean {
  return /^(Overfull|Underfull)\s+\\[hv]box/i.test(issue.message)
}

const LEVEL_LABEL: Record<LogLevel, string> = {
  error: 'Error',
  warning: 'Advertencia',
  info: 'Información',
}

const FILTERS: Array<{ id: LogFilter; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'error', label: 'Errores' },
  { id: 'warning', label: 'Advertencias' },
  { id: 'info', label: 'Información' },
]

// Primera línea del mensaje como título de la tarjeta (Overleaf muestra el mensaje corto arriba)
function entryTitle(issue: CompilationError): string {
  const first = issue.message.split('\n')[0].trim()
  return first.length > 140 ? `${first.slice(0, 137)}…` : first
}

function LogEntryCard({ entry, onErrorClick }: Readonly<{ entry: LogEntry; onErrorClick: CompilationConsoleProps['onErrorClick'] }>) {
  const { issue, level } = entry
  const friendlyText = issue.friendlyMessage || getFriendlyExplanation(issue.message)
  const title = entryTitle(issue)
  const hasMoreText = issue.message.trim() !== title
  const canJump = Boolean(issue.line)
  const location = issue.file ? `${issue.file}${issue.line ? `, ${issue.line}` : ''}` : null

  return (
    <article className={`log-entry log-entry-${level}`}>
      <header className="log-entry-header">
        <span className="log-entry-title">
          <span className="log-entry-level">{LEVEL_LABEL[level]}:</span> {title}
        </span>
        {location && (
          canJump ? (
            <button
              type="button"
              className="log-entry-location"
              onClick={() => issue.line && onErrorClick(issue.line, issue.file)}
              title={`Ir a la línea ${issue.line} de ${issue.file}`}
            >
              {location}
            </button>
          ) : (
            <span className="log-entry-location is-static">{location}</span>
          )
        )}
      </header>

      {(hasMoreText || issue.context || friendlyText) && (
        <div className="log-entry-body">
          {hasMoreText && <pre className="log-entry-message">{issue.message}</pre>}
          {issue.context && <pre className="log-entry-context">{issue.context}</pre>}
          {friendlyText && (
            <div className="log-entry-hint">
              <span className="log-entry-hint-icon" aria-hidden="true">💡</span>
              <span>{friendlyText}</span>
            </div>
          )}
        </div>
      )}
    </article>
  )
}

/**
 * Registro de compilación al estilo de Overleaf: ocupa el panel del PDF, con pestañas
 * por nivel (errores, advertencias, información), tarjetas por mensaje y el log completo plegable.
 */
export const CompilationConsole: React.FC<CompilationConsoleProps> = ({
  errors,
  warnings,
  log,
  compilationTime,
  onErrorClick,
  documentName,
}) => {
  const [filter, setFilter] = useState<LogFilter>('all')
  const [isRawOpen, setIsRawOpen] = useState(false)

  const entries = useMemo<LogEntry[]>(() => [
    ...errors.map((issue) => ({ level: 'error' as const, issue })),
    ...warnings.filter((issue) => !isTypesettingInfo(issue)).map((issue) => ({ level: 'warning' as const, issue })),
    ...warnings.filter(isTypesettingInfo).map((issue) => ({ level: 'info' as const, issue })),
  ], [errors, warnings])

  const counts: Record<LogFilter, number> = {
    all: entries.length,
    error: entries.filter((entry) => entry.level === 'error').length,
    warning: entries.filter((entry) => entry.level === 'warning').length,
    info: entries.filter((entry) => entry.level === 'info').length,
  }

  const visible = filter === 'all' ? entries : entries.filter((entry) => entry.level === filter)

  const handleDownloadLog = () => {
    if (!log) return
    const blob = new Blob([log], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${(documentName || 'documento').replace(/\.tex$/i, '')}.log`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="logs-pane">
      <div className="logs-tabs" role="tablist" aria-label="Filtrar registro de compilación">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={filter === id}
            className={`logs-tab ${filter === id ? 'is-active' : ''}`}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className={`logs-tab-count ${id !== 'all' && counts[id] > 0 ? `has-${id}` : ''}`}>{counts[id]}</span>
          </button>
        ))}
      </div>

      <div className="logs-body">
        {visible.length === 0 ? (
          <div className="logs-empty">
            {entries.length === 0
              ? 'Sin problemas: la última compilación no generó errores ni advertencias.'
              : `No hay mensajes de tipo "${FILTERS.find((item) => item.id === filter)?.label}".`}
          </div>
        ) : (
          visible.map((entry, index) => (
            <LogEntryCard key={`${entry.level}-${index}`} entry={entry} onErrorClick={onErrorClick} />
          ))
        )}

        <section className={`logs-raw ${isRawOpen ? 'is-open' : ''}`}>
          <button
            type="button"
            className="logs-raw-toggle"
            onClick={() => setIsRawOpen((open) => !open)}
            aria-expanded={isRawOpen}
          >
            <span className="logs-raw-chevron" aria-hidden="true">›</span>
            Raw logs
          </button>
          {isRawOpen && (
            log ? <pre className="logs-raw-text">{log}</pre> : <p className="logs-raw-empty">Aún no hay registro: compila el documento.</p>
          )}
        </section>
      </div>

      <footer className="logs-footer">
        <span className="logs-footer-time">
          {compilationTime !== undefined ? `Compilado en ${(compilationTime / 1000).toFixed(1)} s` : ''}
        </span>
        <button type="button" className="logs-footer-btn" onClick={handleDownloadLog} disabled={!log}>
          <Icon name="download" size={14} />
          Descargar log
        </button>
      </footer>
    </div>
  )
}

export default CompilationConsole
