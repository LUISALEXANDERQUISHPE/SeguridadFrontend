export interface BibEntry {
  key: string
  type: string
  title?: string
  author?: string
  year?: string
  // Ruta del archivo .bib de donde proviene (ej. "bib/referencias.bib")
  source: string
}

// Tipos que no son referencias citables
const NON_CITABLE = new Set(['comment', 'string', 'preamble'])

function readField(body: string, field: string): string | undefined {
  const match = body.match(new RegExp(`(?:^|[,\\s])${field}\\s*=\\s*(?:\\{((?:[^{}]|\\{[^{}]*\\})*)\\}|"([^"]*)"|(\\w+))`, 'i'))
  const value = match?.[1] ?? match?.[2] ?? match?.[3]
  return value?.replace(/[{}]/g, '').replace(/\s+/g, ' ').trim() || undefined
}

/**
 * Extrae las entradas citables de un archivo .bib (clave, tipo, título, autor y año)
 */
export function parseBibEntries(content: string, source: string): BibEntry[] {
  const entries: BibEntry[] = []
  const pattern = /@(\w+)\s*[{(]\s*([^,\s{}()]+)\s*,/g
  const starts: Array<{ index: number; type: string; key: string; bodyStart: number }> = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(content)) !== null) {
    starts.push({ index: match.index, type: match[1].toLowerCase(), key: match[2], bodyStart: pattern.lastIndex })
  }
  starts.forEach((start, position) => {
    if (NON_CITABLE.has(start.type)) return
    const body = content.slice(start.bodyStart, starts[position + 1]?.index ?? content.length)
    entries.push({
      key: start.key,
      type: start.type,
      title: readField(body, 'title'),
      author: readField(body, 'author'),
      year: readField(body, 'year') || readField(body, 'date')?.slice(0, 4),
      source,
    })
  })
  return entries
}
