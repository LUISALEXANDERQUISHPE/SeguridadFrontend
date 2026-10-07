import React, { useState } from 'react'
import type { CompileStatus, SaveStatus } from '../../../types/document'

interface EditorToolbarProps {
  documentName: string
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
  isCompiling: boolean
  isSaving: boolean
}

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  documentName,
  saveStatus,
  compileStatus,
  lastSavedAt,
  onNew,
  onOpen,
  onSave,
  onCompile,
  onDownloadPdf,
  onDownloadSource,
  isCompiling,
  isSaving,
}) => {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false)

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
    <div className="editor-top-toolbar">
      {/* Información del documento */}
      <div className="toolbar-doc-info">
        <div className="doc-icon">📄</div>
        <div className="doc-title-box">
          <span className="doc-title">{documentName || 'Documento sin título'}</span>
          <div className="doc-badges">
            {renderStatusBadges()}
          </div>
        </div>
      </div>

      {/* Botones de acción principales */}
      <div className="toolbar-actions">
        {onNew && (
          <button
            type="button"
            className="toolbar-btn btn-secondary"
            onClick={onNew}
            title="Crear un nuevo documento LaTeX"
          >
            ➕ Nuevo
          </button>
        )}

        {onOpen && (
          <button
            type="button"
            className="toolbar-btn btn-secondary"
            onClick={onOpen}
            title="Abrir un documento existente"
          >
            📂 Abrir
          </button>
        )}

        <button
          type="button"
          className="toolbar-btn btn-secondary"
          onClick={onSave}
          disabled={isSaving}
          title="Guardar versión formal (Ctrl+S)"
        >
          💾 Guardar
        </button>

        <span className="toolbar-divider" />

        {/* Botón principal de compilación */}
        <button
          type="button"
          className="toolbar-btn btn-compile"
          onClick={onCompile}
          disabled={isCompiling}
          title="Compilar código LaTeX a PDF (con pdflatex)"
        >
          {isCompiling ? (
            <>
              <span className="btn-spinner" />
              Compilando...
            </>
          ) : (
            <>▶ Recompilar</>
          )}
        </button>

        <span className="toolbar-divider" />

        {/* Menú de Descargas */}
        <div className="toolbar-dropdown-container">
          <button
            type="button"
            className="toolbar-btn btn-secondary"
            onClick={() => setShowDownloadMenu((prev) => !prev)}
            title="Opciones de descarga"
          >
            ⬇ Descargar ▾
          </button>

          {showDownloadMenu && (
            <div className="toolbar-dropdown-menu">
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowDownloadMenu(false)
                  onDownloadPdf()
                }}
              >
                📕 Descargar PDF compilado
              </button>
              <button
                type="button"
                className="dropdown-item"
                onClick={() => {
                  setShowDownloadMenu(false)
                  onDownloadSource()
                }}
              >
                📄 Descargar código fuente (.tex)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default EditorToolbar
