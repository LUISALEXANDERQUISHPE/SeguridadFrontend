import { Fragment } from 'react'
import Icon from '../../../components/common/Icon'
import { FORMATTING_ACTIONS, type FormattingAction } from '../utils/latexFormatting'

interface FormattingToolbarProps {
  onFormat: (action: FormattingAction) => void
  onFind: () => void
}

/** Barra de formato sobre el código: negrita, secciones, listas, figuras, tablas, etc. */
export function FormattingToolbar({ onFormat, onFind }: Readonly<FormattingToolbarProps>) {
  return (
    <div className="ide-format-bar" role="toolbar" aria-label="Formato del documento">
      {FORMATTING_ACTIONS.map((action, index) => {
        const startsGroup = index > 0 && FORMATTING_ACTIONS[index - 1].group !== action.group
        return (
          <Fragment key={action.id}>
            {startsGroup && <span className="ide-format-divider" aria-hidden="true" />}
            <button
              type="button"
              className={`ide-format-btn format-${action.id}`}
              onClick={() => onFormat(action)}
              title={action.label}
              aria-label={action.label}
            >
              {'icon' in action.display ? <Icon name={action.display.icon} /> : action.display.text}
            </button>
          </Fragment>
        )
      })}
      <button
        type="button"
        className="ide-format-btn ide-format-search"
        onClick={onFind}
        title="Buscar y reemplazar (Ctrl+F)"
        aria-label="Buscar y reemplazar"
      >
        <Icon name="search" />
      </button>
    </div>
  )
}

export default FormattingToolbar
