import { useEffect, useRef, useState, type CSSProperties, type RefObject } from 'react'
import { TextLayer, type PDFDocumentProxy } from '../../../lib/pdfjs'
import type { PageHighlights } from './usePdfSearch'
import type { Size } from './pdfZoom'
import { applyHighlights } from './pdfHighlight'

interface PdfPageProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  /** Tamaño de la página a escala 1, para reservar su espacio antes de dibujarla. */
  baseSize: Size
  highlights?: PageHighlights
}

interface RenderedTextLayer {
  divs: HTMLElement[]
  texts: string[]
}

const EMPTY_HIGHLIGHTS: PageHighlights = { segments: [], activeSegments: [] }

function isCancellation(err: unknown): boolean {
  const name = (err as { name?: string } | null)?.name
  return name === 'RenderingCancelledException' || name === 'AbortException'
}

/** Indica si la página está cerca de la zona visible (se dibuja solo entonces). */
function useNearViewport(ref: RefObject<HTMLElement | null>): boolean {
  const [isNear, setIsNear] = useState(false)

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new IntersectionObserver((entries) => setIsNear(entries.some((entry) => entry.isIntersecting)), {
      rootMargin: '600px 0px',
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return isNear
}

/**
 * Una página del PDF: imagen nítida en canvas (respeta la densidad de píxeles) y,
 * encima, la capa de texto transparente que permite seleccionar, copiar y resaltar búsquedas.
 * Solo se dibuja cuando está cerca de la zona visible, para soportar documentos largos.
 */
export function PdfPage({ pdf, pageNumber, scale, baseSize, highlights = EMPTY_HIGHLIGHTS }: Readonly<PdfPageProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const textLayerRef = useRef<HTMLDivElement | null>(null)
  const highlightedItemsRef = useRef<Set<number>>(new Set())
  // Última coincidencia activa a la que se desplazó la vista (evita saltos al volver a dibujar)
  const scrolledToRef = useRef<PageHighlights['activeSegments'] | null>(null)
  const [textLayer, setTextLayer] = useState<RenderedTextLayer | null>(null)
  const isNearViewport = useNearViewport(containerRef)

  // 1. Imagen de la página
  useEffect(() => {
    if (!isNearViewport) return undefined
    let cancelled = false
    let cancelRender: (() => void) | null = null

    pdf
      .getPage(pageNumber)
      .then((page) => {
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (cancelled || !canvas || !context) return undefined

        const viewport = page.getViewport({ scale })
        const pixelRatio = globalThis.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)

        const task = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        })
        cancelRender = () => task.cancel()
        return task.promise
      })
      .catch((err: unknown) => {
        if (!isCancellation(err)) console.warn(`[PDF] No se pudo dibujar la página ${pageNumber}:`, err)
      })

    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [pdf, pageNumber, scale, isNearViewport])

  // 2. Capa de texto (seleccionable y buscable)
  useEffect(() => {
    const container = textLayerRef.current
    if (!isNearViewport || !container) return undefined
    let layer: TextLayer | null = null
    let cancelled = false

    pdf
      .getPage(pageNumber)
      .then(async (page) => {
        if (cancelled) return
        const textContent = await page.getTextContent()
        if (cancelled) return
        container.replaceChildren()
        highlightedItemsRef.current.clear()
        layer = new TextLayer({ textContentSource: textContent, container, viewport: page.getViewport({ scale }) })
        await layer.render()
        if (!cancelled) setTextLayer({ divs: layer.textDivs, texts: layer.textContentItemsStr })
      })
      .catch((err: unknown) => {
        if (!isCancellation(err)) console.warn(`[PDF] No se pudo preparar el texto de la página ${pageNumber}:`, err)
      })

    return () => {
      cancelled = true
      layer?.cancel()
    }
  }, [pdf, pageNumber, scale, isNearViewport])

  // 3. Resaltado de la búsqueda; centra en pantalla la coincidencia activa
  useEffect(() => {
    if (!textLayer) return
    const active = applyHighlights(
      textLayer.divs,
      textLayer.texts,
      highlights.segments,
      highlights.activeSegments,
      highlightedItemsRef.current,
    )
    if (active && scrolledToRef.current !== highlights.activeSegments) {
      scrolledToRef.current = highlights.activeSegments
      active.scrollIntoView({ block: 'center', inline: 'nearest' })
    }
  }, [textLayer, highlights])

  const width = Math.floor(baseSize.width * scale)
  const height = Math.floor(baseSize.height * scale)
  const pageStyle = { width: `${width}px`, height: `${height}px`, '--scale-factor': scale } as CSSProperties

  return (
    <div ref={containerRef} className="pdfjs-page" data-page-number={pageNumber} style={pageStyle}>
      <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} aria-hidden="true" />
      <div ref={textLayerRef} className="pdfjs-text-layer" />
    </div>
  )
}

export default PdfPage
