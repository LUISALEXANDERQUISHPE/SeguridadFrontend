import { toLineColumn } from './textSync'

/**
 * Métricas del editor de código, compartidas por las capas dibujadas sobre el texto
 * (cursores remotos, fragmentos comentados). Deben coincidir con .editor-textarea en index.css.
 */
export const LINE_HEIGHT = 22
export const PADDING_TOP = 12
export const PADDING_LEFT = 16
const EDITOR_FONT = "13px Consolas, 'Courier New', monospace"

let cachedCharWidth: number | null = null

/** Ancho de un carácter de la fuente monoespaciada del editor. */
export function getCharWidth(): number {
  if (cachedCharWidth) return cachedCharWidth
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return 7.2
  context.font = EDITOR_FONT
  cachedCharWidth = context.measureText('M'.repeat(100)).width / 100 || 7.2
  return cachedCharWidth
}

export interface LineRect {
  key: string
  top: number
  left: number
  width: number
}

/**
 * Rectángulos (uno por línea) que cubren el rango [start, end) del texto, en coordenadas del
 * área de edición ya desplazada. maxLines evita miles de rectángulos para rangos enormes.
 */
export function rangeToRects(
  text: string,
  lines: string[],
  start: number,
  end: number,
  scroll: { top: number; left: number },
  maxLines = 300,
): LineRect[] {
  if (end <= start) return []
  const charWidth = getCharWidth()
  const from = toLineColumn(text, start)
  const to = toLineColumn(text, end)
  const rects: LineRect[] = []
  const lastLine = Math.min(to.line, from.line + maxLines)
  for (let line = from.line; line <= lastLine; line++) {
    const startColumn = line === from.line ? from.column : 0
    // Las líneas intermedias se marcan completas (más el salto de línea)
    const endColumn = line === to.line ? to.column : (lines[line]?.length ?? 0) + 1
    if (endColumn <= startColumn) continue
    rects.push({
      key: `${line}`,
      top: PADDING_TOP + line * LINE_HEIGHT - scroll.top,
      left: PADDING_LEFT + startColumn * charWidth - scroll.left,
      width: (endColumn - startColumn) * charWidth,
    })
  }
  return rects
}
