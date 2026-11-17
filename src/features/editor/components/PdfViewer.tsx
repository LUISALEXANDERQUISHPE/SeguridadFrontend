import { useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import type { CompileStatus } from '../../../types/document'
import { downloadPdfFile } from '../../../services/documentService'
import Icon from '../../../components/common/Icon'
import { usePdfDocument } from '../pdf/usePdfDocument'
import PdfPage from '../pdf/PdfPage'
import type { PDFDocumentProxy } from '../pdf/pdfjs'

const ZOOM_STEP = 1.2
const MIN_SCALE = 0.4
const MAX_SCALE = 4
const PAGE_GAP_PX = 32

type ZoomMode = 'fit-width' | number

interface PageSize {
  width: number
  height: number
}

interface PdfViewerProps {
  /** Número de errores de la última compilación (insignia del botón de registro). */
  errorCount?: number
  onToggleLogs?: () => void
  documentId: string | null
  documentName?: string
  pdfUrl: string | null
  previousPdfUrl: string | null
  compileStatus: CompileStatus
  compileTimestamp: number
  isCompiling?: boolean
  onCompileRequest?: () => void
}

/** Ancho disponible del contenedor de páginas, actualizado al redimensionar los paneles. */
function useElementWidth(ref: RefObject<HTMLElement | null>): number {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width))
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return width
}

/** Tamaño (a escala 1) de la primera página, usado para calcular el zoom "ajustar al ancho". */
function useFirstPageSize(pdf: PDFDocumentProxy | null): PageSize | null {
  const [size, setSize] = useState<{ pdf: PDFDocumentProxy; value: PageSize } | null>(null)

  useEffect(() => {
    if (!pdf) return undefined
    let isCurrent = true
    pdf
      .getPage(1)
      .then((page) => {
        const viewport = page.getViewport({ scale: 1 })
        if (isCurrent) setSize({ pdf, value: { width: viewport.width, height: viewport.height } })
      })
      .catch((err: unknown) => console.warn('[PDF] No se pudo leer la primera página:', err))
    return () => {
      isCurrent = false
    }
  }, [pdf])

  return size && size.pdf === pdf ? size.value : null
}

function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

interface StatusScreenProps {
  icon?: ReactNode
  title: string
  description?: string
  action?: ReactNode
}

function StatusScreen({ icon, title, description, action }: Readonly<StatusScreenProps>) {
  return (
    <div className="pdf-status-screen">
      {icon}
      <p className="pdf-status-text">{title}</p>
      {description && <span className="pdf-status-sub">{description}</span>}
      {action}
    </div>
  )
}

/**
 * Visor del PDF compilado (pdf.js), con la barra de Overleaf:
 * Recompilar, registro y descarga a la izquierda; páginas y zoom a la derecha.
 */
