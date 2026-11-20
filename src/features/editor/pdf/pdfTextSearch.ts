/**
 * Búsqueda de texto dentro del PDF (funciones puras, sin dependencias de pdf.js ni del DOM).
 *
 * pdf.js divide el texto de cada página en "items" (fragmentos posicionados). Para buscar
 * frases que cruzan fragmentos, se unen los items de la página y cada coincidencia se traduce
 * de vuelta a los fragmentos que ocupa, para poder resaltarla sobre la capa de texto.
 */

/** Texto de una página tal como lo entrega pdf.js. */
export interface PageText {
  pageNumber: number
  /** Texto de cada fragmento, en el mismo orden que los elementos de la capa de texto. */
  items: readonly string[]
  /** true si el fragmento termina una línea (se separa del siguiente con un espacio). */
  endsLine: readonly boolean[]
}

/** Porción de una coincidencia dentro de un fragmento: [start, end) en su texto. */
export interface MatchSegment {
  itemIndex: number
  start: number
  end: number
}

export interface SearchMatch {
  /** Identificador estable: "página-posición". */
  id: string
  pageNumber: number
  segments: MatchSegment[]
}

/** Límite de coincidencias para que una búsqueda muy genérica no bloquee la interfaz. */
export const MAX_MATCHES = 1000

const LINE_SEPARATOR = ' '

/**
 * Acentos "sueltos" que pdflatex emite como un carácter aparte cuando el documento no usa
 * \usepackage[T1]{fontenc} (ej. "Introducci´on"). Se ignoran al buscar.
 */
const SPACING_ACCENTS = new Set(['´', '`', '¨', 'ˆ', '˜', '¸', '˘', '˙', '˚', '˝', 'ˇ', '¯'])
const COMBINING_MARK = /\p{M}/u

/** Letras sin punto que LaTeX usa para poner acentos sobre la i y la j (ej. "aqu´ı"). */
const DOTLESS_LETTERS: Readonly<Record<string, string>> = { 'ı': 'i', 'ȷ': 'j' }

/** Texto normalizado y, para cada carácter, el rango que ocupa en el texto original. */
export interface NormalizedText {
  text: string
  starts: number[]
  ends: number[]
}

/**
 * Forma de búsqueda de un carácter: sin tilde, en minúsculas y con las ligaduras separadas.
 * Devuelve '' para los acentos sueltos, que no cuentan al buscar.
 */
function normalizeChar(char: string): string {
  if (SPACING_ACCENTS.has(char)) return ''
  const decomposed = (DOTLESS_LETTERS[char] ?? char).normalize('NFKD')
  return [...decomposed]
    .filter((piece) => !COMBINING_MARK.test(piece))
    .join('')
    .toLowerCase()
}

/**
 * Normaliza para buscar sin distinguir mayúsculas, tildes ni ligaduras ("ﬁ" -> "fi"),
 * guardando de qué posición del texto original proviene cada carácter resultante.
 */
export function normalizeWithMap(text: string): NormalizedText {
  let normalized = ''
  const starts: number[] = []
  const ends: number[] = []
  let offset = 0

  for (const char of text) {
    const start = offset
    offset += char.length
    const replacement = normalizeChar(char)
    normalized += replacement
    // Cada unidad del resultado apunta al carácter original del que proviene
    for (let unit = 0; unit < replacement.length; unit += 1) {
      starts.push(start)
      ends.push(offset)
    }
  }
  return { text: normalized, starts, ends }
}

interface JoinedPage {
  text: string
  /** Posición donde empieza cada fragmento dentro del texto unido. */
  itemStarts: number[]
}

function joinPage(page: PageText): JoinedPage {
  const itemStarts: number[] = []
  let text = ''
  page.items.forEach((item, index) => {
    itemStarts.push(text.length)
    text += item
    if (page.endsLine[index]) text += LINE_SEPARATOR
  })
  return { text, itemStarts }
}

/** Traduce el rango [from, to) del texto unido a los fragmentos que lo contienen. */
function toSegments(page: PageText, itemStarts: readonly number[], from: number, to: number): MatchSegment[] {
  const segments: MatchSegment[] = []
  page.items.forEach((item, itemIndex) => {
    const itemStart = itemStarts[itemIndex]
    const start = Math.max(from, itemStart) - itemStart
    const end = Math.min(to, itemStart + item.length) - itemStart
    if (end > start) segments.push({ itemIndex, start, end })
  })
  return segments
}

/**
 * Busca todas las apariciones de la consulta en las páginas, en orden de lectura.
 * Ignora mayúsculas, tildes y espacios al inicio o al final de la consulta.
 */
export function findMatches(pages: readonly PageText[], query: string): SearchMatch[] {
  const needle = normalizeWithMap(query.trim()).text
  if (!needle) return []

  const matches: SearchMatch[] = []
  for (const page of pages) {
    const { text, itemStarts } = joinPage(page)
    const haystack = normalizeWithMap(text)

    let position = haystack.text.indexOf(needle)
    while (position !== -1 && matches.length < MAX_MATCHES) {
      // Rango equivalente en el texto original (incluye acentos sueltos intermedios)
      const from = haystack.starts[position]
      const to = haystack.ends[position + needle.length - 1]
      const segments = toSegments(page, itemStarts, from, to)
      if (segments.length > 0) {
        matches.push({ id: `${page.pageNumber}-${from}`, pageNumber: page.pageNumber, segments })
      }
      position = haystack.text.indexOf(needle, position + needle.length)
    }
  }
  return matches
}
