import { useEffect, useState } from 'react'
import type { CompileStatus } from '../../../types/document'
import { getPdfBlob } from '../../../services/documentService'
import { openPdf, type PDFDocumentProxy } from './pdfjs'

interface UsePdfDocumentParams {
  documentId: string | null
  pdfUrl: string | null
  previousPdfUrl: string | null
  compileStatus: CompileStatus
  compileTimestamp: number
}

interface LoadedPdf {
  key: string
  pdf: PDFDocumentProxy | null
}

export interface UsePdfDocumentResult {
  pdf: PDFDocumentProxy | null
  loading: boolean
}

/**
 * Descarga y abre el PDF compilado del documento.
 * - No pide el PDF mientras se compila ni cuando la compilación falló.
 * - Si la compilación falló, conserva el PDF anterior solo cuando realmente existe.
 */
export function usePdfDocument({
  documentId,
  pdfUrl,
  previousPdfUrl,
  compileStatus,
  compileTimestamp,
}: UsePdfDocumentParams): UsePdfDocumentResult {
  const [loaded, setLoaded] = useState<LoadedPdf>({ key: '', pdf: null })

  const canFetch = Boolean(documentId && pdfUrl) && compileStatus !== 'failed' && compileStatus !== 'compiling'
  const requestKey = canFetch ? `${documentId}|${pdfUrl}|${compileTimestamp}` : ''

  useEffect(() => {
    if (!requestKey || !documentId) return undefined

    let isCurrent = true
    getPdfBlob(documentId)
      .then(openPdf)
      .then((pdf) => {
        if (isCurrent) {
          setLoaded({ key: requestKey, pdf })
        } else {
          void pdf.destroy()
        }
      })
      .catch((err: unknown) => {
        console.warn('[PDF] Error al cargar el archivo PDF:', err)
        if (isCurrent) setLoaded({ key: requestKey, pdf: null })
      })

    return () => {
      isCurrent = false
    }
  }, [requestKey, documentId])

  // Liberar la memoria del documento anterior cuando se reemplaza o al desmontar
  useEffect(() => {
    const current = loaded.pdf
    return () => {
      void current?.destroy()
    }
  }, [loaded.pdf])

  const hasValidSource = Boolean(previousPdfUrl) || canFetch || compileStatus === 'compiling'

  return {
    pdf: hasValidSource ? loaded.pdf : null,
    loading: canFetch && loaded.key !== requestKey,
  }
}