export function PdfViewer({
  errorCount = 0,
  onToggleLogs,
  documentId,
  documentName = 'documento.pdf',
  pdfUrl,
  previousPdfUrl,
  compileStatus,
  compileTimestamp,
  isCompiling = false,
  onCompileRequest,
}: Readonly<PdfViewerProps>) {
  const { pdf, loading } = usePdfDocument({ documentId, pdfUrl, previousPdfUrl, compileStatus, compileTimestamp })
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const containerWidth = useElementWidth(scrollRef)
  const pageSize = useFirstPageSize(pdf)
  const [zoom, setZoom] = useState<ZoomMode>('fit-width')
  const [currentPage, setCurrentPage] = useState(1)

  const numPages = pdf?.numPages ?? 0
  const fitScale = pageSize && containerWidth > 0 ? (containerWidth - PAGE_GAP_PX) / pageSize.width : 1
  const scale = clampScale(zoom === 'fit-width' ? fitScale : zoom)
  const visiblePage = Math.min(Math.max(currentPage, 1), Math.max(numPages, 1))

  const handleScroll = () => {
    const container = scrollRef.current
    if (!container) return
    const probe = container.scrollTop + container.clientHeight / 3
    const pages = Array.from(container.querySelectorAll<HTMLElement>('.pdfjs-page'))
    const current = pages.findLast((page) => page.offsetTop <= probe)
    setCurrentPage(Number(current?.dataset.pageNumber ?? 1))
  }

  const goToPage = (pageNumber: number) => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`)
    target?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const handleDownload = () => {
    if (!documentId) return
    void downloadPdfFile(documentId, `${documentName.replace(/\.tex$/i, '')}.pdf`)
  }

  const renderContent = () => {
    if (pdf && pageSize) {
      return Array.from({ length: numPages }, (_, index) => (
        <PdfPage key={index + 1} pdf={pdf} pageNumber={index + 1} scale={scale} baseSize={pageSize} />
      ))
    }
    if (isCompiling || loading) {
      return (
        <StatusScreen
          icon={<div className="pdf-spinner" />}
          title={isCompiling ? 'Compilando documento...' : 'Cargando PDF...'}
        />
      )
    }
    if (compileStatus === 'failed') {
      return (
        <StatusScreen
          icon={<div className="pdf-empty-icon">⚠️</div>}
          title="No existe un PDF válido para esta compilación"
          description="LaTeX encontró errores en el código fuente. Revisa el registro para corregirlos."
          action={
            onToggleLogs && (
              <button type="button" onClick={onToggleLogs} className="pdf-compile-cta-btn">
                Ver errores
              </button>
            )
          }
        />
      )
    }
    return (
      <StatusScreen
        icon={<div className="pdf-empty-icon">📝</div>}
        title="Sin vista previa aún"
        description="Presiona Recompilar para generar el PDF a partir del código LaTeX."
      />
    )
  }

  const hasPages = Boolean(pdf && pageSize)

  return (
    <div className="pdf-viewer-container">
      <div className="pdf-toolbar">
        <div className="pdf-toolbar-group">
          {onCompileRequest && (
            <button
              type="button"
              className="pdf-recompile-btn"
              onClick={onCompileRequest}
              disabled={isCompiling}
              title="Compilar el código LaTeX a PDF (Ctrl+S guarda y compila)"
            >
              {isCompiling && <span className="btn-spinner" />}
              {isCompiling ? 'Compilando...' : 'Recompilar'}
            </button>
          )}
          {onToggleLogs && (
            <button
              type="button"
              className={`pdf-logs-btn ${errorCount > 0 ? 'has-errors' : ''}`}
              onClick={onToggleLogs}
              title="Registro y errores de compilación"
              aria-label={`Registro de compilación: ${errorCount} errores`}
            >
              <Icon name="file" />
              {errorCount > 0 && <span className="pdf-logs-count">{errorCount}</span>}
            </button>
          )}
          <button
            type="button"
            className="pdf-logs-btn"
            onClick={handleDownload}
            disabled={!hasPages}
            title="Descargar PDF"
            aria-label="Descargar PDF"
          >
            <Icon name="download" />
          </button>
        </div>

        {hasPages && (
          <div className="pdf-toolbar-group pdf-nav-group">
            <button
              type="button"
              className="pdf-logs-btn"
              onClick={() => goToPage(visiblePage - 1)}
              disabled={visiblePage <= 1}
              aria-label="Página anterior"
              title="Página anterior"
            >
              <Icon name="arrowUp" />
            </button>
            <span className="pdf-page-indicator">
              {visiblePage} / {numPages}
            </span>
            <button
              type="button"
              className="pdf-logs-btn"
              onClick={() => goToPage(visiblePage + 1)}
              disabled={visiblePage >= numPages}
              aria-label="Página siguiente"
              title="Página siguiente"
            >
              <Icon name="arrowDown" />
            </button>

            <span className="pdf-toolbar-separator" aria-hidden="true" />

            <button
              type="button"
              className="pdf-logs-btn"
              onClick={() => setZoom(clampScale(scale / ZOOM_STEP))}
              disabled={scale <= MIN_SCALE}
              aria-label="Reducir zoom"
              title="Reducir zoom"
            >
              −
            </button>
            <button
              type="button"
              className="pdf-zoom-label"
              onClick={() => setZoom('fit-width')}
              title="Ajustar al ancho"
            >
              {Math.round(scale * 100)}%
            </button>
            <button
              type="button"
              className="pdf-logs-btn"
              onClick={() => setZoom(clampScale(scale * ZOOM_STEP))}
              disabled={scale >= MAX_SCALE}
              aria-label="Aumentar zoom"
              title="Aumentar zoom"
            >
              +
            </button>
          </div>
        )}
      </div>

      {compileStatus === 'failed' && hasPages && (
        <div className="pdf-stale-banner">Mostrando la versión anterior: la última compilación tuvo errores</div>
      )}

      <div
        ref={scrollRef}
        className={`pdfjs-scroll ${hasPages ? 'has-pages' : ''} ${isCompiling && hasPages ? 'is-compiling' : ''}`}
        onScroll={handleScroll}
      >
        {renderContent()}
      </div>
    </div>
  )
}

export default PdfViewer
