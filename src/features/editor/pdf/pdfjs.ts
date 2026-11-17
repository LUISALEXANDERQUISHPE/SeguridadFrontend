import { GlobalWorkerOptions, getDocument, type PDFDocumentProxy } from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url'

// El análisis del PDF se ejecuta en un Web Worker para no bloquear la interfaz
GlobalWorkerOptions.workerSrc = workerUrl

/** Abre un PDF a partir de su contenido binario. */
export async function openPdf(blob: Blob): Promise<PDFDocumentProxy> {
  const data = new Uint8Array(await blob.arrayBuffer())
  return getDocument({ data }).promise
}

export type { PDFDocumentProxy, PDFPageProxy } from 'pdfjs-dist'
