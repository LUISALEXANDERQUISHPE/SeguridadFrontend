import React, { useEffect, useState } from 'react'
import type { DocumentListItem } from '../../../types/document'
import { getDocuments } from '../../../services/documentService'

interface NewDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onCreate: (name: string, description: string) => Promise<void>
}

export const NewDocumentModal: React.FC<NewDocumentModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!isOpen) return null

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      setError('Por favor escribe un nombre para el documento')
      return
    }

    setIsSubmitting(true)
    setError(null)
    try {
      const finalName = name.trim().endsWith('.tex') ? name.trim() : `${name.trim()}.tex`
      await onCreate(finalName, description.trim())
      setName('')
      setDescription('')
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al crear el documento')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Crear Nuevo Documento LaTeX</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          {error && <div className="modal-error">{error}</div>}

          <div className="modal-field">
            <label htmlFor="doc-name">Nombre del documento:</label>
            <input
              id="doc-name"
              type="text"
              placeholder="ej. Tesis_Final.tex"
              value={name}
              onChange={(e) => setName(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="modal-field">
            <label htmlFor="doc-desc">Descripción (opcional):</label>
            <input
              id="doc-desc"
              type="text"
              placeholder="ej. Borrador del capítulo 1"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          <div className="modal-info">
            <p>Se inicializará con la plantilla estándar de LaTeX (artículo en español con UTF-8 y márgenes de 3cm).</p>
          </div>

          <div className="modal-actions">
            <button type="button" className="modal-btn-cancel" onClick={onClose} disabled={isSubmitting}>
              Cancelar
            </button>
            <button type="submit" className="modal-btn-submit" disabled={isSubmitting}>
              {isSubmitting ? 'Creando...' : 'Crear documento'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

interface OpenDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onSelectDocument: (id: string) => Promise<void>
}

export const OpenDocumentModal: React.FC<OpenDocumentModalProps> = ({
  isOpen,
  onClose,
  onSelectDocument,
}) => {
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    if (isOpen) {
      setLoading(true)
      setError(null)
      getDocuments()
        .then((docs) => setDocuments(docs))
        .catch((err: unknown) => {
          setError(err instanceof Error ? err.message : 'Error al listar los documentos')
        })
        .finally(() => setLoading(false))
    }
  }, [isOpen])

  if (!isOpen) return null

  const filteredDocs = documents.filter((doc) =>
    doc.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (doc.projectName && doc.projectName.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const handleSelect = async (id: string) => {
    try {
      await onSelectDocument(id)
      onClose()
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Error al abrir el documento')
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-dialog modal-dialog-lg" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Abrir Documento Existente</h3>
          <button type="button" className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="modal-search-box">
            <input
              type="text"
              placeholder="Buscar por nombre de archivo o proyecto..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="modal-search-input"
            />
          </div>

          {error && <div className="modal-error">{error}</div>}

          {loading ? (
            <div className="modal-loading">Cargando tus documentos...</div>
          ) : filteredDocs.length === 0 ? (
            <div className="modal-empty-state">
              <p>No se encontraron documentos en tu cuenta.</p>
            </div>
          ) : (
            <div className="docs-table-wrapper">
              <table className="docs-table">
                <thead>
                  <tr>
                    <th>Nombre</th>
                    <th>Proyecto</th>
                    <th>Última modificación</th>
                    <th>Estado de compilación</th>
                    <th>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDocs.map((doc) => (
                    <tr key={doc.id} onClick={() => void handleSelect(doc.id)} className="doc-row">
                      <td className="doc-name-cell">
                        <span className="doc-type-icon">📄</span>
                        <strong>{doc.name}</strong>
                      </td>
                      <td>{doc.projectName || '—'}</td>
                      <td>
                        {doc.updatedAt ? new Date(doc.updatedAt).toLocaleString() : '—'}
                      </td>
                      <td>
                        {doc.lastCompilation?.status === 'exitosa' ? (
                          <span className="table-badge badge-ok">✓ Exitosa</span>
                        ) : doc.lastCompilation?.status ? (
                          <span className="table-badge badge-err">✕ {doc.lastCompilation.status}</span>
                        ) : (
                          <span className="table-badge badge-neutral">Sin compilar</span>
                        )}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="table-open-btn"
                          onClick={(e) => {
                            e.stopPropagation()
                            void handleSelect(doc.id)
                          }}
                        >
                          Abrir
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button type="button" className="modal-btn-cancel" onClick={onClose}>
            Cerrar
          </button>
        </div>
      </div>
    </div>
  )
}
