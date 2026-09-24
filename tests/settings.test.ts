import assert from 'node:assert/strict'
import test from 'node:test'

import { createWidget, defaultSettings, layoutFits, normalizeSettings } from '../src/settings.ts'

test('normalizeSettings returns independent defaults for missing data', () => {
  const first = normalizeSettings(null)
  const second = normalizeSettings(null)

  assert.deepEqual(first, defaultSettings)
  assert.notEqual(first.widgets, second.widgets)
})

test('normalizeSettings migrates legacy widget sizes to the 24 by 8 grid', () => {
  const settings = normalizeSettings({
    location: 'Küche',
    widgets: [{ id: 'clock', title: 'Uhr', url: 'https://example.com', columns: 6, rows: 2 }],
  })

  assert.equal(settings.version, 2)
  assert.equal(settings.location, 'Küche')
  assert.deepEqual(settings.widgets[0], {
    id: 'clock',
    type: 'web',
    title: 'Uhr',
    url: 'https://example.com',
    columns: 12,
    rows: 4,
  })
})

test('normalizeSettings clamps sizes and rejects unsupported widget types', () => {
  const settings = normalizeSettings({
    version: 2,
    widgets: [{ id: '', type: 'script', title: '', url: 42, columns: 99, rows: -4 }],
  })

  assert.deepEqual(settings.widgets[0], {
    id: 'widget-1',
    type: 'web',
    title: 'Web-Widget 1',
    url: '',
    columns: 24,
    rows: 2,
  })
})

test('normalizeSettings rounds dimensions and enforces safe minimum sizes by type', () => {
  const settings = normalizeSettings({
    version: 2,
    widgets: [
      { type: 'calendar', columns: 5.6, rows: 2.2 },
      { type: 'image', columns: 2, rows: 1 },
      { type: 'text', columns: 4.4, rows: 1.2 },
    ],
  })

  assert.deepEqual(settings.widgets.map(({ columns, rows }) => ({ columns, rows })), [
    { columns: 6, rows: 5 },
    { columns: 4, rows: 2 },
    { columns: 4, rows: 2 },
  ])
})

test('createWidget returns useful defaults for each widget type', () => {
  assert.deepEqual(createWidget('calendar', 2), {
    id: 'widget-2',
    type: 'calendar',
    title: 'Kalender',
    url: '',
    columns: 8,
    rows: 5,
  })
})

test('layoutFits detects when widgets exceed the 24 by 8 kiosk grid', () => {
  const fitting = Array.from({ length: 4 }, (_, index) => ({ ...createWidget('text', index + 1), columns: 12, rows: 4 }))
  const overflowing = [...fitting, { ...createWidget('image', 5), columns: 4, rows: 2 }]

  assert.equal(layoutFits(fitting), true)
  assert.equal(layoutFits(overflowing), false)
})

test('normalizeSettings makes duplicate widget identifiers unique', () => {
  const normalized = normalizeSettings({
    version: 2,
    widgets: [
      { id: 'duplicate', type: 'text' },
      { id: 'duplicate', type: 'image' },
    ],
  })

  assert.equal(new Set(normalized.widgets.map((widget) => widget.id)).size, 2)
})
