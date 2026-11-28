import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { buildCategoryOptions, filterTemplates, formatFileSize, normalizeText } from './templateFilters.ts'
import type { LatexTemplate } from '../../../types/template.ts'

function template(overrides: Partial<LatexTemplate>): LatexTemplate {
  return {
    id: 'id',
    name: 'Plantilla',
    category: 'articulo',
    categoryLabel: 'Artículos',
    description: '',
    tags: [],
    mainFile: 'main.tex',
    ...overrides,
  }
}

const CATALOG = [
  template({ id: '1', name: 'Tesis de grado', category: 'tesis', categoryLabel: 'Tesis', tags: ['titulación'] }),
  template({ id: '2', name: 'Artículo científico', description: 'Estructura IMRyD' }),
  template({ id: '3', name: 'Artículo IEEE', tags: ['conferencia', 'dos columnas'] }),
  template({ id: '4', name: 'Presentación Beamer', category: 'presentacion', categoryLabel: 'Presentaciones' }),
]

const ids = (templates: LatexTemplate[]) => templates.map((item) => item.id)

describe('normalizeText', () => {
  it('quita tildes y pasa a minúsculas', () => {
    assert.equal(normalizeText('Presentación ARTÍCULO Ñandú'), 'presentacion articulo nandu')
  })
})

describe('filterTemplates', () => {
  it('muestra todas las plantillas sin filtros', () => {
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', '')), ['1', '2', '3', '4'])
  })

  it('filtra por categoría', () => {
    assert.deepEqual(ids(filterTemplates(CATALOG, 'articulo', '')), ['2', '3'])
  })

  it('busca sin distinguir tildes ni mayúsculas en nombre, descripción, categoría y etiquetas', () => {
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'articulo')), ['2', '3'])
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'imryd')), ['2'])
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'TITULACION')), ['1'])
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'presentaciones')), ['4'])
  })

  it('exige que aparezcan todas las palabras buscadas', () => {
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'artículo columnas')), ['3'])
    assert.deepEqual(ids(filterTemplates(CATALOG, 'all', 'artículo inexistente')), [])
  })

  it('combina categoría y búsqueda', () => {
    assert.deepEqual(ids(filterTemplates(CATALOG, 'tesis', 'ieee')), [])
  })
})

describe('buildCategoryOptions', () => {
  it('incluye "Todas" y cada categoría presente con su cantidad', () => {
    assert.deepEqual(buildCategoryOptions(CATALOG), [
      { value: 'all', label: 'Todas', count: 4 },
      { value: 'tesis', label: 'Tesis', count: 1 },
      { value: 'articulo', label: 'Artículos', count: 2 },
      { value: 'presentacion', label: 'Presentaciones', count: 1 },
    ])
  })
})

describe('formatFileSize', () => {
  it('muestra el tamaño en la unidad adecuada', () => {
    assert.equal(formatFileSize(512), '512 B')
    assert.equal(formatFileSize(1536), '1.5 KB')
    assert.equal(formatFileSize(2.5 * 1024 * 1024), '2.5 MB')
  })
})
