import assert from 'node:assert/strict'
import test from 'node:test'

import { renderWidget } from '../src/widgets.ts'

test('renderWidget escapes text content', () => {
  const markup = renderWidget({ id: 'note', type: 'text', title: '<Titel>', url: '<script>', columns: 6, rows: 2 })

  assert.doesNotMatch(markup, /<script>/)
  assert.match(markup, /&lt;script&gt;/)
  assert.match(markup, /grid-column: span 6/)
})

test('renderWidget includes loading state and reload action for web frames', () => {
  const markup = renderWidget({ id: 'web', type: 'web', title: 'Web', url: 'https://example.com', columns: 12, rows: 2 })

  assert.match(markup, /data-widget-frame/)
  assert.match(markup, /Widget wird geladen/)
  assert.match(markup, /data-reload-frame/)
})

test('renderWidget blocks unsafe resource URL schemes', () => {
  const markup = renderWidget({ id: 'web', type: 'web', title: 'Web', url: 'javascript:alert(1)', columns: 12, rows: 3 })

  assert.doesNotMatch(markup, /<iframe/)
  assert.match(markup, /URL nicht erlaubt/)
})

test('editable widgets use a multiline content field', () => {
  const markup = renderWidget({ id: 'note', type: 'text', title: 'Notiz', url: 'Zeile 1\nZeile 2', columns: 12, rows: 2 }, true)

  assert.match(markup, /<textarea[^>]+data-field="url"/)
  assert.match(markup, /Zeile 1\nZeile 2<\/textarea>/)
})

test('editable widgets expose complete keyboard-friendly CRUD controls', () => {
  const markup = renderWidget({ id: 'note', type: 'text', title: 'Notiz', url: '', columns: 8, rows: 3 }, true, 1)

  assert.match(markup, /data-action="move-up"/)
  assert.match(markup, /data-action="move-down"/)
  assert.match(markup, /data-action="duplicate"/)
  assert.match(markup, /data-action="remove"/)
  assert.match(markup, /data-action="toggle"/)
  assert.match(markup, /data-field="columns"/)
  assert.match(markup, /data-field="rows"/)
  assert.doesNotMatch(markup, /class="live-dot">LIVE/)
})

test('editable widget control IDs remain unique when rendered with the same list index', () => {
  const first = renderWidget({ id: 'alpha', type: 'text', title: 'A', url: '', columns: 4, rows: 2 }, true, 0)
  const second = renderWidget({ id: 'beta', type: 'text', title: 'B', url: '', columns: 4, rows: 2 }, true, 0)

  const firstTypeId = first.match(/id="([^"]+-type)"/)?.[1]
  const secondTypeId = second.match(/id="([^"]+-type)"/)?.[1]
  assert.ok(firstTypeId)
  assert.ok(secondTypeId)
  assert.notEqual(firstTypeId, secondTypeId)
  assert.match(first, new RegExp(`for="${firstTypeId}"`))
})
