import React, { useEffect, useState } from 'react'
import { downloadProjectNode, getProjectNodeBlob } from '../../../services/documentService'
import type { ProjectNode } from '../../../types/document'
import { getLatexReference } from '../../../utils/fileTypes'

interface CopyableSnippetProps {
  code: string
}

/**
 * Bloque de código con botón para copiarlo al portapapeles
 */
export const CopyableSnippet: React.FC<CopyableSnippetProps> = ({ code }) => {
  const [status, setStatus] = useState<'idle' | 'copied' | 'error'>('idle')

  useEffect(() => {
    if (status === 'idle') return
    const timer = setTimeout(() => setStatus('idle'), 1800)
    return () => clearTimeout(timer)
  }, [status])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code)
      setStatus('copied')
    } catch {
      setStatus('error')
    }
  }

  return (
    <div className="copyable-snippet">
      <button type="button" className={`copyable-snippet-btn ${status}`} onClick={() => void copy()} title="Copiar al portapapeles">
        {status === 'copied' ? '✓ Copiado' : status === 'error' ? 'No se pudo copiar' : '⧉ Copiar'}
      </button>
      <pre>{code}</pre>
    </div>
  )
}

interface FilePreviewProps {
  projectId: string
  node: ProjectNode
  // Ruta relativa a la raíz del proyecto (ej. "imagenes/logo.png")
  path: string
}

/**
 * Visor de archivos binarios (imágenes, PDFs...) que se muestra en la pestaña del editor
 */
export const FilePreview: React.FC<FilePreviewProps> = ({ projectId, node, path }) => {
  const [preview, setPreview] = useState<{ url: string; type: string } | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let url: string | null = null
    let cancelled = false
    getProjectNodeBlob(projectId, node.id)
      .then((blob) => {
        if (cancelled) return
        url = URL.createObjectURL(blob)
        setPreview({ url, type: blob.type })
        setError(null)
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : 'No fue posible abrir el archivo')
      })
    return () => {
      cancelled = true
      if (url) URL.revokeObjectURL(url)
      setPreview(null)
    }
  }, [projectId, node.id])

  return (
    <div className="file-preview-panel">
      <div className="file-preview-stage">
        {error ? (
          <div className="modal-error">{error}</div>
        ) : !preview ? (
          <div className="modal-loading">Cargando {node.nombre}...</div>
        ) : preview.type.startsWith('image/') ? (
          <img src={preview.url} alt={node.nombre} />
        ) : preview.type === 'application/pdf' ? (
          <iframe src={preview.url} title={node.nombre} />
        ) : (
          <p>Este archivo no tiene vista previa.</p>
        )}
      </div>
      <div className="file-preview-info">
        <div className="file-preview-meta">
          <strong>{path}</strong>
          {typeof node.tamano_bytes === 'number' && <span>{(node.tamano_bytes / 1024).toFixed(1)} KB</span>}
          <button type="button" className="file-preview-download" onClick={() => void downloadProjectNode(projectId, node)}>↓ Descargar</button>
        </div>
        <span className="file-preview-hint">Pega este código en tu archivo .tex para usarlo:</span>
        <CopyableSnippet code={getLatexReference(path)} />
      </div>
    </div>
  )
}

export default FilePreview
