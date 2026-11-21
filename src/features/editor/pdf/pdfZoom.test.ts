import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_SCALE,
  MIN_SCALE,
  clampScale,
  fromZoomKey,
  resolveScale,
  toZoomKey,
  zoomIn,
  zoomOut,
} from './pdfZoom.ts'

// Hoja A4 a escala 1 (puntos PDF) y un panel de 1032 × 832 px (incluye 32 px de margen)
const A4 = { width: 595, height: 842 }
const PANEL = { width: 1032, height: 832 }

describe('resolveScale', () => {
  it('ajusta la página al ancho disponible', () => {
    assert.equal(resolveScale('fit-width', A4, PANEL), 1000 / 595)
  })

  it('ajusta la página completa usando el lado más restrictivo', () => {
    assert.equal(resolveScale('fit-page', A4, PANEL), 800 / 842)
  })

  it('usa la escala fija indicada, dentro de los límites', () => {
    assert.equal(resolveScale(1.5, A4, PANEL), 1.5)
    assert.equal(resolveScale(10, A4, PANEL), MAX_SCALE)
  })

  it('usa 100 % mientras no se conoce el tamaño de la página o del panel', () => {
    assert.equal(resolveScale('fit-width', null, PANEL), 1)
    assert.equal(resolveScale('fit-page', A4, { width: 0, height: 0 }), 1)
  })
})

describe('zoomIn / zoomOut', () => {
  it('aumenta y reduce de forma simétrica', () => {
    assert.ok(Math.abs(zoomOut(zoomIn(1)) - 1) < 1e-9)
  })

  it('respeta los límites mínimo y máximo', () => {
    assert.equal(zoomIn(MAX_SCALE), MAX_SCALE)
    assert.equal(zoomOut(MIN_SCALE), MIN_SCALE)
    assert.equal(clampScale(0), MIN_SCALE)
  })
})

describe('claves del selector de zoom', () => {
  it('convierte en ambos sentidos los modos automáticos y los porcentajes', () => {
    assert.equal(fromZoomKey(toZoomKey('fit-width')), 'fit-width')
    assert.equal(fromZoomKey(toZoomKey('fit-page')), 'fit-page')
    assert.equal(fromZoomKey(toZoomKey(1.25)), 1.25)
  })

  it('acota valores fuera de rango que lleguen desde el selector', () => {
    assert.equal(fromZoomKey('99'), MAX_SCALE)
  })
})
