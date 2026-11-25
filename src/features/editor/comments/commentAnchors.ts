/**
 * HU-25: Ubicación de un comentario en el texto actual.
 *
 * El comentario guarda la posición (inicio/fin) y el texto citado al momento de crearlo.
 * Si después se edita el documento, las posiciones se desplazan: entonces se busca el texto
 * citado y se elige la aparición más cercana a la posición original (como hace Overleaf al
 * seguir los rangos comentados). Si el texto citado ya no existe, el comentario queda "suelto".
 */
export type AnchorStatus = 'exact' | 'moved' | 'lost'

export interface ResolvedAnchor {
  start: number
  end: number
  status: AnchorStatus
}

export interface AnchorSource {
  selection: { start: number | null; end: number | null }
  quotedText: string | null
}

/** Todas las apariciones de "needle" en "text" (sin solapamiento innecesario: avanza 1 carácter). */
function occurrences(text: string, needle: string): number[] {
  const found: number[] = []
  let index = text.indexOf(needle)
  while (index !== -1 && found.length < 1000) {
    found.push(index)
    index = text.indexOf(needle, index + 1)
  }
  return found
}

export function resolveAnchor(text: string, source: AnchorSource): ResolvedAnchor {
  const start = source.selection.start ?? 0
  const end = source.selection.end ?? start
  const quote = source.quotedText

  // Sin cita (comentarios antiguos): se usa la posición, acotada al texto actual
  if (!quote) {
    const safeStart = Math.min(Math.max(0, start), text.length)
    const safeEnd = Math.min(Math.max(safeStart, end), text.length)
    return { start: safeStart, end: safeEnd, status: safeEnd > safeStart ? 'exact' : 'lost' }
  }

  // La cita puede estar truncada (máx. 500): basta con que el texto empiece igual en esa posición
  if (text.startsWith(quote, start)) {
    return { start, end: Math.min(Math.max(end, start + quote.length), text.length), status: 'exact' }
  }

  const candidates = occurrences(text, quote)
  if (candidates.length === 0) {
    const safe = Math.min(Math.max(0, start), text.length)
    return { start: safe, end: safe, status: 'lost' }
  }

  const nearest = candidates.reduce((best, candidate) => (Math.abs(candidate - start) < Math.abs(best - start) ? candidate : best))
  const length = Math.max(end - start, quote.length)
  return { start: nearest, end: Math.min(nearest + length, text.length), status: 'moved' }
}

/** Hilo (de los visibles) cuya zona comentada contiene la posición del cursor. */
export function findThreadAt<T extends { id: string }>(
  anchors: Array<{ thread: T; anchor: ResolvedAnchor }>,
  position: number,
): T | null {
  const hit = anchors.find(({ anchor }) => anchor.status !== 'lost' && position >= anchor.start && position <= anchor.end)
  return hit ? hit.thread : null
}
