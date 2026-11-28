import { useEffect, useRef, useState } from 'react'
import { getTemplatePreview } from '../../../services/templateService'
import { openPdf } from '../../../lib/pdfjs'

type ThumbnailState = 'loading' | 'ready' | 'error'

interface TemplateThumbnailProps {
  templateId: string
  /** Ancho en píxeles con que se dibuja la primera página. */
  width: number
  label: string
  /** Recibe la cantidad de páginas del PDF de ejemplo. */
  onPageCount?: (pages: number) => void
}

/**
 * Primera página real de la plantilla, dibujada con pdf.js a partir de su vista previa en PDF.
 * Se dibuja nítida en pantallas de alta densidad y libera la memoria de pdf.js al terminar.
 */
export function TemplateThumbnail({ templateId, width, label, onPageCount }: Readonly<TemplateThumbnailProps>) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [state, setState] = useState<{ id: string; status: ThumbnailState }>({ id: '', status: 'loading' })
  const onPageCountRef = useRef(onPageCount)

  useEffect(() => {
    onPageCountRef.current = onPageCount
  }, [onPageCount])

  useEffect(() => {
    let cancelled = false
    let cancelRender: (() => void) | null = null

    const draw = async () => {
      const pdf = await openPdf(await getTemplatePreview(templateId))
      try {
        onPageCountRef.current?.(pdf.numPages)
        const page = await pdf.getPage(1)
        const canvas = canvasRef.current
        const context = canvas?.getContext('2d')
        if (cancelled || !canvas || !context) return

        const viewport = page.getViewport({ scale: width / page.getViewport({ scale: 1 }).width })
        const pixelRatio = globalThis.devicePixelRatio || 1
        canvas.width = Math.floor(viewport.width * pixelRatio)
        canvas.height = Math.floor(viewport.height * pixelRatio)

        const task = page.render({
          canvasContext: context,
          viewport,
          transform: pixelRatio === 1 ? undefined : [pixelRatio, 0, 0, pixelRatio, 0, 0],
        })
        cancelRender = () => task.cancel()
        await task.promise
      } finally {
        void pdf.destroy()
      }
    }

    draw()
      .then(() => {
        if (!cancelled) setState({ id: templateId, status: 'ready' })
      })
      .catch(() => {
        if (!cancelled) setState({ id: templateId, status: 'error' })
      })

    return () => {
      cancelled = true
      cancelRender?.()
    }
  }, [templateId, width])

  const status = state.id === templateId ? state.status : 'loading'

  return (
    <div className={`tpl-thumbnail is-${status}`} style={{ width }}>
      <canvas ref={canvasRef} style={{ width }} role="img" aria-label={`Vista previa de ${label}`} />
      {status === 'loading' && <span className="tpl-thumbnail-status">Cargando vista previa...</span>}
      {status === 'error' && <span className="tpl-thumbnail-status">Vista previa no disponible</span>}
    </div>
  )
}

export default TemplateThumbnail
