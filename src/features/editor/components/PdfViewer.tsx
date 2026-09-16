import React, { useEffect, useState } from 'react'
import type { CompileStatus } from '../../../types/document'
import { downloadPdfFile, getPdfBlob } from '../../../services/documentService'

interface PdfViewerProps {
  documentId: string | null
  documentName?: string
  pdfUrl: string | null
  previousPdfUrl: string | null
  compileStatus: CompileStatus
  compileTimestamp: number
  isCompiling?: boolean
  onCompileRequest?: () => void
}

export const PdfViewer: React.FC<PdfViewerProps> = ({
  documentId,
  documentName = 'documento.pdf',
  pdfUrl,
  previousPdfUrl,
  compileStatus,
  compileTimestamp,
  isCompiling = false,
  onCompileRequest,
}) => {
  const [pdfBlobUrl, setPdfBlobUrl] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [zoomLevel, setZoomLevel] = useState<number>(100)
  const [currentPage, setCurrentPage] = useState<number>(1)

  useEffect(() => {
    // 3. No llamar GET /pdf cuando success: false
    if (compileStatus === 'failed') {
      console.log('[PDF] solicitud omitida porque success=false')

      // 7. Si previousPdfUrl es null, no mantener PDF previo
      // 8. Mantener el PDF anterior solamente si realmente existe
      if (!previousPdfUrl) {
        if (pdfBlobUrl) {
          window.URL.revokeObjectURL(pdfBlobUrl)
          setPdfBlobUrl(null)
        }
      }
      setLoading(false)
      return
    }

    // 4. No actualizar pdfUrl cuando pdfUrl es null, y no llamar si no hay documentId
    if (!documentId || !pdfUrl) {
      if (pdfBlobUrl && !previousPdfUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl)
        setPdfBlobUrl(null)
      }
      setLoading(false)
      return
    }

    // Si la compilación está en curso, esperar a que finalice
    if (compileStatus === 'compiling') {
      return
    }

    // 5. Carga segura del PDF como Blob únicamente cuando existe un PDF válido
    let isMounted = true
    const loadPdf = async () => {
      setLoading(true)

      try {
        const blob = await getPdfBlob(documentId)
        if (!isMounted) return

        if (pdfBlobUrl) {
          window.URL.revokeObjectURL(pdfBlobUrl)
        }
        const newUrl = window.URL.createObjectURL(blob)
        setPdfBlobUrl(newUrl)
      } catch (err: unknown) {
        if (!isMounted) return
        // 6. No mostrar el 404 como un error independiente de red
        console.warn('[PDF] Error al cargar el archivo PDF:', err)
        setPdfBlobUrl(null)
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    void loadPdf()

    return () => {
      isMounted = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documentId, pdfUrl, compileTimestamp, compileStatus, previousPdfUrl])

  // Limpieza al desmontar
  useEffect(() => {
    return () => {
      if (pdfBlobUrl) {
        window.URL.revokeObjectURL(pdfBlobUrl)
      }
    }
  }, [pdfBlobUrl])

  const handleDownload = () => {
    if (!documentId) return
    const filename = documentName.replace(/\.tex$/i, '') + '.pdf'
    void downloadPdfFile(documentId, filename)
  }

  const handleZoomIn = () => setZoomLevel((prev) => Math.min(prev + 25, 250))
  const handleZoomOut = () => setZoomLevel((prev) => Math.max(prev - 25, 50))
  const handleZoomReset = () => setZoomLevel(100)

  // URL con parámetros de navegación de PDF embebido (RFC 3778)
  const viewerUrl = pdfBlobUrl
    ? `${pdfBlobUrl}#page=${currentPage}&zoom=${zoomLevel}`
    : null

  return (
    <div className="pdf-viewer-container">
      {/* Barra de herramientas del Visor PDF */}
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          <span className="pdf-toolbar-title">Vista previa PDF</span>
        </div>

        {pdfBlobUrl && !loading && (
          <div className="pdf-toolbar-group">
            {/* Controles de página */}
            <button
              type="button"
              className="pdf-btn"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              title="Página anterior"
            >
              ◀
            </button>
            <span className="pdf-page-indicator">Pág. {currentPage}</span>
            <button
              type="button"
              className="pdf-btn"
              onClick={() => setCurrentPage((p) => p + 1)}
              title="Página siguiente"
            >
              ▶
            </button>

            <span className="pdf-toolbar-separator" />

            {/* Controles de Zoom */}
            <button
              type="button"
              className="pdf-btn"
              onClick={handleZoomOut}
              disabled={zoomLevel <= 50}
              title="Reducir zoom (-25%)"
            >
              -
            </button>
            <button
              type="button"
              className="pdf-zoom-label"
              onClick={handleZoomReset}
              title="Restablecer zoom al 100%"
            >
              {zoomLevel}%
            </button>
            <button
              type="button"
              className="pdf-btn"
              onClick={handleZoomIn}
              disabled={zoomLevel >= 250}
              title="Aumentar zoom (+25%)"
            >
              +
            </button>

            <span className="pdf-toolbar-separator" />

            {/* Descargar PDF */}
            <button
              type="button"
              className="pdf-btn pdf-btn-action"
              onClick={handleDownload}
              title="Descargar archivo PDF"
            >
              Descargar PDF
            </button>
          </div>
        )}
      </div>

      {/* Contenido del visor */}
      <div className="pdf-viewport">
        {isCompiling ? (
          <div className="pdf-status-screen">
            <div className="pdf-spinner" />
            <p className="pdf-status-text">Compilando documento con pdflatex...</p>
            <span className="pdf-status-sub">Generando archivo PDF aislado de forma segura</span>
          </div>
        ) : loading ? (
          <div className="pdf-status-screen">
            <div className="pdf-spinner" />
            <p className="pdf-status-text">Cargando PDF...</p>
          </div>
        ) : compileStatus === 'failed' && (!previousPdfUrl || !pdfBlobUrl) ? (
          /* 7. Si previousPdfUrl es null, mostrar “No existe un PDF válido para esta compilación” */
          <div className="pdf-status-screen">
            <div className="pdf-empty-icon">⚠️</div>
            <p className="pdf-status-text">No existe un PDF válido para esta compilación</p>
            <span className="pdf-status-sub">
              LaTeX encontró errores en el código fuente. Revisa los detalles en la consola inferior para corregirlos.
            </span>
            {onCompileRequest && (
              <button
                type="button"
                onClick={onCompileRequest}
                className="pdf-compile-cta-btn"
              >
                Reintentar compilación
              </button>
            )}
          </div>
        ) : viewerUrl ? (
          /* 8. Mantener el PDF anterior solamente si realmente existe */
          <div className="pdf-frame-wrapper">
            {compileStatus === 'failed' && previousPdfUrl && (
              <div className="pdf-stale-banner">
                ⚠️ Mostrando versión previa (la última compilación tuvo errores)
              </div>
            )}
            <iframe
              src={viewerUrl}
              title="Visor PDF Compilado"
              className="pdf-iframe"
            />
          </div>
        ) : (
          <div className="pdf-status-screen">
            <div className="pdf-empty-icon">📝</div>
            <p className="pdf-status-text">Sin vista previa aún</p>
            <span className="pdf-status-sub">
              Presiona <strong>Compilar</strong> para generar el PDF a partir del código LaTeX.
            </span>
            {onCompileRequest && (
              <button
                type="button"
                onClick={onCompileRequest}
                className="pdf-compile-cta-btn"
              >
                Compilar código
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default PdfViewer
