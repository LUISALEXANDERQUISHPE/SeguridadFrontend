import type { IconName } from '../../../components/common/Icon'

/**
 * Acciones de la barra de formato del editor.
 * Cada acción envuelve el texto seleccionado con "before" y "after";
 * si no hay selección se inserta "placeholder" seleccionado para que el usuario lo reemplace.
 * Agregar un botón nuevo solo requiere añadir una entrada aquí (abierto a extensión).
 */
export interface FormattingAction {
  id: string
  label: string
  /** Contenido del botón: un ícono SVG o un texto corto. */
  display: { icon: IconName } | { text: string }
  before: string
  after: string
  placeholder: string
  /** Grupo visual en la barra (se separan con un divisor). */
  group: 'text' | 'structure' | 'insert'
}

export const FORMATTING_ACTIONS: readonly FormattingAction[] = [
  { id: 'bold', label: 'Negrita', display: { text: 'B' }, before: String.raw`\textbf{`, after: '}', placeholder: 'texto', group: 'text' },
  { id: 'italic', label: 'Cursiva', display: { text: 'I' }, before: String.raw`\textit{`, after: '}', placeholder: 'texto', group: 'text' },
  { id: 'section', label: 'Sección', display: { text: 'H1' }, before: String.raw`\section{`, after: '}', placeholder: 'Título', group: 'structure' },
  { id: 'subsection', label: 'Subsección', display: { text: 'H2' }, before: String.raw`\subsection{`, after: '}', placeholder: 'Título', group: 'structure' },
  {
    id: 'itemize',
    label: 'Lista con viñetas',
    display: { icon: 'list' },
    before: String.raw`\begin{itemize}` + '\n  ' + String.raw`\item `,
    after: '\n' + String.raw`\end{itemize}`,
    placeholder: 'Elemento',
    group: 'structure',
  },
  {
    id: 'enumerate',
    label: 'Lista numerada',
    display: { icon: 'listOrdered' },
    before: String.raw`\begin{enumerate}` + '\n  ' + String.raw`\item `,
    after: '\n' + String.raw`\end{enumerate}`,
    placeholder: 'Elemento',
    group: 'structure',
  },
  { id: 'math', label: 'Fórmula matemática', display: { text: 'Σ' }, before: '$', after: '$', placeholder: 'x^2', group: 'insert' },
  { id: 'link', label: 'Enlace', display: { icon: 'link' }, before: String.raw`\href{https://}{`, after: '}', placeholder: 'texto', group: 'insert' },
  { id: 'ref', label: 'Referencia cruzada', display: { text: 'ref' }, before: String.raw`\ref{`, after: '}', placeholder: 'etiqueta', group: 'insert' },
  { id: 'cite', label: 'Cita bibliográfica', display: { text: 'cite' }, before: String.raw`\cite{`, after: '}', placeholder: 'clave', group: 'insert' },
  {
    id: 'figure',
    label: 'Figura',
    display: { icon: 'image' },
    before:
      String.raw`\begin{figure}[h]` + '\n  ' + String.raw`\centering` + '\n  ' + String.raw`\includegraphics[width=0.8\linewidth]{`,
    after: '}\n  ' + String.raw`\caption{Descripción}` + '\n  ' + String.raw`\label{fig:etiqueta}` + '\n' + String.raw`\end{figure}`,
    placeholder: 'imagen.png',
    group: 'insert',
  },
  {
    id: 'table',
    label: 'Tabla',
    display: { icon: 'table' },
    before:
      String.raw`\begin{table}[h]` + '\n  ' + String.raw`\centering` + '\n  ' + String.raw`\begin{tabular}{|c|c|}` + '\n    ' + String.raw`\hline` + '\n    ',
    after:
      String.raw` & Columna 2 \\` + '\n    ' + String.raw`\hline` + '\n  ' + String.raw`\end{tabular}` + '\n  ' + String.raw`\caption{Descripción}` + '\n' + String.raw`\end{table}`,
    placeholder: 'Columna 1',
    group: 'insert',
  },
]

export interface TextEdit {
  value: string
  selectionStart: number
  selectionEnd: number
}

/** Aplica una acción de formato sobre el texto y devuelve el nuevo contenido y la selección resultante. */
export function applyFormatting(
  value: string,
  selectionStart: number,
  selectionEnd: number,
  action: Pick<FormattingAction, 'before' | 'after' | 'placeholder'>,
): TextEdit {
  const selected = value.slice(selectionStart, selectionEnd)
  const inner = selected || action.placeholder
  const start = selectionStart + action.before.length

  return {
    value: value.slice(0, selectionStart) + action.before + inner + action.after + value.slice(selectionEnd),
    selectionStart: start,
    selectionEnd: start + inner.length,
  }
}
