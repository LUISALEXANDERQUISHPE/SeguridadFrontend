import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  base64ToBytes,
  bytesToBase64,
  computeTextChange,
  mapIndexThroughDelta,
  toLineColumn,
  type TextChange,
} from './textSync.ts'

function apply(text: string, change: TextChange | null): string {
  if (!change) return text
  return text.slice(0, change.index) + change.insert + text.slice(change.index + change.deleteCount)
}

describe('computeTextChange', () => {
  it('detecta inserciones, borrados y reemplazos', () => {
    assert.deepEqual(computeTextChange('hola', 'hoxla'), { index: 2, deleteCount: 0, insert: 'x' })
    assert.deepEqual(computeTextChange('hola', 'hla'), { index: 1, deleteCount: 1, insert: '' })
    assert.deepEqual(computeTextChange('a foo b', 'a bar b'), { index: 2, deleteCount: 3, insert: 'bar' })
    assert.equal(computeTextChange('igual', 'igual'), null)
  })

  it('el cambio reproduce siempre el texto nuevo, aun con letras repetidas', () => {
    const cases: Array<[string, string]> = [
      ['aaa', 'aaaa'],
      ['abcabc', 'abc'],
      ['', '\\section{}'],
      ['texto', ''],
      ['x 😀 y', 'x 😁 y'],
    ]
    for (const [previous, next] of cases) {
      assert.equal(apply(previous, computeTextChange(previous, next)), next)
    }
  })

  it('no parte los emojis por la mitad', () => {
    const change = computeTextChange('😀', '😁')
    assert.ok(change)
    assert.equal(change.index, 0)
    assert.equal(change.insert, '😁')
  })
})

describe('mapIndexThroughDelta', () => {
  it('desplaza el cursor cuando otro inserta o borra antes de él', () => {
    assert.equal(mapIndexThroughDelta(5, [{ retain: 2 }, { insert: 'abc' }]), 8)
    assert.equal(mapIndexThroughDelta(5, [{ retain: 1 }, { delete: 2 }]), 3)
  })

  it('no mueve el cursor si el cambio ocurre después', () => {
    assert.equal(mapIndexThroughDelta(2, [{ retain: 4 }, { insert: 'zz' }]), 2)
    assert.equal(mapIndexThroughDelta(2, [{ retain: 2 }, { insert: 'zz' }]), 2)
  })

  it('lleva el cursor al inicio de un tramo borrado que lo contenía', () => {
    assert.equal(mapIndexThroughDelta(5, [{ retain: 3 }, { delete: 4 }]), 3)
  })

  it('combina borrados e inserciones en el mismo cambio', () => {
    assert.equal(mapIndexThroughDelta(6, [{ retain: 1 }, { delete: 2 }, { insert: 'xyz' }]), 7)
  })
})

describe('toLineColumn', () => {
  it('convierte posiciones en línea y columna', () => {
    const text = 'ab\ncde\nf'
    assert.deepEqual(toLineColumn(text, 0), { line: 0, column: 0 })
    assert.deepEqual(toLineColumn(text, 5), { line: 1, column: 2 })
    assert.deepEqual(toLineColumn(text, 99), { line: 2, column: 1 })
  })
})

describe('base64', () => {
  it('conserva los bytes de ida y vuelta', () => {
    const bytes = new Uint8Array([0, 1, 127, 128, 255])
    assert.deepEqual(base64ToBytes(bytesToBase64(bytes)), bytes)
  })
})
