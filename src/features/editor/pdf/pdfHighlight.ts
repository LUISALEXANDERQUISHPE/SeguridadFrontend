import type { MatchSegment } from './pdfTextSearch'

const MATCH_CLASS = 'pdfjs-match'
const ACTIVE_CLASS = 'is-active'

interface HighlightedText {
  fragment: DocumentFragment
  firstActive: HTMLElement | null
}

function groupByItem(segments: readonly MatchSegment[]): Map<number, MatchSegment[]> {
  const byItem = new Map<number, MatchSegment[]>()
  for (const segment of segments) {
    const list = byItem.get(segment.itemIndex) ?? []
    list.push(segment)
    byItem.set(segment.itemIndex, list)
  }
  for (const list of byItem.values()) list.sort((a, b) => a.start - b.start)
  return byItem
}

function isSameSegment(a: MatchSegment, b: MatchSegment): boolean {
  return a.itemIndex === b.itemIndex && a.start === b.start && a.end === b.end
}

function createMark(text: string, active: boolean): HTMLElement {
  const mark = document.createElement('mark')
  mark.className = active ? `${MATCH_CLASS} ${ACTIVE_CLASS}` : MATCH_CLASS
  mark.textContent = text
  return mark
}

/**
 * Construye el contenido de un fragmento de texto con sus coincidencias envueltas en <mark>.
 * Usa nodos de texto (nunca innerHTML), por lo que el contenido del PDF no puede inyectar HTML.
 */
function buildHighlightedText(
  text: string,
  segments: readonly MatchSegment[],
  activeSegments: readonly MatchSegment[],
): HighlightedText {
  const fragment = document.createDocumentFragment()
  let firstActive: HTMLElement | null = null
  let cursor = 0

  for (const segment of segments) {
    if (segment.start > cursor) fragment.append(text.slice(cursor, segment.start))
    const active = activeSegments.some((candidate) => isSameSegment(candidate, segment))
    const mark = createMark(text.slice(segment.start, segment.end), active)
    if (active) firstActive ??= mark
    fragment.append(mark)
    cursor = Math.max(cursor, segment.end)
  }
  if (cursor < text.length) fragment.append(text.slice(cursor))

  return { fragment, firstActive }
}

/** Devuelve a su texto original los fragmentos resaltados en la llamada anterior. */
function restoreText(textDivs: readonly HTMLElement[], texts: readonly string[], highlighted: Set<number>) {
  for (const itemIndex of highlighted) {
    const div = textDivs[itemIndex]
    if (div) div.textContent = texts[itemIndex] ?? ''
  }
  highlighted.clear()
}

/**
 * Resalta las coincidencias dentro de los elementos de la capa de texto de una página.
 *
 * @param textDivs Elementos de la capa de texto (uno por fragmento)
 * @param texts Texto original de cada fragmento, para restaurarlo antes de resaltar
 * @param segments Coincidencias de la página
 * @param activeSegments Partes de la coincidencia activa
 * @param highlighted Fragmentos modificados en la llamada anterior (se actualiza)
 * @returns El primer resaltado de la coincidencia activa, para desplazarse hasta él
 */
export function applyHighlights(
  textDivs: readonly HTMLElement[],
  texts: readonly string[],
  segments: readonly MatchSegment[],
  activeSegments: readonly MatchSegment[],
  highlighted: Set<number>,
): HTMLElement | null {
  restoreText(textDivs, texts, highlighted)

  let firstActive: HTMLElement | null = null
  for (const [itemIndex, itemSegments] of groupByItem(segments)) {
    const div = textDivs[itemIndex]
    const text = texts[itemIndex]
    if (div && text !== undefined) {
      const result = buildHighlightedText(text, itemSegments, activeSegments)
      div.replaceChildren(result.fragment)
      highlighted.add(itemIndex)
      firstActive ??= result.firstActive
    }
  }
  return firstActive
}
