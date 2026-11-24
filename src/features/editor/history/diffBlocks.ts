import type { DiffLine } from '../../../types/version'

/**
 * Agrupa las líneas de una comparación en bloques visibles y bloques colapsables,
 * mostrando solo el contexto alrededor de cada cambio (como GitHub u Overleaf).
 * Funciones puras: no dependen de React ni del DOM.
 */

export interface DiffBlock {
  /** Identificador estable del bloque (índice de su primera línea). */
  key: string
  /** true si son líneas sin cambios lejanas a cualquier modificación. */
  collapsed: boolean
  lines: DiffLine[]
}

/** Líneas sin cambios que se muestran antes y después de cada modificación. */
export const DEFAULT_CONTEXT_LINES = 3
/** Un tramo sin cambios más corto que esto no se colapsa (no vale la pena ocultarlo). */
const MIN_COLLAPSED_LINES = 4

/** Marca qué líneas quedan a la vista: los cambios y su contexto. */
function visibleLines(lines: readonly DiffLine[], context: number): boolean[] {
  const visible = lines.map((line) => line.type !== 'equal')
  lines.forEach((line, index) => {
    if (line.type === 'equal') return
    const from = Math.max(0, index - context)
    const to = Math.min(lines.length - 1, index + context)
    for (let position = from; position <= to; position += 1) visible[position] = true
  })
  return visible
}

/**
 * @param lines Líneas de la comparación
 * @param context Líneas sin cambios a mostrar alrededor de cada modificación
 */
export function buildDiffBlocks(lines: readonly DiffLine[], context: number = DEFAULT_CONTEXT_LINES): DiffBlock[] {
  const visible = visibleLines(lines, context)
  const blocks: DiffBlock[] = []

  lines.forEach((line, index) => {
    const hidden = !visible[index]
    const current = blocks.at(-1)
    if (current?.collapsed === hidden) {
      current.lines.push(line)
    } else {
      blocks.push({ key: String(index), collapsed: hidden, lines: [line] })
    }
  })

  // Los tramos ocultos demasiado cortos se muestran directamente
  return blocks.map((block) =>
    block.collapsed && block.lines.length < MIN_COLLAPSED_LINES ? { ...block, collapsed: false } : block,
  )
}

/** Muestra el contenido completo como agregado (primera versión de un archivo). */
export function toAddedLines(content: string): DiffLine[] {
  if (!content) return []
  const lines = content.replaceAll('\r\n', '\n').split('\n')
  if (lines.at(-1) === '') lines.pop()
  return lines.map((text, index) => ({ type: 'added', oldNumber: null, newNumber: index + 1, text }))
}

/** Totales de líneas agregadas y eliminadas de una comparación. */
export function countChanges(lines: readonly DiffLine[]): { added: number; removed: number } {
  return {
    added: lines.filter((line) => line.type === 'added').length,
    removed: lines.filter((line) => line.type === 'removed').length,
  }
}
