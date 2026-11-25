import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findThreadAt, resolveAnchor } from './commentAnchors.ts'

const TEXT = 'Intro \\cite{perez} y luego \\cite{lopez}. Fin \\cite{perez}.'
const at = (needle: string, from = 0) => TEXT.indexOf(needle, from)

describe('resolveAnchor', () => {
  it('ubica el comentario exacto si el texto no cambió', () => {
    const start = at('\\cite{lopez}')
    const anchor = resolveAnchor(TEXT, { selection: { start, end: start + 12 }, quotedText: '\\cite{lopez}' })
    assert.deepEqual(anchor, { start, end: start + 12, status: 'exact' })
  })

  it('sigue al texto citado cuando se escribió antes y las posiciones se movieron', () => {
    const original = at('\\cite{lopez}')
    const edited = `Texto nuevo al inicio. ${TEXT}`
    const anchor = resolveAnchor(edited, { selection: { start: original, end: original + 12 }, quotedText: '\\cite{lopez}' })
    assert.equal(anchor.status, 'moved')
    assert.equal(edited.slice(anchor.start, anchor.end), '\\cite{lopez}')
  })

  it('con varias apariciones elige la más cercana a la posición original', () => {
    const second = at('\\cite{perez}', 10)
    const edited = `XX${TEXT}`
    const anchor = resolveAnchor(edited, { selection: { start: second, end: second + 12 }, quotedText: '\\cite{perez}' })
    assert.equal(anchor.start, second + 2)
  })

  it('queda suelto si el texto citado ya no existe', () => {
    const anchor = resolveAnchor('Otro documento', { selection: { start: 3, end: 9 }, quotedText: '\\cite{lopez}' })
    assert.equal(anchor.status, 'lost')
    assert.equal(anchor.start, anchor.end)
  })

  it('acepta una cita truncada (comentarios sobre fragmentos largos)', () => {
    const long = 'a'.repeat(800)
    const anchor = resolveAnchor(long, { selection: { start: 0, end: 800 }, quotedText: 'a'.repeat(500) })
    assert.deepEqual(anchor, { start: 0, end: 800, status: 'exact' })
  })

  it('sin cita usa la posición, acotada al largo del texto', () => {
    assert.deepEqual(resolveAnchor('abc', { selection: { start: 1, end: 99 }, quotedText: null }), { start: 1, end: 3, status: 'exact' })
    assert.equal(resolveAnchor('abc', { selection: { start: 50, end: 60 }, quotedText: null }).status, 'lost')
  })
})

describe('findThreadAt', () => {
  it('devuelve el hilo cuyo fragmento contiene el cursor, ignorando los sueltos', () => {
    const anchors = [
      { thread: { id: 'a' }, anchor: { start: 0, end: 5, status: 'exact' as const } },
      { thread: { id: 'b' }, anchor: { start: 10, end: 10, status: 'lost' as const } },
      { thread: { id: 'c' }, anchor: { start: 8, end: 12, status: 'moved' as const } },
    ]
    assert.equal(findThreadAt(anchors, 3)?.id, 'a')
    assert.equal(findThreadAt(anchors, 10)?.id, 'c')
    assert.equal(findThreadAt(anchors, 20), null)
  })
})
