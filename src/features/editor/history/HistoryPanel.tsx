import { useState } from 'react'
import Icon from '../../../components/common/Icon'
import { ConfirmModal } from '../../projects/components/ProjectModals'
import DiffView from './DiffView'
import VersionList from './VersionList'
import SaveVersionModal from './SaveVersionModal'
import { countChanges } from './diffBlocks'
import { useVersionHistory, type CompareMode } from './useVersionHistory'

const MODE_OPTIONS: ReadonlyArray<{ value: CompareMode; label: string }> = [
  { value: 'changes', label: 'Cambios de esta versión' },
  { value: 'vs-current', label: 'Comparar con la actual' },
]

interface HistoryPanelProps {
  documentId: string
  fileName: string
  /** Propietario o editor: puede guardar y restaurar versiones. */
  canEdit: boolean
  onClose: () => void
  beforeChange: () => Promise<void>
  onRestored: (content: string) => void
}

type PanelDialog = { type: 'save' } | { type: 'restore'; number: number } | null

/**
 * Historial de versiones de un archivo (HU-23): lista de versiones, comparación línea a línea,
 * guardado de versiones con descripción y restauración.
 */
export function HistoryPanel({ documentId, fileName, canEdit, onClose, beforeChange, onRestored }: Readonly<HistoryPanelProps>) {
  const history = useVersionHistory(documentId, { beforeChange, onRestored })
  const [dialog, setDialog] = useState<PanelDialog>(null)

  const { selected, page } = history
  const isLatest = selected !== null && selected.number === page?.versions[0]?.number
  // Restaurar la última versión solo tiene sentido si el archivo cambió después de ella
  const canRestoreSelected = canEdit && selected !== null && (!isLatest || Boolean(page?.hasUnversionedChanges))
  const stats = countChanges(history.diffLines)

  const renderComparison = () => {
    if (history.loadingList) return <p className="history-status">Cargando historial...</p>
    if (history.listError) return <p className="history-status is-error" role="alert">{history.listError}</p>
    if (!selected) return <p className="history-status">Selecciona una versión para ver sus cambios.</p>
    if (history.diffError) return <p className="history-status is-error" role="alert">{history.diffError}</p>
    if (history.loadingDiff) return <p className="history-status">Comparando...</p>

    const emptyMessage =
      history.mode === 'vs-current'
        ? 'Esta versión es igual al contenido actual del archivo.'
        : 'Esta versión no tuvo cambios de contenido.'
    return <DiffView lines={history.diffLines} emptyMessage={emptyMessage} />
  }

  return (
    <section className="history-panel" aria-label="Historial de versiones">
      <header className="history-header">
        <div className="history-title">
          <Icon name="history" />
          <h2>Historial de versiones</h2>
          <span className="history-file">{fileName}</span>
        </div>
        <div className="history-actions">
          {canEdit && (
            <button type="button" className="pdf-recompile-btn" onClick={() => setDialog({ type: 'save' })}>
              Guardar versión
            </button>
          )}
          <button type="button" className="history-close-btn" onClick={onClose}>
            <Icon name="close" /> Volver al editor
          </button>
        </div>
      </header>

      <div className="history-body">
        <div className="history-diff">
          {selected && (
            <div className="history-diff-toolbar">
              <fieldset className="history-mode">
                <legend className="pm-sr-only">Qué comparar</legend>
                {MODE_OPTIONS.map((option) => (
                  <button
                    key={option.value}
                    type="button"
                    className={history.mode === option.value ? 'is-active' : ''}
                    aria-pressed={history.mode === option.value}
                    onClick={() => history.setMode(option.value)}
                  >
                    {option.label}
                  </button>
                ))}
              </fieldset>
              <span className="history-stats">
                <span className="is-added">+{stats.added}</span>
                <span className="is-removed">−{stats.removed}</span>
              </span>
              {canRestoreSelected && (
                <button
                  type="button"
                  className="history-restore-btn"
                  onClick={() => setDialog({ type: 'restore', number: selected.number })}
                >
                  <Icon name="restore" /> Restaurar versión {selected.number}
                </button>
              )}
            </div>
          )}
          {renderComparison()}
        </div>

        <VersionList
          versions={page?.versions ?? []}
          selectedNumber={selected?.number ?? null}
          hasUnversionedChanges={Boolean(page?.hasUnversionedChanges)}
          onSelect={history.selectVersion}
        />
      </div>

      {dialog?.type === 'save' && <SaveVersionModal onClose={() => setDialog(null)} onSave={history.saveVersion} />}
      {dialog?.type === 'restore' && (
        <ConfirmModal
          title={`Restaurar versión ${dialog.number}`}
          icon="restore"
          message={`El contenido de ${fileName} volverá al de la versión ${dialog.number}. No se pierde nada: los cambios actuales quedan guardados como versión antes de restaurar y podrás volver a ellos desde el historial.`}
          confirmLabel="Restaurar"
          confirmingLabel="Restaurando..."
          onClose={() => setDialog(null)}
          onConfirm={() => history.restore(dialog.number)}
        />
      )}
    </section>
  )
}

export default HistoryPanel
