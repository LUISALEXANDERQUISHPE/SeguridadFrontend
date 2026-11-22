import { useMemo, useState } from 'react'
import type { DiffLine } from '../../../types/version'
import { buildDiffBlocks } from './diffBlocks'

const LINE_SIGNS: Readonly<Record<DiffLine['type'], string>> = {
  equal: ' ',
  added: '+',
  removed: '−',
}

const LINE_LABELS: Readonly<Record<DiffLine['type'], string>> = {
  equal: 'Sin cambios',
  added: 'Línea agregada',
  removed: 'Línea eliminada',
}

/** Clave única de una línea: su tipo y sus números en cada versión no se repiten en una comparación. */
function lineKey(line: DiffLine): string {
  return `${line.type}-${line.oldNumber ?? ''}-${line.newNumber ?? ''}`
}

function DiffRow({ line }: Readonly<{ line: DiffLine }>) {
  return (
    <tr className={`diff-row is-${line.type}`}>
      <td className="diff-number">{line.oldNumber ?? ''}</td>
      <td className="diff-number">{line.newNumber ?? ''}</td>
      <td className="diff-sign" title={LINE_LABELS[line.type]}>
        {LINE_SIGNS[line.type]}
      </td>
      <td className="diff-text">{line.text}</td>
    </tr>
  )
}

interface DiffViewProps {
  lines: readonly DiffLine[]
  /** Texto mostrado cuando no hay ninguna diferencia. */
  emptyMessage: string
}

/**
 * Comparación línea a línea: números de línea anterior y nueva, signo y texto.
 * Las líneas sin cambios lejanas se colapsan y se pueden expandir con un clic.
 */
export function DiffView({ lines, emptyMessage }: Readonly<DiffViewProps>) {
  const blocks = useMemo(() => buildDiffBlocks(lines), [lines])
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())
  const hasChanges = lines.some((line) => line.type !== 'equal')

  const expand = (key: string) => setExpanded((previous) => new Set(previous).add(key))

  return (
    <div className="diff-view">
      {!hasChanges && <p className="diff-empty">{emptyMessage}</p>}
      <table className="diff-table">
        <tbody>
          {blocks.map((block) => {
            if (!block.collapsed || expanded.has(block.key)) {
              return block.lines.map((line) => <DiffRow key={lineKey(line)} line={line} />)
            }
            return (
              <tr key={block.key} className="diff-row is-collapsed">
                <td colSpan={4}>
                  <button type="button" className="diff-expand-btn" onClick={() => expand(block.key)}>
                    ⋯ {block.lines.length} líneas sin cambios (mostrar)
                  </button>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default DiffView
