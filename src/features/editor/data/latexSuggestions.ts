export interface SuggestionItem {
  label: string
  insertText: string
  cursorOffset?: number
  type: 'command' | 'environment' | 'snippet'
  description: string
  detail?: string
}

export interface SuggestionMatch {
  items: SuggestionItem[]
  replaceStart: number
  replaceEnd: number
  type: 'command' | 'environment'
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

/**
 * Analiza el contexto de escritura alrededor del cursor para obtener sugerencias activas.
 */
export function getSuggestionsForContext(
  text: string,
  caret: number
): SuggestionMatch | null {
  const textBeforeCaret = text.substring(0, caret)

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

