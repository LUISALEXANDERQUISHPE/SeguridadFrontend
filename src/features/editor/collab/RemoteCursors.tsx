import { useMemo } from 'react'
import type { Collaborator } from './useCollaboration'
import { toLineColumn } from './textSync'

// Métricas del editor (deben coincidir con .editor-textarea en index.css)
const LINE_HEIGHT = 22
const PADDING_TOP = 12
const PADDING_LEFT = 16
const EDITOR_FONT = "13px Consolas, 'Courier New', monospace"
// Una selección remota enorme no debe generar miles de rectángulos
const MAX_SELECTION_LINES = 300

let cachedCharWidth: number | null = null

/** Ancho de un carácter de la fuente monoespaciada del editor. */
function getCharWidth(): number {
  if (cachedCharWidth) return cachedCharWidth
  const context = document.createElement('canvas').getContext('2d')
  if (!context) return 7.2
  context.font = EDITOR_FONT
  cachedCharWidth = context.measureText('M'.repeat(100)).width / 100 || 7.2
  return cachedCharWidth
}

interface RemoteCursorsProps {
  text: string
  collaborators: Collaborator[]
  scrollTop: number
  scrollLeft: number
}

/**
 * Capa con los cursores y selecciones de los demás colaboradores, dibujada entre el texto
 * resaltado y el textarea transparente (no intercepta clics).
 */
export function RemoteCursors({ text, collaborators, scrollTop, scrollLeft }: Readonly<RemoteCursorsProps>) {
  const lines = useMemo(() => text.split('\n'), [text])
  const charWidth = getCharWidth()

  const xOf = (column: number) => PADDING_LEFT + column * charWidth - scrollLeft
  const yOf = (line: number) => PADDING_TOP + line * LINE_HEIGHT - scrollTop

  return (
    <div className="collab-cursors-layer" aria-hidden="true">
      {collaborators.map((user) => {
        if (user.head === null) return null
        const head = toLineColumn(text, user.head)
        const anchor = user.anchor === null ? head : toLineColumn(text, user.anchor)

        const [start, end] =
          anchor.line < head.line || (anchor.line === head.line && anchor.column <= head.column)
            ? [anchor, head]
            : [head, anchor]

        const selection = []
        if (start.line !== end.line || start.column !== end.column) {
          const lastLine = Math.min(end.line, start.line + MAX_SELECTION_LINES)
          for (let line = start.line; line <= lastLine; line++) {
            const from = line === start.line ? start.column : 0
            // Las líneas intermedias se marcan completas (más el salto de línea)
            const to = line === end.line ? end.column : (lines[line]?.length ?? 0) + 1
            if (to <= from) continue
            selection.push(
              <div
                key={line}
                className="collab-selection"
                style={{ top: yOf(line), left: xOf(from), width: (to - from) * charWidth, background: user.color }}
              />,
            )
          }
        }

        return (
          <div key={user.clientId}>
            {selection}
            <div className="collab-caret" style={{ top: yOf(head.line), left: xOf(head.column), borderColor: user.color }}>
              <span className={`collab-caret-label ${head.line === 0 ? 'is-below' : ''}`} style={{ background: user.color }}>
                {user.name}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default RemoteCursors
