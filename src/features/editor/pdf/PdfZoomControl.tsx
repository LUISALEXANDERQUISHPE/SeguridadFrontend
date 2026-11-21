import { MAX_SCALE, MIN_SCALE, ZOOM_PRESETS, fromZoomKey, toZoomKey, zoomIn, zoomOut, type ZoomMode } from './pdfZoom'

interface PdfZoomControlProps {
  mode: ZoomMode
  /** Escala efectiva (resuelta), para mostrar el porcentaje real en los ajustes automáticos. */
  scale: number
  onChange: (mode: ZoomMode) => void
}

const CUSTOM_KEY = 'custom'

/** − / selector de zoom (ajustes y porcentajes) / +. */
export function PdfZoomControl({ mode, scale, onChange }: Readonly<PdfZoomControlProps>) {
  const currentKey = toZoomKey(mode)
  const isPreset = ZOOM_PRESETS.some((preset) => toZoomKey(preset.value) === currentKey)
  const percent = `${Math.round(scale * 100)} %`

  return (
    <div className="pdf-zoom-control">
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={() => onChange(zoomOut(scale))}
        disabled={scale <= MIN_SCALE}
        aria-label="Reducir zoom"
        title="Reducir zoom (Ctrl + rueda)"
      >
        −
      </button>
      <select
        className="pdf-zoom-select"
        value={isPreset ? currentKey : CUSTOM_KEY}
        onChange={(event) => onChange(fromZoomKey(event.target.value))}
        aria-label="Nivel de zoom"
      >
        {!isPreset && <option value={CUSTOM_KEY}>{percent}</option>}
        {ZOOM_PRESETS.map((preset) => (
          <option key={toZoomKey(preset.value)} value={toZoomKey(preset.value)}>
            {typeof preset.value === 'number' ? preset.label : `${preset.label} (${percent})`}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="pdf-logs-btn"
        onClick={() => onChange(zoomIn(scale))}
        disabled={scale >= MAX_SCALE}
        aria-label="Aumentar zoom"
        title="Aumentar zoom (Ctrl + rueda)"
      >
        +
      </button>
    </div>
  )
}

export default PdfZoomControl
