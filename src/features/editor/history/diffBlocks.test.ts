import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildDiffBlocks, countChanges, toAddedLines } from './diffBlocks.ts'
import type { DiffLine } from '../../../types/version.ts'

function equal(count: number, start = 1): DiffLine[] {
  return Array.from({ length: count }, (_, index) => ({
    type: 'equal',
    oldNumber: start + index,
    newNumber: start + index,
    text: `línea ${start + index}`,
  }))
}

const ADDED: DiffLine = { type: 'added', oldNumber: null, newNumber: 11, text: 'nueva' }
const REMOVED: DiffLine = { type: 'removed', oldNumber: 11, newNumber: null, text: 'vieja' }

describe('buildDiffBlocks', () => {
  it('colapsa las líneas sin cambios lejanas y deja 3 de contexto alrededor del cambio', () => {
    const lines = [...equal(10), ADDED, ...equal(10, 12)]
    const blocks = buildDiffBlocks(lines)

    assert.deepEqual(
      blocks.map((block) => [block.collapsed, block.lines.length]),
      [
        [true, 7],
        [false, 7],
        [true, 7],
      ],
    )
  })

  it('no colapsa tramos sin cambios demasiado cortos', () => {
    const lines = [...equal(5), REMOVED, ...equal(5, 12)]
    assert.ok(buildDiffBlocks(lines).every((block) => !block.collapsed))
  })

  it('junta en un solo bloque visible cambios cercanos', () => {
    const lines = [ADDED, ...equal(4), REMOVED]
    assert.deepEqual(
      buildDiffBlocks(lines).map((block) => block.lines.length),
      [6],
    )
  })

  it('colapsa todo si no hay cambios y devuelve vacío sin líneas', () => {
    assert.deepEqual(
      buildDiffBlocks(equal(10)).map((block) => block.collapsed),
      [true],
    )
    assert.deepEqual(buildDiffBlocks([]), [])
  })

  it('respeta una cantidad de contexto personalizada', () => {
    const blocks = buildDiffBlocks([...equal(10), ADDED], 1)
    assert.deepEqual(
      blocks.map((block) => block.lines.length),
      [9, 2],
    )
  })
})

describe('toAddedLines', () => {
  it('presenta el contenido como líneas agregadas numeradas', () => {
    assert.deepEqual(toAddedLines('a\r\nb\n'), [
      { type: 'added', oldNumber: null, newNumber: 1, text: 'a' },
      { type: 'added', oldNumber: null, newNumber: 2, text: 'b' },
    ])
    assert.deepEqual(toAddedLines(''), [])
  })
})

describe('countChanges', () => {
  it('cuenta líneas agregadas y eliminadas', () => {
    assert.deepEqual(countChanges([ADDED, REMOVED, ADDED, ...equal(2)]), { added: 2, removed: 1 })
  })
})
