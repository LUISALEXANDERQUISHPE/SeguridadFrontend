import React, { useEffect, useMemo, useRef, useState } from 'react'
import type { CompilationError } from '../../../types/document'
import {
  COMMAND_SUGGESTIONS,
  getSuggestionsForContext,
  type SuggestionItem,
  type SuggestionMatch,
} from '../data/latexSuggestions'

interface LatexCodeEditorProps {
  value: string
  onChange: (value: string) => void
  onSave?: () => void
  errors?: CompilationError[]
  targetLine?: number | null
  onLineFocused?: () => void
  readOnly?: boolean
}

// Resaltador de sintaxis LaTeX básico y rápido para el backdrop
function highlightLatex(code: string): string {
  // Escapar HTML primero
  const escaped = code
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')

  // Dividir en líneas para procesar comentarios y comandos
  const lines = escaped.split('\n')

  const highlightedLines = lines.map((line) => {
    // Comentarios (%)
    const commentIndex = line.indexOf('%')
    let mainPart = line
    let commentPart = ''

    if (commentIndex !== -1 && (commentIndex === 0 || line[commentIndex - 1] !== '\\')) {
      mainPart = line.slice(0, commentIndex)
      commentPart = `<span class="tok-comment">${line.slice(commentIndex)}</span>`
    }

    // Comandos LaTeX: \comando o \comando*
    let formatted = mainPart.replace(/(\\[a-zA-Z]+[*]?)/g, (match) => {
      if (['\\begin', '\\end', '\\documentclass', '\\usepackage'].includes(match)) {
        return `<span class="tok-keyword">${match}</span>`
      }
      if (['\\section', '\\subsection', '\\subsubsection', '\\title', '\\author'].includes(match)) {
        return `<span class="tok-section">${match}</span>`
      }
      return `<span class="tok-command">${match}</span>`
    })

    // Parámetros entre llaves {...}
    formatted = formatted.replace(/(\{)([^{}]+)(\})/g, '$1<span class="tok-arg">$2</span>$3')

    // Parámetros opcionales [...]
    formatted = formatted.replace(/(\[)([^[\]]+)(\])/g, '$1<span class="tok-opt">$2</span>$3')

    // Modo matemático ($...$)
    formatted = formatted.replace(/(\$[^$]+\$)/g, '<span class="tok-math">$1</span>')

    return formatted + commentPart
  })

  return highlightedLines.join('\n')
}

