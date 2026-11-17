import type { BibEntry } from '../../../utils/bibtex'

export interface SuggestionItem {
  label: string
  insertText: string
  cursorOffset?: number
  type: 'command' | 'environment' | 'snippet' | 'citation' | 'file'
  description: string
  detail?: string
}

export interface SuggestionMatch {
  items: SuggestionItem[]
  replaceStart: number
  replaceEnd: number
  type: 'command' | 'environment' | 'citation' | 'file'
}

// Entornos comunes de LaTeX con snippets estructurados
export const ENVIRONMENT_SUGGESTIONS: SuggestionItem[] = [
  {
    label: 'document',
    insertText: 'document}\n\n    \n\\end{document}',
    cursorOffset: 15,
    type: 'snippet',
    description: 'Entorno principal del documento',
  },
  {
    label: 'itemize',
    insertText: 'itemize}\n    \\item \n\\end{itemize}',
    cursorOffset: 19,
    type: 'snippet',
    description: 'Lista con viñetas',
  },
  {
    label: 'enumerate',
    insertText: 'enumerate}\n    \\item \n\\end{enumerate}',
    cursorOffset: 21,
    type: 'snippet',
    description: 'Lista numerada',
  },
  {
    label: 'figure',
    insertText: 'figure}[htbp]\n    \\centering\n    \\includegraphics[width=0.8\\textwidth]{archivo}\n    \\caption{Descripción}\n    \\label{fig:mi_figura}\n\\end{figure}',
    cursorOffset: 77,
    type: 'snippet',
    description: 'Figura con caption y etiqueta',
  },
  {
    label: 'table',
    insertText: 'table}[htbp]\n    \\centering\n    \\begin{tabular}{|c|c|}\n        \\hline\n        Columna 1 & Columna 2 \\\\\n        \\hline\n        Dato 1 & Dato 2 \\\\\n        \\hline\n    \\end{tabular}\n    \\caption{Título de la tabla}\n    \\label{tab:mi_tabla}\n\\end{table}',
    cursorOffset: 110,
    type: 'snippet',
    description: 'Tabla flotante completa',
  },
  {
    label: 'tabular',
    insertText: 'tabular}{|c|c|}\n    \\hline\n     &  \\\\\n    \\hline\n\\end{tabular}',
    cursorOffset: 29,
    type: 'snippet',
    description: 'Tabla estructurada con columnas',
  },
  {
    label: 'equation',
    insertText: 'equation}\n    \n\\end{equation}',
    cursorOffset: 14,
    type: 'snippet',
    description: 'Ecuación matemática numerada',
  },
  {
    label: 'align',
    insertText: 'align}\n    \n\\end{align}',
    cursorOffset: 11,
    type: 'snippet',
    description: 'Ecuaciones matemáticas alineadas',
  },
  {
    label: 'center',
    insertText: 'center}\n    \n\\end{center}',
    cursorOffset: 12,
    type: 'snippet',
    description: 'Bloque centrado',
  },
  {
    label: 'flushleft',
    insertText: 'flushleft}\n    \n\\end{flushleft}',
    cursorOffset: 15,
    type: 'environment',
    description: 'Alineación a la izquierda',
  },
  {
    label: 'flushright',
    insertText: 'flushright}\n    \n\\end{flushright}',
    cursorOffset: 16,
    type: 'environment',
    description: 'Alineación a la derecha',
  },
  {
    label: 'verbatim',
    insertText: 'verbatim}\n    \n\\end{verbatim}',
    cursorOffset: 14,
    type: 'environment',
    description: 'Texto literal o código',
  },
  {
    label: 'quote',
    insertText: 'quote}\n    \n\\end{quote}',
    cursorOffset: 11,
    type: 'environment',
    description: 'Bloque de cita textual',
  },
  {
    label: 'abstract',
    insertText: 'abstract}\n    \n\\end{abstract}',
    cursorOffset: 14,
    type: 'environment',
    description: 'Resumen o abstract',
  },
  {
    label: 'description',
    insertText: 'description}\n    \\item[] \n\\end{description}',
    cursorOffset: 23,
    type: 'snippet',
    description: 'Lista de descripción',
  },
]

