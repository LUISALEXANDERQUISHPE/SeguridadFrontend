import { useRef, useState, type DragEvent } from 'react'
import Modal from '../../../components/common/Modal'
import Icon from '../../../components/common/Icon'
import { importProjectZip } from '../../../services/projectService'
import type { Project } from '../../../types/project'

/** Mismo límite que el backend (el .zip viaja en base64 dentro del canal cifrado). */
const MAX_ZIP_BYTES = 7 * 1024 * 1024

type Phase = 'idle' | 'reading' | 'processing'

interface ImportZipModalProps {
  onClose: () => void
  /** Proyecto creado: el panel lo agrega a la lista y lo abre. */
  onImported: (project: Project) => void
}

const formatSize = (bytes: number) => `${(bytes / 1024 / 1024).toFixed(1)} MB`

/** Lee el archivo como base64 informando el avance (de 0 a 100). */
function readAsBase64(file: File, onProgress: (percent: number) => void, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    signal.addEventListener('abort', () => reader.abort())
    reader.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100))
    }
    reader.onload = () => {
      onProgress(100)
      resolve(String(reader.result).split(',')[1] || '')
    }
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onabort = () => reject(new DOMException('Cancelado', 'AbortError'))
    reader.readAsDataURL(file)
  })
}

/**
 * HU: Subir un proyecto en .zip (como en Overleaf): botón para elegir el archivo o arrastrarlo.
 * Al arrastrar, el recuadro muestra "Suelta tu archivo aquí"; al subir, la barra "Cargando".
 */
export function ImportZipModal({ onClose, onImported }: Readonly<ImportZipModalProps>) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  // Los eventos dragenter/dragleave se disparan también en los hijos: se cuentan para no parpadear
  const dragDepth = useRef(0)
  const [isDragging, setIsDragging] = useState(false)
  const [phase, setPhase] = useState<Phase>('idle')
  const [progress, setProgress] = useState(0)
  const [fileName, setFileName] = useState('')
  const [error, setError] = useState<string | null>(null)
  const isBusy = phase !== 'idle'

  const upload = async (file: File | undefined) => {
    if (!file || isBusy) return
    setError(null)
    if (!file.name.toLowerCase().endsWith('.zip')) {
      setError('Solo se pueden subir archivos .zip')
      return
    }
    if (file.size === 0) {
      setError('El archivo está vacío')
      return
    }
    if (file.size > MAX_ZIP_BYTES) {
      setError(`El .zip pesa ${formatSize(file.size)}; el máximo es ${formatSize(MAX_ZIP_BYTES)}`)
      return
    }

    const controller = new AbortController()
    abortRef.current = controller
    setFileName(file.name)
    setProgress(0)
    setPhase('reading')
    try {
      const dataBase64 = await readAsBase64(file, setProgress, controller.signal)
      setPhase('processing')
      const project = await importProjectZip(file.name, dataBase64, controller.signal)
      if (controller.signal.aborted) return
      onImported(project)
    } catch (err: unknown) {
      if (controller.signal.aborted) return
      setError(err instanceof Error ? err.message : 'No se pudo importar el proyecto')
      setPhase('idle')
    } finally {
      abortRef.current = null
    }
  }

  const cancelUpload = () => {
    abortRef.current?.abort()
    setPhase('idle')
    setProgress(0)
  }

  const handleDragEnter = (event: DragEvent) => {
    event.preventDefault()
    if (isBusy) return
    dragDepth.current += 1
    setIsDragging(true)
  }

  const handleDragLeave = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setIsDragging(false)
  }

  const handleDrop = (event: DragEvent) => {
    event.preventDefault()
    dragDepth.current = 0
    setIsDragging(false)
    void upload(event.dataTransfer.files?.[0])
  }

  return (
    <Modal title="Subir proyecto en Zip" icon="upload" size="wide" isBusy={phase === 'processing'} onClose={() => { cancelUpload(); onClose() }}>
      {error && <p className="pm-alert pm-alert-error" role="alert">{error}</p>}

      <div className="zip-upload-box">
        <div
          className={`zip-dropzone ${isDragging ? 'is-dragging' : ''}`}
          onDragEnter={handleDragEnter}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {isDragging ? (
            <div className="zip-drop-hint" aria-live="polite">
              <span className="zip-drop-icon" aria-hidden="true">
                <Icon name="upload" size={34} />
              </span>
              <span>Suelta tu archivo aquí</span>
            </div>
          ) : (
            <>
              <button
                type="button"
                className="pm-btn pm-btn-primary zip-select-btn"
                onClick={() => inputRef.current?.click()}
                disabled={isBusy}
                data-autofocus
              >
                Selecciona un archivo .zip
              </button>
              <span className="zip-or">o</span>
              <span className="zip-drag-text">arrastra un archivo .zip</span>
              <span className="zip-limits">Máximo {formatSize(MAX_ZIP_BYTES)}. Debe incluir el .tex principal en la raíz.</span>
            </>
          )}
          <input
            ref={inputRef}
            type="file"
            accept=".zip,application/zip,application/x-zip-compressed"
            hidden
            onChange={(event) => {
              const file = event.target.files?.[0]
              event.target.value = ''
              void upload(file)
            }}
          />
        </div>

        {isBusy && (
          <div className="zip-progress" role="status" aria-live="polite">
            <div className="zip-progress-bar" style={{ width: `${phase === 'processing' ? 100 : progress}%` }} />
            <div className="zip-progress-row">
              <span className="zip-spinner" aria-hidden="true" />
              <span className="zip-progress-text">
                {phase === 'reading' ? `Cargando: ${progress} %` : 'Cargando: 100 % · Creando el proyecto…'}
                <span className="zip-progress-file">{fileName}</span>
              </span>
              {phase === 'reading' && (
                <button type="button" className="zip-cancel-btn" onClick={cancelUpload} aria-label="Cancelar la subida">
                  <Icon name="close" size={14} />
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="pm-dialog-actions">
        <button type="button" className="pm-btn pm-btn-ghost" onClick={() => { cancelUpload(); onClose() }} disabled={phase === 'processing'}>
          Cancelar
        </button>
      </div>
    </Modal>
  )
}

export default ImportZipModal
