import DropdownMenu, { type DropdownMenuItem } from '../../../components/common/DropdownMenu'
import Icon from '../../../components/common/Icon'
import type { SaveStatus } from '../../../types/document'
import { FORMATTING_ACTIONS, type FormattingAction } from '../utils/latexFormatting'
import { LAYOUT_LABELS, type EditorLayout } from '../types'
import SaveStatusBadge from './SaveStatusBadge'

export interface IdeMenuActions {
  onBack: () => void
  onSave: () => void
  onDownloadSource: () => void
  onDownloadPdf: () => void
  onFind: () => void
  onInsert: (action: FormattingAction) => void
  onToggleSidePanel: () => void
  onToggleConsole: () => void
  onLayoutChange: (layout: EditorLayout) => void
}

interface IdeMenuBarProps {
  projectName: string
  saveStatus: SaveStatus
  lastSavedAt: string | null
  layout: EditorLayout
  isSidePanelOpen: boolean
  isConsoleOpen: boolean
  actions: IdeMenuActions
}

const LAYOUT_ORDER: readonly EditorLayout[] = ['split', 'editor', 'pdf']

/** Barra superior del editor: menús, nombre del proyecto, estado de guardado y diseño. */
export function IdeMenuBar({
  projectName,
  saveStatus,
  lastSavedAt,
  layout,
  isSidePanelOpen,
  isConsoleOpen,
  actions,
}: Readonly<IdeMenuBarProps>) {
  const fileItems: DropdownMenuItem[] = [
    { id: 'save', label: 'Guardar y compilar', shortcut: 'Ctrl+S', onSelect: actions.onSave },
    { id: 'download-tex', label: 'Descargar código fuente (.tex)', onSelect: actions.onDownloadSource },
    { id: 'download-pdf', label: 'Descargar PDF', onSelect: actions.onDownloadPdf },
    { id: 'back', label: 'Volver a mis proyectos', onSelect: actions.onBack },
  ]

  const editItems: DropdownMenuItem[] = [
    { id: 'find', label: 'Buscar y reemplazar', shortcut: 'Ctrl+F', onSelect: actions.onFind },
  ]

  const insertItems: DropdownMenuItem[] = FORMATTING_ACTIONS.filter((action) => action.group !== 'text').map(
    (action) => ({ id: action.id, label: action.label, onSelect: () => actions.onInsert(action) }),
  )

  const formatItems: DropdownMenuItem[] = FORMATTING_ACTIONS.filter((action) => action.group === 'text').map(
    (action) => ({ id: action.id, label: action.label, onSelect: () => actions.onInsert(action) }),
  )

  const viewItems: DropdownMenuItem[] = [
    { id: 'files', label: 'Panel de archivos', checked: isSidePanelOpen, onSelect: actions.onToggleSidePanel },
    { id: 'logs', label: 'Registro de compilación', checked: isConsoleOpen, onSelect: actions.onToggleConsole },
  ]

  const layoutItems: DropdownMenuItem[] = LAYOUT_ORDER.map((option) => ({
    id: option,
    label: LAYOUT_LABELS[option],
    checked: layout === option,
    onSelect: () => actions.onLayoutChange(option),
  }))

  return (
    <header className="ide-menubar">
      <div className="ide-menubar-left">
        <button
          type="button"
          className="ide-home-btn"
          onClick={actions.onBack}
          title="Volver a mis proyectos"
          aria-label="Volver a mis proyectos"
        >
          <Icon name="home" size={18} />
        </button>
        <nav className="ide-menus" aria-label="Menú del editor">
          <DropdownMenu label="Archivo" items={fileItems} />
          <DropdownMenu label="Editar" items={editItems} />
          <DropdownMenu label="Insertar" items={insertItems} />
          <DropdownMenu label="Formato" items={formatItems} />
          <DropdownMenu label="Ver" items={viewItems} />
        </nav>
      </div>

      <h1 className="ide-project-title" title={projectName}>
        {projectName}
      </h1>

      <div className="ide-menubar-right">
        <SaveStatusBadge status={saveStatus} lastSavedAt={lastSavedAt} />
        <DropdownMenu
          align="right"
          triggerClassName="ide-menu-trigger ide-menu-trigger-strong"
          items={layoutItems}
          label={
            <>
              <Icon name="columns" /> Diseño
            </>
          }
        />
      </div>
    </header>
  )
}

export default IdeMenuBar
