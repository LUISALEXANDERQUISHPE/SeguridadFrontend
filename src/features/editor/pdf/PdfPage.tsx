import { useEffect, useRef, useState } from 'react'
import type { PDFDocumentProxy } from './pdfjs'

interface PdfPageProps {
  pdf: PDFDocumentProxy
  pageNumber: number
  scale: number
  /** Tamaño de la página a escala 1, para reservar su espacio antes de dibujarla. */
  baseSize: { width: number; height: number }
}

/**
 * Una página del PDF dibujada en un canvas nítido (respeta la densidad de píxeles).
 * Solo se dibuja cuando está cerca de la zona visible, para soportar documentos largos.
 */
export function PdfPage({ pdf, pageNumber, scale, baseSize }: Readonly<PdfPageProps>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isNearViewport, setIsNearViewport] = useState(false)

  useEffect(() => {
    const element = containerRef.current
    if (!element) return undefined

    const observer = new IntersectionObserver(
      (entries) => setIsNearViewport(entries.some((entry) => entry.isIntersecting)),
      { rootMargin: '600px 0px' },
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [])

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
        // La cancelación por cambio de zoom o desmontaje es esperada
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          console.warn(`[PDF] No se pudo dibujar la página ${pageNumber}:`, err)
        }
      })

    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [pdf, pageNumber, scale, isNearViewport])

  const width = Math.floor(baseSize.width * scale)
  const height = Math.floor(baseSize.height * scale)

  return (
    <div
      ref={containerRef}
      className="pdfjs-page"
      data-page-number={pageNumber}
      style={{ width: `${width}px`, height: `${height}px` }}
    >
      <canvas ref={canvasRef} style={{ width: `${width}px`, height: `${height}px` }} aria-label={`Página ${pageNumber}`} />
    </div>
  )
}

export default PdfPage
