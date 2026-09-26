import assert from 'node:assert/strict'
import test from 'node:test'

import { createWidget, defaultSettings, GRID_COLUMNS, GRID_ROWS, layoutFits, MAX_WIDGET_COLUMNS, MAX_WIDGET_ROWS, normalizeSettings, SETTINGS_VERSION } from '../src/settings.ts'

test('normalizeSettings returns independent defaults for missing data', () => {
  const first = normalizeSettings(null)
  const second = normalizeSettings(null)

  assert.deepEqual(first, defaultSettings)
  assert.notEqual(first.widgets, second.widgets)
})

test('the kiosk grid uses television-like 24 by 14 proportions', () => {
  assert.equal(GRID_COLUMNS, 24)
  assert.equal(GRID_ROWS, 14)
  assert.equal(SETTINGS_VERSION, 3)
})

test('normalizeSettings migrates legacy widget sizes to the current grid', () => {
  const settings = normalizeSettings({
    location: 'Küche',
    widgets: [{ id: 'clock', title: 'Uhr', url: 'https://example.com', columns: 6, rows: 2 }],
  })

  assert.equal(settings.version, 3)
  assert.equal(settings.location, 'Küche')
  assert.deepEqual(settings.widgets[0], {
    id: 'clock',
    type: 'web',
    title: 'Uhr',
    url: 'https://example.com',
    columns: 12,
    rows: 7,
  })
})

test('legacy version 1 migration keeps valid stacked layouts inside the grid', () => {
  const settings = normalizeSettings({
    version: 1,
    widgets: Array.from({ length: 4 }, (_, index) => ({ id: `legacy-stack-${index}`, type: 'web', columns: 12, rows: 1 })),
  })

  assert.equal(layoutFits(settings.widgets), true)
})

test('normalizeSettings preserves the physical height of version 2 widgets', () => {
  const settings = normalizeSettings({
    version: 2,
    widgets: [
      { id: 'full-height', type: 'web', columns: 24, rows: 8 },
      { id: 'half-height', type: 'web', columns: 24, rows: 4 },
    ],
  })

  assert.equal(settings.version, 3)
  assert.deepEqual(settings.widgets.map(({ columns, rows }) => ({ columns, rows })), [
    { columns: 24, rows: 14 },
    { columns: 24, rows: 7 },
  ])
})

test('version 2 migration keeps valid stacked layouts inside the grid', () => {
  const partitions = [
    [2, 6],
    [2, 2, 2, 2],
  ]

  for (const rows of partitions) {
    const settings = normalizeSettings({
      version: 2,
      widgets: rows.map((widgetRows, index) => ({ id: `stack-${index}`, type: 'web', columns: 24, rows: widgetRows })),
    })
    assert.equal(layoutFits(settings.widgets), true)
  }
})

test('version 2 migration preserves valid mixed-width row boundaries', () => {
  const settings = normalizeSettings({
    version: 2,
    widgets: [
      { id: 'upper-left', type: 'web', columns: 20, rows: 2 },
      { id: 'lower-left', type: 'web', columns: 20, rows: 2 },
      { id: 'bottom', type: 'web', columns: 24, rows: 4 },
      { id: 'right', type: 'web', columns: 4, rows: 4 },
    ],
  })

  assert.equal(layoutFits(settings.widgets), true)
})

test('normalizing migrated settings repeatedly does not rescale them again', () => {
  const migrated = normalizeSettings({ version: 2, widgets: [{ type: 'web', columns: 24, rows: 8 }] })

  assert.deepEqual(normalizeSettings(migrated), migrated)
})

test('legacy single-widget settings preserve their previous height', () => {
  assert.equal(normalizeSettings({ url: 'https://example.com' }).widgets[0]?.rows, 4)
  assert.equal(normalizeSettings({ url: 'https://example.com', size: 'tall' }).widgets[0]?.rows, 7)
})

test('normalizeSettings leaves current version dimensions unchanged', () => {
  const settings = normalizeSettings({ version: 3, widgets: [{ type: 'web', columns: 24, rows: 8 }] })

  assert.deepEqual(settings.widgets.map(({ columns, rows }) => ({ columns, rows })), [{ columns: 24, rows: 8 }])
})

test('normalizeSettings allows widgets to extend across multiple screens', () => {
  const settings = normalizeSettings({
    version: 3,
    widgets: [{ id: 'wall', type: 'web', columns: 48, rows: 28 }],
  })

  assert.deepEqual(settings.widgets.map(({ columns, rows }) => ({ columns, rows })), [{ columns: 48, rows: 28 }])
})

test('normalizeSettings applies only a generous safety limit and rejects unsupported widget types', () => {
  const settings = normalizeSettings({
    version: 3,
    widgets: [
      { id: '', type: 'script', title: '', url: 42, columns: MAX_WIDGET_COLUMNS + 1, rows: -4 },
      { id: 'tall', type: 'web', title: 'Hoch', url: '', columns: 24, rows: MAX_WIDGET_ROWS + 1 },
    ],
  })

  assert.deepEqual(settings.widgets[0], {
    id: 'widget-1',
    type: 'web',
    title: 'Web-Widget 1',
    url: '',
    columns: MAX_WIDGET_COLUMNS,
    rows: 2,
  })
  assert.equal(settings.widgets[1]?.rows, MAX_WIDGET_ROWS)
})

