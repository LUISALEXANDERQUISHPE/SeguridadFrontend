import type { FileVersion } from '../../../types/version'
import { formatFullDate, formatRelativeDate } from '../../../utils/dateFormat'

interface VersionItemProps {
  version: FileVersion
  isSelected: boolean
  onSelect: (number: number) => void
}

function VersionItem({ version, isSelected, onSelect }: Readonly<VersionItemProps>) {
  const changes = version.changes
  return (
    <li>
      <button
        type="button"
        className={`version-item ${isSelected ? 'is-selected' : ''}`}
        onClick={() => onSelect(version.number)}
        aria-current={isSelected ? 'true' : undefined}
      >
        <span className="version-item-header">
          <strong>Versión {version.number}</strong>
          <time dateTime={version.createdAt} title={formatFullDate(version.createdAt)}>
            {formatRelativeDate(version.createdAt)}
          </time>
        </span>
        {version.summary && <span className="version-item-summary">{version.summary}</span>}
        <span className="version-item-meta">
          <span>{version.author?.name || 'Usuario desconocido'}</span>
          {changes && (
            <span className="version-item-changes">
              <span className="is-added" title="Líneas agregadas">
                +{changes.added}
              </span>
              <span className="is-removed" title="Líneas eliminadas">
                −{changes.removed}
              </span>
            </span>
          )}
        </span>
      </button>
    </li>
  )
}

interface VersionListProps {
  versions: readonly FileVersion[]
  selectedNumber: number | null
  hasUnversionedChanges: boolean
  onSelect: (number: number) => void
}

/** Lista cronológica de versiones (la más reciente arriba). */
export function VersionList({ versions, selectedNumber, hasUnversionedChanges, onSelect }: Readonly<VersionListProps>) {
  return (
    <nav className="version-list" aria-label="Versiones del archivo">
      {hasUnversionedChanges && (
        <p className="version-unsaved-note">Hay cambios posteriores a la última versión guardada.</p>
      )}
      {versions.length === 0 ? (
        <p className="version-empty">
          Todavía no hay versiones. Se crean al guardar con Ctrl+S o con el botón «Guardar versión».
        </p>
      ) : (
        <ol>
          {versions.map((version) => (
            <VersionItem
              key={version.id}
              version={version}
              isSelected={version.number === selectedNumber}
              onSelect={onSelect}
            />
          ))}
        </ol>
      )}
    </nav>
  )
}

export default VersionList
