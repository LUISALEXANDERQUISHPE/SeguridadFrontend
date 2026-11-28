import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import type { CompileStatus } from '../../../types/document'
import { downloadPdfFile } from '../../../services/documentService'
import Icon from '../../../components/common/Icon'
import { usePdfDocument } from '../pdf/usePdfDocument'
import { useElementSize, useFirstPageSize } from '../pdf/usePdfLayout'
import { usePdfSearch } from '../pdf/usePdfSearch'
import { useFindShortcut, useWheelZoom } from '../pdf/usePdfViewerInput'
import { resolveScale, zoomIn, zoomOut, type ZoomMode } from '../pdf/pdfZoom'
import PdfPage from '../pdf/PdfPage'
import PdfSearchBar from '../pdf/PdfSearchBar'
import PdfPageNavigator from '../pdf/PdfPageNavigator'
import PdfZoomControl from '../pdf/PdfZoomControl'

interface PdfViewerProps {
  /** Número de errores de la última compilación (insignia del botón de registro). */
  errorCount?: number
  onToggleLogs?: () => void
  /** Si es true, el registro de compilación reemplaza al PDF en el panel (como en Overleaf). */
  logsOpen?: boolean
  /** Contenido del registro de compilación que se muestra en lugar del PDF. */
  logsPanel?: ReactNode
  documentId: string | null
  documentName?: string
  pdfUrl: string | null
  previousPdfUrl: string | null
  compileStatus: CompileStatus
  compileTimestamp: number
  isCompiling?: boolean
  onCompileRequest?: () => void
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

/** Página que ocupa el tercio superior de la zona visible (la que el usuario está leyendo). */
function findVisiblePage(container: HTMLElement): number {
  const probe = container.scrollTop + container.clientHeight / 3
  const pages = Array.from(container.querySelectorAll<HTMLElement>('.pdfjs-page'))
  const current = pages.findLast((page) => page.offsetTop <= probe)
  return Number(current?.dataset.pageNumber ?? 1)
}

/**
 * Visor del PDF compilado (HU-21) con pdf.js, al estilo de Overleaf:
 * recompilar, registro y descarga; búsqueda de texto; navegación por páginas y zoom.
 */
export function PdfViewer({
  errorCount = 0,
  onToggleLogs,
  logsOpen = false,
  logsPanel,
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
  const viewerRef = useRef<HTMLDivElement | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const containerSize = useElementSize(scrollRef)
  const pageSize = useFirstPageSize(pdf)
  const search = usePdfSearch(pdf)

  const [zoom, setZoom] = useState<ZoomMode>('fit-width')
  const [currentPage, setCurrentPage] = useState(1)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const numPages = pdf?.numPages ?? 0
  const hasPages = Boolean(pdf && pageSize)
  const scale = resolveScale(zoom, pageSize, containerSize)
  const visiblePage = Math.min(Math.max(currentPage, 1), Math.max(numPages, 1))

  const goToPage = useCallback((pageNumber: number, behavior: ScrollBehavior = 'smooth') => {
    const target = scrollRef.current?.querySelector<HTMLElement>(`[data-page-number="${pageNumber}"]`)
    target?.scrollIntoView({ behavior, block: 'start' })
  }, [])

  // Al cambiar de coincidencia, llevar su página a la vista (la página centra el resaltado al dibujarse)
  const activeMatchPage = search.activeMatch?.pageNumber
  useEffect(() => {
    if (activeMatchPage) goToPage(activeMatchPage, 'auto')
  }, [search.activeMatch?.id, activeMatchPage, goToPage])

  const { open: openSearchBar } = search
  const showLogs = logsOpen && Boolean(logsPanel)
  const openSearch = useCallback(() => {
    if (hasPages && !showLogs) openSearchBar()
  }, [hasPages, showLogs, openSearchBar])

  useFindShortcut(viewerRef, openSearch)
  useWheelZoom(scrollRef, (direction) => setZoom(direction === 'in' ? zoomIn(scale) : zoomOut(scale)))

  const handleScroll = () => {
    if (scrollRef.current) setCurrentPage(findVisiblePage(scrollRef.current))
  }

  const handleDownload = async () => {
    if (!documentId) return
    setDownloadError(null)
    try {
      await downloadPdfFile(documentId, `${documentName.replace(/\.tex$/i, '')}.pdf`)
    } catch (err: unknown) {
      setDownloadError(err instanceof Error ? err.message : 'No fue posible descargar el PDF')
    }
  }

  const renderContent = () => {
    if (pdf && pageSize) {
      return Array.from({ length: numPages }, (_, index) => (
        <PdfPage
          key={index + 1}
          pdf={pdf}
          pageNumber={index + 1}
          scale={scale}
          baseSize={pageSize}
          highlights={search.highlightsByPage.get(index + 1)}
        />
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

  return (
    <div className="pdf-viewer-container" ref={viewerRef}>
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
          {showLogs && onToggleLogs && (
            <button type="button" className="pdf-back-btn" onClick={onToggleLogs} title="Volver a la vista previa del PDF">
              Volver al PDF
            </button>
          )}
          {!showLogs && onToggleLogs && (
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
          {!showLogs && (<>
          <button
            type="button"
            className="pdf-logs-btn"
            onClick={() => void handleDownload()}
            disabled={!hasPages}
            title="Descargar PDF"
            aria-label="Descargar PDF"
          >
            <Icon name="download" />
          </button>
          <button
            type="button"
            className={`pdf-logs-btn ${search.isOpen ? 'is-active' : ''}`}
            onClick={search.isOpen ? search.close : openSearch}
            disabled={!hasPages}
            aria-pressed={search.isOpen}
            title="Buscar en el PDF (Ctrl+F)"
            aria-label="Buscar en el PDF"
          >
            <Icon name="search" />
          </button>
          </>)}
        </div>

        {hasPages && !showLogs && (
          <div className="pdf-toolbar-group pdf-nav-group">
            <PdfPageNavigator currentPage={visiblePage} numPages={numPages} onGoToPage={goToPage} />
            <span className="pdf-toolbar-separator" aria-hidden="true" />
            <PdfZoomControl mode={zoom} scale={scale} onChange={setZoom} />
          </div>
        )}
      </div>

      {/* El PDF sigue montado bajo el registro: conserva la posición de lectura, el zoom y sus eventos */}
      <div className="pdf-viewer-body">
      {showLogs && <div className="pdf-logs-overlay">{logsPanel}</div>}
      {search.isOpen && hasPages && !showLogs && (
        <PdfSearchBar
          query={search.query}
          indexing={search.indexing}
          total={search.matches.length}
          activeIndex={search.activeIndex}
          onQueryChange={search.setQuery}
          onNext={search.next}
          onPrevious={search.previous}
          onClose={search.close}
        />
      )}

      {downloadError && (
        <div className="pdf-download-error" role="alert">
          <span>{downloadError}</span>
          <button type="button" onClick={() => setDownloadError(null)} aria-label="Cerrar aviso">
            <Icon name="close" size={14} />
          </button>
        </div>
      )}

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
    </div>
  )
}

export default PdfViewer
