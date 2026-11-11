import Icon from '../../../components/common/Icon'

interface IdeRailProps {
  isSidePanelOpen: boolean
  isConsoleOpen: boolean
  errorCount: number
  onToggleSidePanel: () => void
  onFind: () => void
  onToggleConsole: () => void
}

/** Riel vertical de accesos rápidos a la izquierda del editor. */
export function IdeRail({
  isSidePanelOpen,
  isConsoleOpen,
  errorCount,
  onToggleSidePanel,
  onFind,
  onToggleConsole,
}: Readonly<IdeRailProps>) {
  return (
    <nav className="ide-rail" aria-label="Paneles del editor">
      <button
        type="button"
        className={`ide-rail-btn ${isSidePanelOpen ? 'is-active' : ''}`}
        onClick={onToggleSidePanel}
        aria-pressed={isSidePanelOpen}
        title="Árbol de archivos"
        aria-label="Árbol de archivos"
      >
        <Icon name="file" size={18} />
      </button>
      <button type="button" className="ide-rail-btn" onClick={onFind} title="Buscar y reemplazar" aria-label="Buscar y reemplazar">
        <Icon name="search" size={18} />
      </button>
      <button
        type="button"
        className={`ide-rail-btn ${isConsoleOpen ? 'is-active' : ''}`}
        onClick={onToggleConsole}
        aria-pressed={isConsoleOpen}
        title="Registro de compilación"
        aria-label={`Registro de compilación (${errorCount} errores)`}
      >
        <Icon name="terminal" size={18} />
        {errorCount > 0 && <span className="ide-rail-badge">{errorCount}</span>}
      </button>
    </nav>
  )
}

export default IdeRail