export const LatexCodeEditor: React.FC<LatexCodeEditorProps> = ({
  value,
  onChange,
  onSave,
  errors = [],
  targetLine = null,
  onLineFocused,
  readOnly = false,
}) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const preRef = useRef<HTMLPreElement>(null)
  const gutterRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const suggestionListRef = useRef<HTMLUListElement>(null)

  // Búsqueda y Reemplazo
  const [showFind, setShowFind] = useState(false)
  const [findText, setFindText] = useState('')
  const [replaceText, setReplaceText] = useState('')
  const [matchCount, setMatchCount] = useState(0)

  // Autocompletado y Sugerencias LaTeX
  const [isSuggestOpen, setIsSuggestOpen] = useState(false)
  const [activeMatch, setActiveMatch] = useState<SuggestionMatch | null>(null)
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [suggestPos, setSuggestPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 })

  // Mapa de líneas con errores para visualización en el gutter
  const errorMap = useMemo(() => {
    const map = new Map<number, CompilationError>()
    errors.forEach((err) => {
      if (err.line && !map.has(err.line)) {
        map.set(err.line, err)
      }
    })
    return map
  }, [errors])

  // Desglose de líneas para el gutter
  const lineCount = useMemo(() => {
    return Math.max(1, value.split('\n').length)
  }, [value])

  const lineNumbers = useMemo(() => {
    return Array.from({ length: lineCount }, (_, i) => i + 1)
  }, [lineCount])

  // Calcular la posición exacta de las sugerencias cerca del cursor
  const calculateSuggestPosition = (text: string, caret: number) => {
    if (!textareaRef.current) return
    const textarea = textareaRef.current
    const textBeforeCaret = text.substring(0, caret)
    const lines = textBeforeCaret.split('\n')
    const currentLineIndex = lines.length - 1
    const currentLineText = lines[currentLineIndex] || ''

    // Ancho proporcional en fuente monoespaciada Consolas 13px (~7.82px por carácter)
    const approxCharWidth = 7.82
    const approxLineHeight = 22
    const gutterWidth = 56
    const paddingLeft = 16
    const paddingTop = 12

    const textWidth = currentLineText.length * approxCharWidth
    const top = paddingTop + (currentLineIndex + 1) * approxLineHeight - textarea.scrollTop + 4
    const left = gutterWidth + paddingLeft + textWidth - textarea.scrollLeft

    // Ajustar dentro de los límites visibles del editor
    const containerRect = textarea.getBoundingClientRect()
    const safeLeft = Math.min(Math.max(gutterWidth + 12, left), Math.max(gutterWidth + 12, containerRect.width - 350))
    const safeTop = top + 260 > containerRect.height ? Math.max(10, top - 270) : top

    setSuggestPos({ top: safeTop, left: safeLeft })
  }

  // Comprobar y actualizar sugerencias según lo que escribe el usuario
  const checkSuggestions = (text: string, caret: number) => {
    const match = getSuggestionsForContext(text, caret)
    if (match && match.items.length > 0) {
      setActiveMatch(match)
      setSelectedIndex(0)
      calculateSuggestPosition(text, caret)
      setIsSuggestOpen(true)
    } else {
      setIsSuggestOpen(false)
      setActiveMatch(null)
    }
  }

  // Aplicar sugerencia seleccionada
  const applySuggestion = (item: SuggestionItem) => {
    if (!activeMatch || !textareaRef.current) return
    const textarea = textareaRef.current
    const { replaceStart, replaceEnd } = activeMatch

    const before = value.substring(0, replaceStart)
    const after = value.substring(replaceEnd)
    const newValue = before + item.insertText + after

    onChange(newValue)

    const newCaret = replaceStart + (item.cursorOffset ?? item.insertText.length)

    setIsSuggestOpen(false)
    setActiveMatch(null)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(newCaret, newCaret)
    }, 0)
  }

  const [highlightedLine, setHighlightedLine] = useState<number | null>(null)
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [editorScrollTop, setEditorScrollTop] = useState<number>(0)

  // Sincronizar scroll entre el textarea, el pre del resaltado y el gutter
  const handleScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    const { scrollTop, scrollLeft } = e.currentTarget
    setEditorScrollTop(scrollTop)
    if (preRef.current) {
      preRef.current.scrollTop = scrollTop
      preRef.current.scrollLeft = scrollLeft
    }
    if (gutterRef.current) {
      gutterRef.current.scrollTop = scrollTop
    }
    if (isSuggestOpen && textareaRef.current) {
      calculateSuggestPosition(value, textareaRef.current.selectionStart)
    }
  }

  // Asegurar que el elemento seleccionado en la lista esté siempre a la vista al navegar
  useEffect(() => {
    if (isSuggestOpen && suggestionListRef.current) {
      const activeEl = suggestionListRef.current.children[selectedIndex] as HTMLElement | undefined
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest' })
      }
    }
  }, [selectedIndex, isSuggestOpen])

  // Navegación suave a la línea objetivo y resaltado temporal al hacer clic en un error
  useEffect(() => {
    if (targetLine && targetLine > 0 && textareaRef.current) {
      const textarea = textareaRef.current
      const lines = value.split('\n')
      const clampedLine = Math.min(targetLine, lines.length)

      let charIndex = 0
      for (let i = 0; i < clampedLine - 1; i++) {
        charIndex += lines[i].length + 1
      }
      textarea.focus()
      textarea.setSelectionRange(charIndex, charIndex + (lines[clampedLine - 1]?.length || 0))

      const approxLineHeight = 22
      const targetScrollTop = Math.max(0, (clampedLine - 4) * approxLineHeight)

      textarea.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
      if (preRef.current) preRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' })
      if (gutterRef.current) gutterRef.current.scrollTo({ top: targetScrollTop, behavior: 'smooth' })

      // Resaltar la línea durante 2.5 segundos
      setHighlightedLine(clampedLine)
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current)
      }
      highlightTimeoutRef.current = setTimeout(() => {
        setHighlightedLine(null)
      }, 2500)

      onLineFocused?.()
    }
  }, [targetLine, value, onLineFocused])

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) clearTimeout(highlightTimeoutRef.current)
    }
  }, [])

  // Manejo de teclado (Autocompletado, Atajos, Ctrl+S, Ctrl+F, Tab)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Ctrl+S / Cmd+S
    // Si el menú de sugerencias está abierto
    if (isSuggestOpen && activeMatch && activeMatch.items.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev + 1) % activeMatch.items.length)
        return
      }

      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSelectedIndex((prev) => (prev - 1 + activeMatch.items.length) % activeMatch.items.length)
        return
      }

      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        applySuggestion(activeMatch.items[selectedIndex])
        return
      }

      if (e.key === 'Escape') {
        e.preventDefault()
        setIsSuggestOpen(false)
        setActiveMatch(null)
        return
      }
    }

    // Ctrl + Space -> Forzar apertura manual de sugerencias
    if ((e.ctrlKey || e.metaKey) && e.code === 'Space') {
      e.preventDefault()
      const textarea = textareaRef.current
      if (textarea) {
        const caret = textarea.selectionStart
        const match = getSuggestionsForContext(value, caret)
        if (match && match.items.length > 0) {
          setActiveMatch(match)
          setSelectedIndex(0)
          calculateSuggestPosition(value, caret)
          setIsSuggestOpen(true)
        } else {
          // Si no hay comando previo, sugerir todos los comandos a partir del cursor
          setActiveMatch({
            items: COMMAND_SUGGESTIONS,
            replaceStart: caret,
            replaceEnd: caret,
            type: 'command',
          })
          setSelectedIndex(0)
          calculateSuggestPosition(value, caret)
          setIsSuggestOpen(true)
        }
      }
      return
    }

    // Ctrl+S / Cmd+S -> Guardar y compilar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault()
      setIsSuggestOpen(false)
      setActiveMatch(null)
      onSave?.()
      return
    }

    // Ctrl+F / Cmd+F -> Buscar y reemplazar
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
      e.preventDefault()
      setShowFind((prev) => !prev)
      return
    }

    // Tab -> Insertar 2 espacios si no hay menú de sugerencias abierto
    if (e.key === 'Tab' && !e.shiftKey && !isSuggestOpen) {
      e.preventDefault()
      const textarea = textareaRef.current
      if (!textarea) return
      const start = textarea.selectionStart
      const end = textarea.selectionEnd
      const newValue = value.substring(0, start) + '  ' + value.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2
      }, 0)
    }
  }

  // Cambio en el textarea: actualizar contenido y activar sugerencias en tiempo real
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value
    const caret = e.target.selectionStart
    onChange(newValue)
    checkSuggestions(newValue, caret)
  }

  // Al hacer clic o mover el cursor
  const handleSelectOrClick = (e: React.SyntheticEvent<HTMLTextAreaElement>) => {
    if (isSuggestOpen) {
      const caret = e.currentTarget.selectionStart
      checkSuggestions(value, caret)
    }
  }

  // Búsqueda de texto
  useEffect(() => {
    if (!findText) {
      setMatchCount(0)
      return
    }
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    const matches = value.match(regex)
    setMatchCount(matches ? matches.length : 0)
  }, [findText, value])

  const handleNextMatch = () => {
    if (!findText || !textareaRef.current) return
    const textarea = textareaRef.current
    const searchFrom = textarea.selectionEnd
    const lowerValue = value.toLowerCase()
    const lowerSearch = findText.toLowerCase()
    let nextIndex = lowerValue.indexOf(lowerSearch, searchFrom)
    if (nextIndex === -1) {
      nextIndex = lowerValue.indexOf(lowerSearch, 0)
    }
    if (nextIndex !== -1) {
      textarea.focus()
      textarea.setSelectionRange(nextIndex, nextIndex + findText.length)
      // Ajustar scroll a la posición encontrada
      const lineNum = value.substring(0, nextIndex).split('\n').length
      const approxLineHeight = 22
      textarea.scrollTop = Math.max(0, (lineNum - 3) * approxLineHeight)
    }
  }

  const handleReplace = () => {
    if (!findText || !textareaRef.current) return
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const selected = value.substring(start, end)
    if (selected.toLowerCase() === findText.toLowerCase()) {
      const newValue = value.substring(0, start) + replaceText + value.substring(end)
      onChange(newValue)
      setTimeout(() => {
        textarea.selectionStart = textarea.selectionEnd = start + replaceText.length
        handleNextMatch()
      }, 0)
    } else {
      handleNextMatch()
    }
  }

  const handleReplaceAll = () => {
    if (!findText) return
    const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')
    const newValue = value.replace(regex, replaceText)
    onChange(newValue)
  }

  const highlightedCode = useMemo(() => {
    return highlightLatex(value) + (value.endsWith('\n') ? ' ' : '')
  }, [value])

  return (
    <div className="latex-editor-container" ref={containerRef}>
      {/* Barra flotante de Búsqueda y Reemplazo */}
      {showFind && (
        <div className="editor-find-bar">
          <div className="find-inputs">
            <input
              type="text"
              placeholder="Buscar..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="find-input"
              autoFocus
            />
            <span className="find-counter">{matchCount} coincidencias</span>
            <button type="button" onClick={handleNextMatch} className="find-btn" title="Siguiente">
              ↓
            </button>
            <input
              type="text"
              placeholder="Reemplazar con..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="find-input"
            />
            <button type="button" onClick={handleReplace} className="find-btn">
              Reemplazar
            </button>
            <button type="button" onClick={handleReplaceAll} className="find-btn">
              Todos
            </button>
          </div>
          <button
            type="button"
            onClick={() => setShowFind(false)}
            className="find-close-btn"
            title="Cerrar (Esc)"
          >
            ✕
          </button>
        </div>
      )}

      {/* Menú Emergente Flotante de Autocompletado LaTeX */}
      {isSuggestOpen && activeMatch && activeMatch.items.length > 0 && (
        <div
          className="latex-suggestions-popup"
          style={{ top: `${suggestPos.top}px`, left: `${suggestPos.left}px` }}
          onMouseDown={(e) => e.preventDefault()} // Evitar perder el foco del textarea
        >
          <ul className="suggestions-list" ref={suggestionListRef}>
            {activeMatch.items.map((item, idx) => {
              const isSelected = idx === selectedIndex
              const badgeClass =
                item.type === 'snippet'
                  ? 'badge-snip'
                  : item.type === 'environment'
                  ? 'badge-env'
                  : 'badge-cmd'

              const badgeText =
                item.type === 'snippet' ? 'snip' : item.type === 'environment' ? 'env' : 'cmd'

              return (
                <li
                  key={`${item.label}-${idx}`}
                  className={`suggestion-item ${isSelected ? 'is-selected' : ''}`}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  onClick={() => applySuggestion(item)}
                >
                  <div className="sug-left">
                    <span className={`sug-badge ${badgeClass}`}>{badgeText}</span>
                    <span className="sug-label">{item.label}</span>
                  </div>
                  <span className="sug-desc" title={item.description}>
                    {item.description}
                  </span>
                </li>
              )
            })}
          </ul>
          <div className="suggestions-footer">
            <span>↵ / Tab: insertar</span>
            <span>↑↓: navegar</span>
            <span>Esc: cerrar</span>
          </div>
        </div>
      )}

      <div className="latex-editor-body">
        {/* Gutter de números de línea e indicadores de error */}
        <div className="editor-gutter" ref={gutterRef}>
          {lineNumbers.map((num) => {
            const error = errorMap.get(num)
            const isError = error?.type === 'error'
            const isWarning = error?.type === 'warning'
            const isTarget = highlightedLine === num

            return (
              <div
                key={num}
                className={`gutter-line ${isError ? 'has-error' : ''} ${isWarning ? 'has-warning' : ''} ${isTarget ? 'is-target-highlight' : ''}`}
                title={error ? `Línea ${num}: ${error.message}` : undefined}
              >
                {error && (
                  <span className={`gutter-badge ${isError ? 'badge-error' : 'badge-warning'}`}>
                    {isError ? '●' : '▲'}
                  </span>
                )}
                <span className="gutter-number">{num}</span>
              </div>
            )
          })}
        </div>

        {/* Capa de edición: Backdrop con sintaxis + Textarea transparente en primer plano */}
        <div className="editor-workspace">
          {highlightedLine && (
            <div
              className="editor-line-highlight-bar"
              style={{
                top: `${(highlightedLine - 1) * 22 + 12 - editorScrollTop}px`,
              }}
            />
          )}

          <pre ref={preRef} className="editor-highlight-layer" aria-hidden="true">
            <code dangerouslySetInnerHTML={{ __html: highlightedCode }} />
          </pre>

          <textarea
            ref={textareaRef}
            value={value}
            onChange={handleTextareaChange}
            onScroll={handleScroll}
            onKeyDown={handleKeyDown}
            onSelect={handleSelectOrClick}
            onClick={handleSelectOrClick}
            readOnly={readOnly}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            autoCorrect="off"
            className="editor-textarea"
            placeholder="Escribe tu código LaTeX aquí..."
          />
        </div>
      </div>
    </div>
  )
}

export default LatexCodeEditor