// Comandos y snippets frecuentes de LaTeX
export const COMMAND_SUGGESTIONS: SuggestionItem[] = [
  {
    label: '\\begin',
    insertText: '\\begin{}',
    cursorOffset: 7,
    type: 'command',
    description: 'Iniciar un entorno',
  },
  {
    label: '\\begin{document}',
    insertText: '\\begin{document}\n\n    \n\\end{document}',
    cursorOffset: 22,
    type: 'snippet',
    description: 'Estructura principal del documento',
  },
  {
    label: '\\begin{itemize}',
    insertText: '\\begin{itemize}\n    \\item \n\\end{itemize}',
    cursorOffset: 26,
    type: 'snippet',
    description: 'Lista con viñetas',
  },
  {
    label: '\\begin{enumerate}',
    insertText: '\\begin{enumerate}\n    \\item \n\\end{enumerate}',
    cursorOffset: 28,
    type: 'snippet',
    description: 'Lista numerada',
  },
  {
    label: '\\begin{figure}',
    insertText: '\\begin{figure}[htbp]\n    \\centering\n    \\includegraphics[width=0.8\\textwidth]{archivo}\n    \\caption{Descripción}\n    \\label{fig:mi_figura}\n\\end{figure}',
    cursorOffset: 84,
    type: 'snippet',
    description: 'Figura con caption y label',
  },
  {
    label: '\\begin{table}',
    insertText: '\\begin{table}[htbp]\n    \\centering\n    \\begin{tabular}{|c|c|}\n        \\hline\n        Columna 1 & Columna 2 \\\\\n        \\hline\n        Dato 1 & Dato 2 \\\\\n        \\hline\n    \\end{tabular}\n    \\caption{Título}\n    \\label{tab:mi_tabla}\n\\end{table}',
    cursorOffset: 117,
    type: 'snippet',
    description: 'Tabla flotante con columnas',
  },
  {
    label: '\\end',
    insertText: '\\end{}',
    cursorOffset: 5,
    type: 'command',
    description: 'Finalizar un entorno',
  },
  {
    label: '\\documentclass',
    insertText: '\\documentclass[12pt,a4paper]{article}',
    cursorOffset: 37,
    type: 'command',
    description: 'Clase del documento',
  },
  {
    label: '\\usepackage',
    insertText: '\\usepackage{}',
    cursorOffset: 12,
    type: 'command',
    description: 'Importar paquete de LaTeX',
  },
  {
    label: '\\section',
    insertText: '\\section{}',
    cursorOffset: 9,
    type: 'command',
    description: 'Encabezado de sección',
  },
  {
    label: '\\subsection',
    insertText: '\\subsection{}',
    cursorOffset: 12,
    type: 'command',
    description: 'Subsección',
  },
  {
    label: '\\subsubsection',
    insertText: '\\subsubsection{}',
    cursorOffset: 15,
    type: 'command',
    description: 'Sub-subsección',
  },
  {
    label: '\\chapter',
    insertText: '\\chapter{}',
    cursorOffset: 9,
    type: 'command',
    description: 'Capítulo (report/book)',
  },
  {
    label: '\\textbf',
    insertText: '\\textbf{}',
    cursorOffset: 8,
    type: 'command',
    description: 'Texto en negrita',
  },
  {
    label: '\\textit',
    insertText: '\\textit{}',
    cursorOffset: 8,
    type: 'command',
    description: 'Texto en cursiva',
  },
  {
    label: '\\underline',
    insertText: '\\underline{}',
    cursorOffset: 11,
    type: 'command',
    description: 'Texto subrayado',
  },
  {
    label: '\\frac',
    insertText: '\\frac{}{}',
    cursorOffset: 6,
    type: 'command',
    description: 'Fracción matemática',
  },
  {
    label: '\\text',
    insertText: '\\text{}',
    cursorOffset: 6,
    type: 'command',
    description: 'Texto en modo matemático',
  },
  {
    label: '\\label',
    insertText: '\\label{}',
    cursorOffset: 7,
    type: 'command',
    description: 'Etiqueta de referencia cruzada',
  },
  {
    label: '\\ref',
    insertText: '\\ref{}',
    cursorOffset: 5,
    type: 'command',
    description: 'Referencia a etiqueta',
  },
  {
    label: '\\cite',
    insertText: '\\cite{}',
    cursorOffset: 6,
    type: 'command',
    description: 'Cita bibliográfica',
  },
  {
    label: '\\bibliography',
    insertText: '\\bibliographystyle{plain}\n\\bibliography{}',
    cursorOffset: 40,
    type: 'snippet',
    description: 'Bibliografía con bibtex (archivo .bib sin extensión)',
  },
  {
    label: '\\bibliographystyle',
    insertText: '\\bibliographystyle{}',
    cursorOffset: 19,
    type: 'command',
    description: 'Estilo de la bibliografía (plain, unsrt, alpha, apalike...)',
  },
  {
    label: '\\nocite',
    insertText: '\\nocite{*}',
    cursorOffset: 10,
    type: 'command',
    description: 'Incluir referencias sin citarlas ({*} = todas las del .bib)',
  },
  {
    label: '\\addbibresource',
    insertText: '\\addbibresource{}',
    cursorOffset: 16,
    type: 'command',
    description: 'Archivo .bib para biblatex (con extensión, en el preámbulo)',
  },
  {
    label: '\\printbibliography',
    insertText: '\\printbibliography\n',
    cursorOffset: 19,
    type: 'command',
    description: 'Imprimir la bibliografía (biblatex)',
  },
  {
    label: '\\input',
    insertText: '\\input{}',
    cursorOffset: 7,
    type: 'command',
    description: 'Insertar otro archivo .tex del proyecto',
  },
  {
    label: '\\include',
    insertText: '\\include{}',
    cursorOffset: 9,
    type: 'command',
    description: 'Incluir capítulo .tex (en una página nueva)',
  },
  {
    label: '\\item',
    insertText: '\\item ',
    cursorOffset: 6,
    type: 'command',
    description: 'Elemento de lista',
  },
  {
    label: '\\caption',
    insertText: '\\caption{}',
    cursorOffset: 9,
    type: 'command',
    description: 'Leyenda de figura o tabla',
  },
  {
    label: '\\includegraphics',
    insertText: '\\includegraphics[width=0.8\\textwidth]{}',
    cursorOffset: 38,
    type: 'command',
    description: 'Insertar imagen externa',
  },
  {
    label: '\\tableofcontents',
    insertText: '\\tableofcontents\n',
    cursorOffset: 18,
    type: 'command',
    description: 'Índice de contenidos',
  },
  {
    label: '\\newpage',
    insertText: '\\newpage\n',
    cursorOffset: 9,
    type: 'command',
    description: 'Salto de página',
  },
  {
    label: '\\clearpage',
    insertText: '\\clearpage\n',
    cursorOffset: 11,
    type: 'command',
    description: 'Vaciar figuras y salto de página',
  },
  {
    label: '\\title',
    insertText: '\\title{}',
    cursorOffset: 7,
    type: 'command',
    description: 'Título del documento',
  },
  {
    label: '\\author',
    insertText: '\\author{}',
    cursorOffset: 8,
    type: 'command',
    description: 'Autor del documento',
  },
  {
    label: '\\date',
    insertText: '\\date{\\today}',
    cursorOffset: 14,
    type: 'command',
    description: 'Fecha actual',
  },
  {
    label: '\\maketitle',
    insertText: '\\maketitle\n',
    cursorOffset: 11,
    type: 'command',
    description: 'Generar bloque de título',
  },
  {
    label: '\\centering',
    insertText: '\\centering\n',
    cursorOffset: 11,
    type: 'command',
    description: 'Centrar contenido',
  },
  {
    label: '\\hline',
    insertText: '\\hline\n',
    cursorOffset: 7,
    type: 'command',
    description: 'Línea horizontal en tablas',
  },
  {
    label: '\\footnote',
    insertText: '\\footnote{}',
    cursorOffset: 10,
    type: 'command',
    description: 'Nota al pie de página',
  },
  {
    label: '\\geometry',
    insertText: '\\geometry{\n    top=3cm,\n    bottom=2.5cm,\n    left=3cm,\n    right=2.5cm\n}',
    cursorOffset: 74,
    type: 'snippet',
    description: 'Configuración de márgenes',
  },
]

