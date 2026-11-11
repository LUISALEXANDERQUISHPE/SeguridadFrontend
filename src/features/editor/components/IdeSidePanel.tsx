import { useState, type ReactNode } from 'react'
import Icon from '../../../components/common/Icon'
import type { OutlineItem } from '../utils/latexOutline'

interface CollapsibleSectionProps {
  title: string
  className: string
  children: ReactNode
}

function CollapsibleSection({ title, className, children }: Readonly<CollapsibleSectionProps>) {
  const [isOpen, setIsOpen] = useState(true)

  return (
    <section className={`ide-side-section ${className} ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="ide-side-heading"
        onClick={() => setIsOpen((prev) => !prev)}
        aria-expanded={isOpen}
      >
        <Icon name={isOpen ? 'chevronDown' : 'chevronRight'} size={14} />
        {title}
      </button>
      {isOpen && <div className="ide-side-content">{children}</div>}
    </section>
  )
}

interface IdeSidePanelProps {
  fileName: string
  outline: readonly OutlineItem[]
  activeLine: number | null
  onOutlineSelect: (line: number) => void
}

/** Panel lateral con el árbol de archivos y el esquema navegable del documento. */
export function IdeSidePanel({ fileName, outline, activeLine, onOutlineSelect }: Readonly<IdeSidePanelProps>) {
  return (
    <aside className="ide-side-panel" aria-label="Archivos del proyecto">
      <CollapsibleSection title="Árbol de archivos" className="ide-file-tree">
        <ul className="ide-tree-list">
          <li>
            <span className="ide-tree-item is-active" title={`${fileName} (archivo principal)`}>
              <Icon name="file" size={15} />
              <span className="ide-tree-name">{fileName}</span>
            </span>
          </li>
        </ul>
      </CollapsibleSection>

      <CollapsibleSection title="Esquema del archivo" className="ide-outline">
        {outline.length === 0 ? (
          <p className="ide-side-empty">Agrega \section{'{...}'} para ver el esquema del documento.</p>
        ) : (
          <ul className="ide-outline-list">
            {outline.map((item) => (
              <li key={`${item.line}-${item.title}`}>
                <button
                  type="button"
                  className={`ide-outline-item ${activeLine === item.line ? 'is-active' : ''}`}
                  style={{ paddingLeft: `${12 + item.level * 14}px` }}
                  onClick={() => onOutlineSelect(item.line)}
                  title={`Ir a la línea ${item.line}`}
                >
                  {item.title}
                </button>
              </li>
            ))}
          </ul>
        )}
      </CollapsibleSection>
    </aside>
  )
}

export default IdeSidePanel
