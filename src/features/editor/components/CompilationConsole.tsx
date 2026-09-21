import React, { useState } from 'react'
import type { CompilationError } from '../../../types/document'

interface CompilationConsoleProps {
  errors: CompilationError[]
  warnings: CompilationError[]
  log?: string
  compilationTime?: number
  onErrorClick: (line: number) => void
  isOpen: boolean
  onToggleOpen: () => void
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
  return null
}

export const CompilationConsole: React.FC<CompilationConsoleProps> = ({
  errors,
  warnings,
  log,
  compilationTime,
  onErrorClick,
  isOpen,
  onToggleOpen,
}) => {
  const [activeTab, setActiveTab] = useState<'issues' | 'log'>('issues')
  const [filterType, setFilterType] = useState<'all' | 'errors' | 'warnings'>('all')

  const totalErrors = errors.length
  const totalWarnings = warnings.length
  const totalIssues = totalErrors + totalWarnings

  const displayedErrors = filterType === 'warnings' ? [] : errors
  const displayedWarnings = filterType === 'errors' ? [] : warnings

  if (!isOpen) {
    return (
      <div className="console-minimized" onClick={onToggleOpen}>
        <div className="console-min-left">
          <span className="console-icon">⚙</span>
          <span className="console-title">Consola de compilación</span>
          {totalErrors > 0 && (
            <span className="console-badge badge-err">{totalErrors} error{totalErrors > 1 ? 'es' : ''}</span>
          )}
          {totalWarnings > 0 && (
            <span className="console-badge badge-warn">{totalWarnings} aviso{totalWarnings > 1 ? 's' : ''}</span>
          )}
          {totalIssues === 0 && (
            <span className="console-badge badge-ok">Sin errores</span>
          )}
        </div>
        <button type="button" className="console-toggle-btn" title="Expandir consola">
          ▲ Abrir consola
        </button>
      </div>
    )
  }

  return (
    <div className="console-container">
      {/* Barra de cabecera de la consola */}
      <div className="console-header">
        <div className="console-tabs">
          <button
            type="button"
            className={`console-tab ${activeTab === 'issues' ? 'active' : ''}`}
            onClick={() => setActiveTab('issues')}
          >
            Errores y Advertencias
            {totalIssues > 0 && (
              <span className={`console-tab-count ${totalErrors > 0 ? 'has-errors' : 'has-warnings'}`}>
                {totalIssues}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`console-tab ${activeTab === 'log' ? 'active' : ''}`}
            onClick={() => setActiveTab('log')}
          >
            Log de pdflatex
          </button>
        </div>

        <div className="console-actions">
          {activeTab === 'issues' && totalIssues > 0 && (
            <div className="console-filters">
              <button
                type="button"
                className={`filter-btn ${filterType === 'all' ? 'active' : ''}`}
                onClick={() => setFilterType('all')}
              >
                Todos ({totalIssues})
              </button>
              <button
                type="button"
                className={`filter-btn ${filterType === 'errors' ? 'active' : ''}`}
                onClick={() => setFilterType('errors')}
              >
                Errores ({totalErrors})
              </button>
              <button
                type="button"
                className={`filter-btn ${filterType === 'warnings' ? 'active' : ''}`}
                onClick={() => setFilterType('warnings')}
              >
                Avisos ({totalWarnings})
              </button>
            </div>
          )}

          {compilationTime !== undefined && (
            <span className="console-time">Tiempo: {compilationTime}ms</span>
          )}
          <button
            type="button"
            className="console-close-btn"
            onClick={onToggleOpen}
            title="Minimizar consola"
          >
            ▼ Minimizar
          </button>
        </div>
      </div>

      {/* Cuerpo de la consola */}
      <div className="console-body">
        {activeTab === 'issues' ? (
          <div className="console-issues-list">
            {totalIssues === 0 ? (
              <div className="console-empty">
                <p>✓ Compilación limpia. No se encontraron errores de sintaxis en el código LaTeX.</p>
              </div>
            ) : (
              <>
                {displayedErrors.map((err, idx) => {
                  const friendlyText = err.friendlyMessage || getFriendlyExplanation(err.message)
                  return (
                    <div
                      key={`err-${idx}`}
                      className="console-issue-item item-error"
                      onClick={() => err.line && onErrorClick(err.line)}
                      role="button"
                      tabIndex={0}
                      title={`Haz clic para ir a la línea ${err.line || '?'}`}
                    >
                      <div className="issue-meta">
                        <span className="issue-tag tag-error">ERROR</span>
                        <span className="issue-line-badge">Línea {err.line || '?'}</span>
                        <span className="issue-file">{err.file || 'document.tex'}</span>
                        {err.line && <span className="issue-jump-hint">Saltar a línea {err.line} ➔</span>}
                      </div>
                      <div className="issue-message">{err.message}</div>
                      {err.context && (
                        <div className="issue-context">
                          <span className="issue-context-label">Contexto:</span>
                          <code className="issue-context-code">{err.context}</code>
                        </div>
                      )}
                      {friendlyText && (
                        <div className="issue-friendly-explanation">
                          <span className="friendly-icon">💡</span>
                          <span className="friendly-text">{friendlyText}</span>
                        </div>
                      )}
                    </div>
                  )
                })}

                {displayedWarnings.map((warn, idx) => {
                  const friendlyText = warn.friendlyMessage || getFriendlyExplanation(warn.message)
                  return (
                    <div
                      key={`warn-${idx}`}
                      className="console-issue-item item-warning"
                      onClick={() => warn.line && onErrorClick(warn.line)}
                      role="button"
                      tabIndex={0}
                      title={`Haz clic para ir a la línea ${warn.line || '?'}`}
                    >
                      <div className="issue-meta">
                        <span className="issue-tag tag-warning">ADVERTENCIA</span>
                        <span className="issue-line-badge">Línea {warn.line || '?'}</span>
                        <span className="issue-file">{warn.file || 'document.tex'}</span>
                        {warn.line && <span className="issue-jump-hint">Saltar a línea {warn.line} ➔</span>}
                      </div>
                      <div className="issue-message">{warn.message}</div>
                      {warn.context && (
                        <div className="issue-context">
                          <span className="issue-context-label">Contexto:</span>
                          <code className="issue-context-code">{warn.context}</code>
                        </div>
                      )}
                      {friendlyText && (
                        <div className="issue-friendly-explanation">
                          <span className="friendly-icon">💡</span>
                          <span className="friendly-text">{friendlyText}</span>
                        </div>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        ) : (
          <div className="console-raw-log">
            {log ? (
              <pre className="raw-log-text">{log}</pre>
            ) : (
              <div className="console-empty">
                <p>No hay registro de salida disponible aún.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default CompilationConsole
