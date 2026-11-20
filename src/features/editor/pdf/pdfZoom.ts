/** Zoom del visor: un ajuste automático o una escala fija (1 = 100 %). */
export type ZoomMode = 'fit-width' | 'fit-page' | number

export interface Size {
  width: number
  height: number
}

export const MIN_SCALE = 0.25
export const MAX_SCALE = 4
const ZOOM_STEP = 1.2
/** Margen alrededor de la página (padding del contenedor). */
const PAGE_MARGIN_PX = 32

export const ZOOM_PRESETS: ReadonlyArray<{ value: ZoomMode; label: string }> = [
  { value: 'fit-width', label: 'Ajustar al ancho' },
  { value: 'fit-page', label: 'Ajustar a la página' },
  { value: 0.5, label: '50 %' },
  { value: 0.75, label: '75 %' },
  { value: 1, label: '100 %' },
  { value: 1.25, label: '125 %' },
  { value: 1.5, label: '150 %' },
  { value: 2, label: '200 %' },
  { value: 3, label: '300 %' },
]

export function clampScale(scale: number): number {
  return Math.min(MAX_SCALE, Math.max(MIN_SCALE, scale))
}

/**
 * Escala real a aplicar según el modo de zoom, el tamaño de la página (a escala 1)
 * y el espacio disponible en el panel.
 */
export function resolveScale(mode: ZoomMode, page: Size | null, container: Size): number {
  if (typeof mode === 'number') return clampScale(mode)
  if (!page || container.width <= 0) return 1

  const widthScale = (container.width - PAGE_MARGIN_PX) / page.width
  if (mode === 'fit-width') return clampScale(widthScale)

  const heightScale = (container.height - PAGE_MARGIN_PX) / page.height
  return clampScale(Math.min(widthScale, heightScale))
}

export function zoomIn(scale: number): number {
  return clampScale(scale * ZOOM_STEP)
}

export function zoomOut(scale: number): number {
  return clampScale(scale / ZOOM_STEP)
}

/** Valor del selector de zoom (los modos automáticos se identifican por su nombre). */
export function toZoomKey(mode: ZoomMode): string {
  return String(mode)
}

export function fromZoomKey(key: string): ZoomMode {
  if (key === 'fit-width' || key === 'fit-page') return key
  return clampScale(Number(key))
}
