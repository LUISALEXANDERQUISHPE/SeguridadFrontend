import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { findMatches, MAX_MATCHES, normalizeWithMap, type PageText } from './pdfTextSearch.ts'

function page(pageNumber: number, items: string[], endsLine: boolean[] = items.map(() => false)): PageText {
  return { pageNumber, items, endsLine }
}

/** Texto que resalta cada coincidencia, para comprobar que cae exactamente sobre lo buscado. */
function highlightedTexts(pages: PageText[], query: string): string[] {
  return findMatches(pages, query).map((match) =>
    match.segments
      .map((segment) => pages[match.pageNumber - 1].items[segment.itemIndex].slice(segment.start, segment.end))
      .join(''),
  )
}

describe('normalizeWithMap', () => {
  it('quita tildes y pasa a minúsculas', () => {
    assert.equal(normalizeWithMap('Introducción ÁÉ Ñ').text, 'introduccion ae n')
  })

  it('ignora los acentos sueltos que genera pdflatex sin fontenc T1', () => {
    assert.equal(normalizeWithMap('Introducci´on aqu´ı').text, 'introduccion aqui')
  })

  it('separa las ligaduras tipográficas', () => {
    assert.equal(normalizeWithMap('ﬁgura').text, 'figura')
  })

  it('relaciona cada carácter con su posición en el texto original', () => {
    const { text, starts, ends } = normalizeWithMap('a´b')
    assert.equal(text, 'ab')
    assert.deepEqual(starts, [0, 2])
    assert.deepEqual(ends, [1, 3])
  })
})

describe('findMatches', () => {
  const pages = [
    page(1, ['1. Introducción', 'El sistema ', 'Overl', 'eaf usa LaTeX.'], [true, false, false, true]),
    page(2, ['Introducci´on', 'c´odigo aqu´ı'], [true, true]),
  ]

  it('encuentra sin distinguir mayúsculas ni tildes y en orden de lectura', () => {
    const matches = findMatches(pages, 'INTRODUCCION')
    assert.deepEqual(
      matches.map((match) => match.pageNumber),
      [1, 2],
    )
  })

  it('resalta exactamente el texto encontrado, incluidos los acentos sueltos', () => {
    assert.deepEqual(highlightedTexts(pages, 'código aquí'), ['c´odigo aqu´ı'])
  })

  it('encuentra palabras partidas en varios fragmentos del PDF', () => {
    const [match] = findMatches(pages, 'Overleaf')
    assert.deepEqual(match.segments, [
      { itemIndex: 2, start: 0, end: 5 },
      { itemIndex: 3, start: 0, end: 3 },
    ])
  })

  it('encuentra frases que continúan en la línea siguiente', () => {
    assert.deepEqual(highlightedTexts(pages, 'Introducción El'), ['IntroducciónEl'])
  })

  it('no devuelve resultados para consultas vacías o sin coincidencias', () => {
    assert.deepEqual(findMatches(pages, '   '), [])
    assert.deepEqual(findMatches(pages, 'inexistente'), [])
  })

  it('genera identificadores únicos por coincidencia', () => {
    const ids = findMatches([page(1, ['la la la'])], 'la').map((match) => match.id)
    assert.equal(new Set(ids).size, 3)
  })

  it('limita la cantidad de coincidencias para no bloquear la interfaz', () => {
    const longText = 'a'.repeat(MAX_MATCHES + 50)
    assert.equal(findMatches([page(1, [longText])], 'a').length, MAX_MATCHES)
  })
})
