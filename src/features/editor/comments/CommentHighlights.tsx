import { useMemo } from 'react'
import { LINE_HEIGHT, rangeToRects } from '../collab/editorMetrics'

export interface CommentRange {
  id: string
  start: number
  end: number
  isActive: boolean
}

interface CommentHighlightsProps {
  text: string
  ranges: CommentRange[]
  scrollTop: number
  scrollLeft: number
}

/**
 * HU-25: Capa que resalta los fragmentos comentados (como el subrayado amarillo de Overleaf).
 * Se dibuja bajo el textarea transparente y no intercepta clics.
 */
export function CommentHighlights({ text, ranges, scrollTop, scrollLeft }: Readonly<CommentHighlightsProps>) {
  const lines = useMemo(() => text.split('\n'), [text])
  return (
    <div className="comment-highlights-layer" aria-hidden="true">
      {ranges.map((range) =>
        rangeToRects(text, lines, range.start, range.end, { top: scrollTop, left: scrollLeft }).map((rect) => (
          <div
            key={`${range.id}-${rect.key}`}
            className={`comment-highlight ${range.isActive ? 'is-active' : ''}`}
            style={{ top: rect.top, left: rect.left, width: rect.width, height: LINE_HEIGHT }}
          />
        )),
      )}
    </div>
  )
}

export default CommentHighlights