test('normalizeSettings rounds dimensions and enforces safe minimum sizes by type', () => {
  const settings = normalizeSettings({
    version: 3,
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

test('layoutFits allows the canvas to grow right and down', () => {
  const fitting = Array.from({ length: 4 }, (_, index) => ({ ...createWidget('text', index + 1), columns: 12, rows: 7 }))
  const overflowing = [...fitting, { ...createWidget('image', 5), columns: 4, rows: 2 }]

  assert.equal(layoutFits(fitting), true)
  assert.equal(layoutFits(overflowing), true)
  assert.equal(layoutFits([{ ...createWidget('web', 6), columns: MAX_WIDGET_COLUMNS + 1 }]), false)
})

test('normalizeSettings makes duplicate widget identifiers unique', () => {
  const normalized = normalizeSettings({
    version: 3,
    widgets: [
      { id: 'duplicate', type: 'text' },
      { id: 'duplicate', type: 'image' },
    ],
  })

  assert.equal(new Set(normalized.widgets.map((widget) => widget.id)).size, 2)
})

test('createWidget supports slideshow with 8s default interval', () => {
  assert.deepEqual(createWidget('slideshow', 3), {
    id: 'widget-3',
    type: 'slideshow',
    title: 'Diashow',
    url: '',
    columns: 8,
    rows: 3,
    intervalSeconds: 8,
  })
})

test('normalizeSettings preserves and validates interval options', () => {
  const normalized = normalizeSettings({
    version: 3,
    widgets: [
      { type: 'web', refreshIntervalMinutes: 15 },
      { type: 'slideshow', intervalSeconds: 10 },
      { type: 'web', refreshIntervalMinutes: -5 },
      { type: 'slideshow', intervalSeconds: 99999 },
    ],
  })

  assert.equal(normalized.widgets[0]?.refreshIntervalMinutes, 15)
  assert.equal(normalized.widgets[1]?.intervalSeconds, 10)
  assert.equal(normalized.widgets[2]?.refreshIntervalMinutes, undefined)
  assert.equal(normalized.widgets[3]?.intervalSeconds, 3600)
})

test('normalizeSettings preserves breakBefore option for 2D row placement', () => {
  const normalized = normalizeSettings({
    version: 3,
    widgets: [
      { type: 'web', breakBefore: true },
      { type: 'calendar', breakBefore: false },
    ],
  })

  assert.equal(normalized.widgets[0]?.breakBefore, true)
  assert.equal(normalized.widgets[1]?.breakBefore, undefined)
})

test('normalizeSettings preserves showTitle option', () => {
  const normalized = normalizeSettings({
    version: 3,
    widgets: [
      { type: 'web', showTitle: true },
      { type: 'image', showTitle: false },
    ],
  })

  assert.equal(normalized.widgets[0]?.showTitle, true)
  assert.equal(normalized.widgets[1]?.showTitle, undefined)
})

test('normalizeSettings preserves and validates system and display options', () => {
  const normalized = normalizeSettings({
    version: 3,
    timezone: 'Europe/Berlin',
    locale: 'de-DE',
    showSeconds: true,
    showWeekday: true,
    displayScale: 125,
    hideCursor: false,
    audioOutput: 'jack',
    widgets: [],
  })

  assert.equal(normalized.timezone, 'Europe/Berlin')
  assert.equal(normalized.locale, 'de-DE')
  assert.equal(normalized.showSeconds, true)
  assert.equal(normalized.showWeekday, true)
  assert.equal(normalized.displayScale, 125)
  assert.equal(normalized.hideCursor, false)
  assert.equal(normalized.audioOutput, 'jack')

  const invalid = normalizeSettings({
    version: 3,
    displayScale: 500,
    widgets: [],
  })
  assert.equal(invalid.displayScale, 100)
  assert.equal(invalid.hideCursor, true)
  assert.equal(invalid.timezone, 'auto')
  assert.equal(invalid.audioOutput, 'hdmi')
})

test('createWidget and normalizeSettings support waste and media widgets', () => {
  const waste = createWidget('waste', 1)
  assert.equal(waste.type, 'waste')
  assert.equal(waste.title, 'Müllkalender')
  assert.ok(typeof waste.wasteItems === 'string')

  const media = createWidget('media', 2)
  assert.equal(media.type, 'media')
  assert.equal(media.mediaTitle, '1LIVE')
  assert.equal(media.mediaPlaying, false)
  assert.match(media.url, /stream\.mp3/)

  const normalized = normalizeSettings({
    version: 3,
    nightModeEnabled: true,
    nightModeStart: '23:00',
    nightModeEnd: '07:00',
    nightModeStyle: 'clock',
    pixelShiftEnabled: true,
    notificationSoundEnabled: true,
    notificationSoundVolume: 90,
    widgets: [
      { id: 'w1', type: 'waste', wasteItems: 'Morgen: Gelber Sack' },
      { id: 'w2', type: 'media', mediaTitle: 'Bohemian Rhapsody', mediaArtist: 'Queen', mediaPlaying: true },
    ],
  })

  assert.equal(normalized.nightModeEnabled, true)
  assert.equal(normalized.nightModeStart, '23:00')
  assert.equal(normalized.nightModeEnd, '07:00')
  assert.equal(normalized.nightModeStyle, 'clock')
  assert.equal(normalized.widgets[0]?.wasteItems, 'Morgen: Gelber Sack')
  assert.equal(normalized.widgets[1]?.mediaTitle, 'Bohemian Rhapsody')
  assert.equal(normalized.widgets[1]?.mediaPlaying, true)
})


