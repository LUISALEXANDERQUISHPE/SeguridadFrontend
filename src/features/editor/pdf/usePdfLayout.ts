import { useEffect, useState, type RefObject } from 'react'
import type { PDFDocumentProxy } from '../../../lib/pdfjs'
import type { Size } from './pdfZoom'

/** Tamaño disponible de un elemento, actualizado al redimensionar los paneles. */
export function useElementSize(ref: RefObject<HTMLElement | null>): Size {
  const [size, setSize] = useState<Size>({ width: 0, height: 0 })

  useEffect(() => {
    const element = ref.current
    if (!element) return undefined
    const observer = new ResizeObserver(([entry]) =>
      setSize({ width: entry.contentRect.width, height: entry.contentRect.height }),
    )
    observer.observe(element)
    return () => observer.disconnect()
  }, [ref])

  return size
}

/** Tamaño (a escala 1) de la primera página, usado para los ajustes automáticos de zoom. */
export function useFirstPageSize(pdf: PDFDocumentProxy | null): Size | null {
  const [loaded, setLoaded] = useState<{ pdf: PDFDocumentProxy; size: Size } | null>(null)

  useEffect(() => {
    if (!pdf) return undefined
    let isCurrent = true
    pdf
      .getPage(1)
      .then((page) => {
        const { width, height } = page.getViewport({ scale: 1 })
        if (isCurrent) setLoaded({ pdf, size: { width, height } })
      })
      .catch((err: unknown) => console.warn('[PDF] No se pudo leer la primera página:', err))
    return () => {
      isCurrent = false
    }
  }, [pdf])

  return loaded?.pdf === pdf ? loaded.size : null
}