// Comandos de cita de LaTeX, natbib y biblatex: \cite, \citep, \citet, \parencite, \textcite, \autocite...
const CITE_CONTEXT_PATTERN = /\\(?:no)?(?:cite[a-zA-Z]*|[a-zA-Z]*cite[a-zA-Z]*)\*?(?:\[[^\]]*\]){0,2}\{([^{}]*)$/

/**
 * Sugerencias de claves bibliográficas dentro de \cite{...}. Admite varias claves separadas por coma.
 */
function getCitationSuggestions(text: string, caret: number, citations: BibEntry[]): SuggestionMatch | null {
  const citeMatch = text.substring(0, caret).match(CITE_CONTEXT_PATTERN)
  if (!citeMatch) return null

  const keysTyped = citeMatch[1].split(',')
  const prefix = keysTyped[keysTyped.length - 1].trimStart()
  const alreadyCited = new Set(keysTyped.slice(0, -1).map((key) => key.trim()))
  const search = prefix.toLowerCase()

  const items: SuggestionItem[] = citations
    .filter((entry) => !alreadyCited.has(entry.key))
    .filter((entry) => !search
      || entry.key.toLowerCase().includes(search)
      || entry.title?.toLowerCase().includes(search)
      || entry.author?.toLowerCase().includes(search))
    .sort((left, right) => Number(!left.key.toLowerCase().startsWith(search)) - Number(!right.key.toLowerCase().startsWith(search)))
    .map((entry) => ({
      label: entry.key,
      insertText: entry.key,
      type: 'citation',
      description: [entry.author?.split(/\s+and\s+/i)[0], entry.year && `(${entry.year})`, entry.title && `— ${entry.title}`].filter(Boolean).join(' ') || entry.source,
      detail: entry.source,
    }))

  if (items.length === 0) {
    items.push({
      label: citations.length === 0 ? 'Sin referencias' : 'Sin coincidencias',
      insertText: prefix,
      type: 'citation',
      description: citations.length === 0
        ? 'Agrega entradas a un archivo .bib del proyecto (ej. @article{clave, ...})'
        : `Ninguna entrada de los .bib coincide con "${prefix}"`,
    })
  }

  return { items, replaceStart: caret - prefix.length, replaceEnd: caret, type: 'citation' }
}

const BIBTEX_STYLES = [
  ['plain', 'Numérico, ordenado por autor'],
  ['unsrt', 'Numérico, en orden de aparición'],
  ['alpha', 'Etiquetas tipo [Lam94]'],
  ['abbrv', 'Como plain con nombres abreviados'],
  ['ieeetr', 'Estilo IEEE'],
  ['apalike', 'Autor-año (similar a APA)'],
  ['acm', 'Estilo ACM'],
  ['siam', 'Estilo SIAM'],
]

// Comandos cuyo argumento es un archivo del proyecto y cómo se escribe su ruta
const FILE_COMMANDS: Array<{ pattern: RegExp; extensions: string[]; keepExtension: boolean; multiple?: boolean; hint: string }> = [
  { pattern: /\\bibliography\{([^{}]*)$/, extensions: ['bib'], keepExtension: false, multiple: true, hint: 'bibtex: ruta sin la extensión .bib' },
  { pattern: /\\addbibresource(?:\[[^\]]*\])?\{([^{}]*)$/, extensions: ['bib'], keepExtension: true, hint: 'biblatex: ruta con la extensión .bib' },
  { pattern: /\\includegraphics\*?(?:\[[^\]]*\])?\{([^{}]*)$/, extensions: ['png', 'jpg', 'jpeg', 'pdf', 'eps'], keepExtension: true, hint: 'Imagen del proyecto' },
  { pattern: /\\(?:input|include|subfile)\{([^{}]*)$/, extensions: ['tex'], keepExtension: false, hint: 'Archivo .tex (ruta sin extensión)' },
]

/**
 * Sugerencias de rutas de archivos del proyecto dentro de \bibliography{...}, \includegraphics{...}, etc.
 * y de estilos dentro de \bibliographystyle{...}
 */
function getFileSuggestions(text: string, caret: number, projectFiles: string[]): SuggestionMatch | null {
  const textBeforeCaret = text.substring(0, caret)

  const styleMatch = textBeforeCaret.match(/\\bibliographystyle\{([^{}]*)$/)
  if (styleMatch) {
    const prefix = styleMatch[1].toLowerCase()
    const projectStyles = projectFiles.filter((file) => /\.bst$/i.test(file)).map((file) => [file.replace(/\.bst$/i, ''), 'Estilo .bst del proyecto'])
    const items: SuggestionItem[] = [...projectStyles, ...BIBTEX_STYLES]
      .filter(([style]) => style.toLowerCase().includes(prefix))
      .map(([style, description]) => ({ label: style, insertText: style, type: 'file', description }))
    return items.length ? { items, replaceStart: caret - styleMatch[1].length, replaceEnd: caret, type: 'file' } : null
  }

  for (const command of FILE_COMMANDS) {
    const match = textBeforeCaret.match(command.pattern)
    if (!match) continue
    const typed = command.multiple ? match[1].split(',').pop() || '' : match[1]
    const prefix = typed.trimStart()
    const search = prefix.toLowerCase()
    const items: SuggestionItem[] = projectFiles
      .filter((file) => command.extensions.includes(file.split('.').pop()?.toLowerCase() || ''))
      .map((file) => (command.keepExtension ? file : file.replace(/\.[^./]+$/, '')))
      .filter((reference) => !search || reference.toLowerCase().includes(search))
      .map((reference) => ({
        label: reference,
        insertText: reference,
        type: 'file',
        description: /\s/.test(reference) ? '⚠ El nombre tiene espacios: renómbralo para que LaTeX lo encuentre' : command.hint,
      }))
    if (items.length === 0) {
      items.push({
        label: 'Sin archivos',
        insertText: prefix,
        type: 'file',
        description: `No hay archivos .${command.extensions.join('/.')} en el proyecto${search ? ` que coincidan con "${prefix}"` : ''}`,
      })
    }
    return { items, replaceStart: caret - prefix.length, replaceEnd: caret, type: 'file' }
  }

  return null
}

/**
 * Analiza el contexto de escritura alrededor del cursor para obtener sugerencias activas.
 */
export function getSuggestionsForContext(
  text: string,
  caret: number,
  citations: BibEntry[] = [],
  projectFiles: string[] = []
): SuggestionMatch | null {
  const textBeforeCaret = text.substring(0, caret)

  // 0. Dentro de \cite{...}: claves de los archivos .bib del proyecto
  const citationMatch = getCitationSuggestions(text, caret, citations)
  if (citationMatch) return citationMatch

  // 0b. Dentro de \bibliography{...}, \includegraphics{...}, \input{...}: archivos del proyecto
  const fileMatch = getFileSuggestions(text, caret, projectFiles)
  if (fileMatch) return fileMatch

  // 1. Detectar si el usuario está escribiendo un entorno: \begin{... o \end{...
  const envMatch = textBeforeCaret.match(/\\(begin|end)\{([a-zA-Z0-9*]*)$/)
  if (envMatch) {
    const isBegin = envMatch[1] === 'begin'
    const prefix = envMatch[2].toLowerCase()
    const replaceStart = caret - prefix.length
    const replaceEnd = text[caret] === '}' ? caret + 1 : caret

    let items = ENVIRONMENT_SUGGESTIONS
    if (prefix) {
      items = items.filter((item) => item.label.toLowerCase().startsWith(prefix))
    }

    if (!isBegin) {
      items = items.map((item) => ({
        ...item,
        insertText: `${item.label}}`,
        cursorOffset: item.label.length + 1,
        type: 'environment',
        description: `Cerrar entorno ${item.label}`,
      }))
    }

    return {
      items,
      replaceStart,
      replaceEnd,
      type: 'environment',
    }
  }

  // 2. Detectar si el usuario está escribiendo un comando iniciado con \
  const cmdMatch = textBeforeCaret.match(/\\([a-zA-Z]*)$/)
  if (cmdMatch) {
    const prefix = cmdMatch[1].toLowerCase()
    const replaceStart = caret - prefix.length - 1 // Incluye el backslash
    const replaceEnd = caret

    let items = COMMAND_SUGGESTIONS
    if (prefix) {
      items = items.filter((item) => {
        const clean = item.label.replace(/^\\/, '').toLowerCase()
        return clean.startsWith(prefix)
      })
    }

    return {
      items,
      replaceStart,
      replaceEnd,
      type: 'command',
    }
  }

  return null
}

