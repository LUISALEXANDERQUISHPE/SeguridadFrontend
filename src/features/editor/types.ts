/** Distribución de paneles del editor ("Layout" en Overleaf). */
export type EditorLayout = 'split' | 'editor' | 'pdf'

export const LAYOUT_LABELS: Readonly<Record<EditorLayout, string>> = {
  split: 'Editor y PDF',
  editor: 'Solo editor',
  pdf: 'Solo PDF',
}
