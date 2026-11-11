/** Entrada del esquema del documento ("File outline" en Overleaf). */
export interface OutlineItem {
  title: string
  line: number
  level: number
}

const SECTION_LEVELS: Readonly<Record<string, number>> = {
  part: 0,
  chapter: 1,
  section: 2,
  subsection: 3,
  subsubsection: 4,
  paragraph: 5,
}

// \section{Título}, \section*{Título} o \section[corto]{Título}
const SECTION_PATTERN = /^\s*\\(part|chapter|section|subsection|subsubsection|paragraph)\*?(?:\[[^\]]*\])?\{([^}]*)\}/

/** Quita el comentario de una línea LaTeX (todo lo que sigue a un % no escapado). */
function stripComment(line: string): string {
  const match = /(^|[^\\])%/.exec(line)
  return match ? line.slice(0, match.index + match[1].length) : line
}

/**
 * Extrae las secciones del código LaTeX para construir el esquema navegable.
 * Los niveles se normalizan para que el más alto del documento quede en 0.
 */
export function parseOutline(content: string): OutlineItem[] {
  const items: OutlineItem[] = []

  content.split('\n').forEach((rawLine, index) => {
    const match = SECTION_PATTERN.exec(stripComment(rawLine))
    if (!match) return

    const title = match[2].trim()
    if (title) {
      items.push({ title, line: index + 1, level: SECTION_LEVELS[match[1]] })
    }
  })

  const minLevel = Math.min(...items.map((item) => item.level))
  return items.map((item) => ({ ...item, level: item.level - minLevel }))
}
