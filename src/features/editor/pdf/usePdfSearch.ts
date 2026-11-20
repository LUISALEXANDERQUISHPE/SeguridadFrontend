import { useCallback, useEffect, useMemo, useState } from 'react'
import type { PDFDocumentProxy } from './pdfjs'
import { findMatches, type MatchSegment, type PageText, type SearchMatch } from './pdfTextSearch'

/** Resaltados que debe dibujar una página: todas sus coincidencias y la activa. */
export interface PageHighlights {
  segments: MatchSegment[]
  activeSegments: MatchSegment[]
}

interface TextItemLike {
  str?: string
  hasEOL?: boolean
}

/** Convierte el contenido de texto de pdf.js al formato de búsqueda (solo fragmentos con texto). */
function toPageText(pageNumber: number, items: readonly TextItemLike[]): PageText {
  const textItems = items.filter((item): item is Required<TextItemLike> => typeof item.str === 'string')
  return {
    pageNumber,
    items: textItems.map((item) => item.str),
    endsLine: textItems.map((item) => Boolean(item.hasEOL)),
  }
}

async function extractPages(pdf: PDFDocumentProxy): Promise<PageText[]> {
  const pages: PageText[] = []
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber)
    const content = await page.getTextContent()
    pages.push(toPageText(pageNumber, content.items as TextItemLike[]))
  }
  return pages
}

/** Texto de todas las páginas; se extrae una sola vez por documento y solo cuando se necesita. */
function usePdfTextIndex(pdf: PDFDocumentProxy | null, enabled: boolean) {
  const [index, setIndex] = useState<{ pdf: PDFDocumentProxy; pages: PageText[] } | null>(null)
  const isReady = index?.pdf === pdf

  useEffect(() => {
    if (!pdf || !enabled || isReady) return undefined
    let isCurrent = true
    extractPages(pdf)
      .then((pages) => {
        if (isCurrent) setIndex({ pdf, pages })
      })
      .catch((err: unknown) => console.warn('[PDF] No se pudo extraer el texto para la búsqueda:', err))
    return () => {
      isCurrent = false
    }
  }, [pdf, enabled, isReady])

  return {
    pages: isReady ? index.pages : [],
    indexing: Boolean(pdf && enabled && !isReady),
  }
}

function groupByPage(matches: readonly SearchMatch[], activeMatch: SearchMatch | null): Map<number, PageHighlights> {
  const byPage = new Map<number, PageHighlights>()
  for (const match of matches) {
    const entry = byPage.get(match.pageNumber) ?? { segments: [], activeSegments: [] }
    entry.segments.push(...match.segments)
    if (match === activeMatch) entry.activeSegments.push(...match.segments)
    byPage.set(match.pageNumber, entry)
  }
  return byPage
}

export interface UsePdfSearchResult {
  isOpen: boolean
  query: string
  indexing: boolean
  matches: SearchMatch[]
  activeIndex: number
  activeMatch: SearchMatch | null
  highlightsByPage: Map<number, PageHighlights>
  open: () => void
  close: () => void
  setQuery: (query: string) => void
  next: () => void
  previous: () => void
}

/** Búsqueda de texto en el PDF con navegación entre coincidencias. */
export function usePdfSearch(pdf: PDFDocumentProxy | null): UsePdfSearchResult {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQueryState] = useState('')
  const [activeIndex, setActiveIndex] = useState(0)

  const { pages, indexing } = usePdfTextIndex(pdf, isOpen)
  const matches = useMemo(() => (isOpen ? findMatches(pages, query) : []), [isOpen, pages, query])

  const safeIndex = matches.length > 0 ? Math.min(activeIndex, matches.length - 1) : -1
  const activeMatch = safeIndex >= 0 ? matches[safeIndex] : null
  const highlightsByPage = useMemo(() => groupByPage(matches, activeMatch), [matches, activeMatch])

  const setQuery = useCallback((value: string) => {
    setQueryState(value)
    setActiveIndex(0)
  }, [])

  const open = useCallback(() => setIsOpen(true), [])

  const close = useCallback(() => {
    setIsOpen(false)
    setQueryState('')
    setActiveIndex(0)
  }, [])

  const total = matches.length
  const next = useCallback(() => {
    if (total > 0) setActiveIndex((current) => (Math.min(current, total - 1) + 1) % total)
  }, [total])

  const previous = useCallback(() => {
    if (total > 0) setActiveIndex((current) => (Math.min(current, total - 1) - 1 + total) % total)
  }, [total])

  return {
    isOpen,
    query,
    indexing,
    matches,
    activeIndex: safeIndex,
    activeMatch,
    highlightsByPage,
    open,
    close,
    setQuery,
    next,
    previous,
  }
}
