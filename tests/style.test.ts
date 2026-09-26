import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import test from 'node:test'

const css = await readFile(new URL('../src/style.css', import.meta.url), 'utf8')

test('the kiosk canvas extends beyond one screen instead of clipping widgets', () => {
  assert.match(css, /\.signage-shell\s*\{[^}]*overflow:\s*auto/s)
  assert.match(css, /\.widget-grid\s*\{[^}]*grid-auto-columns:\s*var\(--grid-column-size\)/s)
  assert.match(css, /\.widget-grid\s*\{[^}]*grid-auto-rows:\s*var\(--grid-row-size\)/s)
  assert.match(css, /\.widget-grid\s*\{[^}]*overflow:\s*visible/s)
  assert.match(css, /--grid-row-size:[^;]*100vh[^;]*;\s*--grid-row-size:[^;]*100dvh/s)
})

test('the editor grid uses 24 columns and dynamic column spans for widget cards', () => {
  assert.match(css, /\.widget-editors\s*\{[^}]*grid-template-columns:\s*repeat\(24,\s*minmax\(0,\s*1fr\)\)/s)
  assert.match(css, /\.widget-editors\s*\{[^}]*grid-auto-flow:\s*row/s)
  assert.match(css, /\.widget-editor\s*\{[^}]*grid-column:\s*span\s+min\(24,\s*var\(--widget-columns/s)
  assert.match(css, /\.slideshow-container\s*\{[^}]*position:\s*relative/s)
  assert.match(css, /\.connection-status\.is-offline\s*\{[^}]*color:\s*var\(--danger\)/s)
})
