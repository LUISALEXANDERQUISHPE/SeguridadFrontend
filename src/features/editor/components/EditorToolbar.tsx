import React, { useEffect, useState } from 'react'
import type { CompileStatus, SaveStatus } from '../../../types/document'

interface EditorToolbarProps {
  documentName: string
  documentId: string
  saveStatus: SaveStatus
  compileStatus: CompileStatus
  lastSavedAt: string | null
  // Opcionales: la gestión de proyectos (nuevo/abrir) vive en la barra lateral
  onNew?: () => void
  onOpen?: () => void
  onSave: () => void
  onCompile: () => void
  onDownloadPdf: () => void
  onDownloadSource: () => void
  onInsertText?: (text: string) => void
  onToggleConsole?: () => void
  isCompiling: boolean
  isSaving: boolean
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  documentName,
  documentId,
  saveStatus,
  compileStatus,
  lastSavedAt,
  onNew,
  onOpen,
  onSave,
  onCompile,
  onDownloadPdf,
  onDownloadSource,
  onInsertText,
  onToggleConsole,
  isCompiling,
  isSaving,
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)
  const [activeMenu, setActiveMenu] = useState<string | null>(null)

  useEffect(() => {
    const closeMenus = () => {
      setActiveMenu(null)
      setShowDownloadMenu(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeMenus()
    }
    window.addEventListener('click', closeMenus)
    window.addEventListener('keydown', handleKeyDown)
    return () => {
      window.removeEventListener('click', closeMenus)
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [])

  const menuAction = (action: () => void) => {
    setActiveMenu(null)
    setShowDownloadMenu(false)
    action()
  }

  const insert = (text: string) => menuAction(() => onInsertText?.(text))
  const editCommand = (command: 'undo' | 'redo' | 'selectAll') => menuAction(() => {
    const editor = document.querySelector<HTMLTextAreaElement>('.editor-textarea')
    editor?.focus()
    document.execCommand(command)
  })

  const renderStatusBadges = () => {
    if (saveStatus === 'saving') {
      return <span className="status-badge badge-saving">Guardando...</span>
    }
    if (saveStatus === 'error') {
      return <span className="status-badge badge-error">✕ Error al guardar</span>
    }
    if (compileStatus === 'compiling') {
      return (
        <>
          {saveStatus === 'saved' && <span className="status-badge badge-saved">✓ Guardado</span>}
          <span className="status-badge badge-compiling">Compilando...</span>
        </>
      )
    }
    if (compileStatus === 'failed') {
      return (
        <>
          {saveStatus === 'saved' && <span className="status-badge badge-saved">✓ Guardado</span>}
          <span className="status-badge badge-compile-failed">✕ Error de compilación</span>
        </>
      )
    }
    if (saveStatus === 'saved' && compileStatus === 'success') {
      return (
        <span
          className="status-badge badge-compile-success"
          title={lastSavedAt ? `Guardado a las ${lastSavedAt}` : 'Guardado y compilado'}
        >
          ✓ Guardado y compilado
        </span>
      )
    }
    if (saveStatus === 'saved') {
      return (
        <span
          className="status-badge badge-saved"
          title={lastSavedAt ? `Guardado a las ${lastSavedAt}` : 'Guardado'}
        >
          ✓ Guardado
        </span>
      )
    }
    if (saveStatus === 'unsaved') {
      return <span className="status-badge badge-unsaved">● Cambios sin guardar</span>
    }
    return null
  }

  return (
    <div className="editor-top-toolbar" onClick={(event) => event.stopPropagation()}>
      <div className="editor-brand">
        <div className="brand-mark">S</div>
        <span className="editor-brand-name">Secureleaf</span>
      </div>
      <nav className="editor-menu-links" aria-label="Menú del editor">
        {[
          {
            label: 'Archivo',
            items: [
              ['Nuevo documento', onNew],
              ['Abrir documento', onOpen],
              ['Guardar', onSave],
              ['Recompilar', onCompile],
              ['Descargar PDF', onDownloadPdf],
              ['Descargar código fuente', onDownloadSource],
            ],
          },
          {
            label: 'Editar',
            items: [
              ['Deshacer', () => editCommand('undo')],
              ['Rehacer', () => editCommand('redo')],
              ['Seleccionar todo', () => editCommand('selectAll')],
            ],
          },
          {
            label: 'Insertar',
            items: [
              ['Sección', () => insert('\\section{Título}\\n')],
              ['Subsección', () => insert('\\subsection{Título}\\n')],
              ['Ecuación', () => insert('\\begin{equation}\\n  \\n\\end{equation}\\n')],
              ['Tabla', () => insert('\\begin{table}\\n  \\centering\\n\\end{table}\\n')],
              ['Imagen', () => insert('\\includegraphics[width=\\\\textwidth]{archivo}\\n')],
            ],
          },
          {
            label: 'Ver',
            items: [
              ['Consola de compilación', onToggleConsole],
              ['Recompilar PDF', onCompile],
            ],
          },
          {
            label: 'Formato',
            items: [
              ['Texto en negrita', () => insert('\\textbf{texto}')],
              ['Texto en cursiva', () => insert('\\textit{texto}')],
              ['Lista', () => insert('\\begin{itemize}\\n  \\item Elemento\\n\\end{itemize}\\n')],
            ],
          },
          {
            label: 'Ayuda',
            items: [
              ['Atajos de teclado', () => window.open('https://www.overleaf.com/learn/latex/TeX_keyboard_shortcuts', '_blank', 'noopener,noreferrer')],
              ['Documentación de LaTeX', () => window.open('https://www.overleaf.com/learn/latex', '_blank', 'noopener,noreferrer')],
            ],
          },
        ].map((menu) => (
          <div className="editor-menu-dropdown" key={menu.label}>
            <button
              type="button"
              className={`editor-menu-trigger ${activeMenu === menu.label ? 'is-active' : ''}`}
              onClick={() => setActiveMenu((previous) => previous === menu.label ? null : menu.label)}
            >
              {menu.label}
            </button>
            {activeMenu === menu.label && (
              <div className="editor-menu-panel">
                {menu.items.map(([label, action]) => (
                  <button
                    key={label}
                    type="button"
                    className="editor-menu-item"
                    disabled={!action || (label === 'Recompilar' && isCompiling) || (label === 'Guardar' && isSaving)}
                    onClick={() => menuAction(action || (() => undefined))}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className="editor-project-name" title={documentName}>{documentName || 'Documento sin título'} <span>⌄</span></div>
      <div className="editor-toolbar-quick-actions">
        <span className="toolbar-status">{renderStatusBadges()}</span>
        <button type="button" className="toolbar-quick-btn" onClick={() => onCompile()} disabled={isCompiling} title="Recompilar">
          {isCompiling ? <span className="btn-spinner" /> : '▶'}
        </button>
        <button type="button" className="toolbar-quick-btn" onClick={onDownloadPdf} title="Descargar PDF">↓</button>
        <button type="button" className="toolbar-quick-btn" title="Historial">◷ <span>Historial</span></button>
        <button type="button" className="toolbar-quick-btn" title="Distribución">▣ <span>Diseño</span></button>
        <button type="button" className="toolbar-share-btn" title="Compartir">♣ <span>Compartir</span></button>
      </div>
    </div>
  )
}

export default EditorToolbar
