import assert from 'node:assert/strict'
import test from 'node:test'

import { GERMAN_RADIO_STATIONS, calendarAgendaMarkup, isWasteCalendarFeed, parseSlideshowUrls, parseWasteItems, renderSlideshowCrudList, renderWasteEvents, renderWidget, renderWidgetContent } from '../src/widgets.ts'

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

test('calendar URLs containing only whitespace use the built-in calendar', () => {
  const content = renderWidgetContent({ id: 'calendar', type: 'calendar', title: 'Kalender', url: '   ', columns: 8, rows: 5 })

  assert.match(content, /calendar-widget/)
  assert.doesNotMatch(content, /data-widget-frame/)
})

test('iCalendar URLs use the calendar feed renderer instead of an iframe download', () => {
  const content = renderWidgetContent({ id: 'school-calendar', type: 'calendar', title: 'Schule', url: 'https://calendar.example/feed.ics', columns: 8, rows: 5 })

  assert.match(content, /data-calendar-feed/)
  assert.match(content, /data-calendar-widget-id="school-calendar"/)
  assert.doesNotMatch(content, /<iframe/)
})

test('calendar agenda escapes remote event content', () => {
  const html = calendarAgendaMarkup([{ start: '2026-09-28T08:15:00.000Z', end: '2026-09-28T09:00:00.000Z', summary: '<script>alert(1)</script>', location: 'A & B', allDay: false }])

  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/)
  assert.match(html, /A &amp; B/)
  assert.doesNotMatch(html, /<script>/)
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

test('editable widgets expose complete keyboard-friendly CRUD controls and direct resize grip', () => {
  const markup = renderWidget({ id: 'note', type: 'text', title: 'Notiz', url: '', columns: 8, rows: 3 }, true, 1)

  assert.match(markup, /data-action="move-left"/)
  assert.match(markup, /data-action="move-right"/)
  assert.match(markup, /data-action="move-up"/)
  assert.match(markup, /data-action="move-down"/)
  assert.match(markup, /data-action="duplicate"/)
  assert.match(markup, /data-action="remove"/)
  assert.match(markup, /data-action="toggle"/)
  assert.match(markup, /data-field="columns"/)
  assert.match(markup, /data-field="rows"/)
  assert.match(markup, /data-field="breakBefore"/)
  assert.doesNotMatch(markup, /data-action="full-width"/)
  assert.doesNotMatch(markup, /data-action="full-height"/)
  assert.doesNotMatch(markup, /data-resize-action/)
  assert.doesNotMatch(markup, /size-stepper/)
  assert.match(markup, /data-resize-handle/)
  assert.match(markup, /data-resize-readout/)
  assert.match(markup, /Widgetgröße ziehen/)
  assert.match(markup, /aria-describedby="[^"]+-dimensions"/)
  assert.match(markup, /data-dimension-label[^>]+aria-live="polite"/)
  assert.match(markup, /style="--widget-columns: 8; --widget-rows: 3"/)
  assert.doesNotMatch(markup, /class="live-dot">LIVE/)
})

test('widgets render direct corner resize handle and hidden dimension inputs', () => {
  const markup = renderWidget({ id: 'wall', type: 'web', title: 'Videowand', url: '', columns: 24, rows: 14 }, true)

  assert.match(markup, /data-resize-handle/)
  assert.match(markup, /data-columns="24"/)
  assert.match(markup, /data-rows="14"/)
  assert.doesNotMatch(markup, /data-resize-action/)
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

test('parseSlideshowUrls extracts trimmed lines and ignores empty rows', () => {
  const urls = parseSlideshowUrls('  https://example.com/1.jpg \n\n  https://example.com/2.png  \r\n')
  assert.deepEqual(urls, ['https://example.com/1.jpg', 'https://example.com/2.png'])
})

test('slideshow renders slides and indicators for valid image urls', () => {
  const content = renderWidgetContent({
    id: 'slides',
    type: 'slideshow',
    title: 'Familie',
    url: 'https://example.com/pic1.jpg\nhttps://example.com/pic2.png',
    columns: 8,
    rows: 4,
    intervalSeconds: 6,
  })

  assert.match(content, /data-slideshow-widget/)
  assert.match(content, /data-slideshow-interval="6"/)
  assert.match(content, /slideshow-slide is-active/)
  assert.match(content, /slideshow-dot is-active/)
  assert.match(content, /https:\/\/example\.com\/pic1\.jpg/)
  assert.match(content, /https:\/\/example\.com\/pic2\.png/)
})

test('slideshow shows placeholder when no URLs are configured', () => {
  const content = renderWidgetContent({
    id: 'empty-slides',
    type: 'slideshow',
    title: 'Leer',
    url: '',
    columns: 8,
    rows: 4,
  })

  assert.match(content, /Bild-URLs eintragen/)
})

test('renderWidget includes data-refresh-interval for web widgets when configured', () => {
  const markup = renderWidget({
    id: 'dashboard',
    type: 'web',
    title: 'Grafana',
    url: 'https://grafana.example',
    columns: 12,
    rows: 4,
    refreshIntervalMinutes: 5,
  })

  assert.match(markup, /data-refresh-interval="5"/)
})

test('editable widget includes interval fields for web and slideshow', () => {
  const webEditor = renderWidget({ id: 'web-1', type: 'web', title: 'Web', url: '', columns: 12, rows: 3, refreshIntervalMinutes: 10 }, true)
  assert.match(webEditor, /data-field="refreshIntervalMinutes"/)
  assert.match(webEditor, /value="10"/)

  const slideEditor = renderWidget({ id: 'slide-1', type: 'slideshow', title: 'Diashow', url: '', columns: 8, rows: 3, intervalSeconds: 12 }, true)
  assert.match(slideEditor, /data-field="intervalSeconds"/)
  assert.match(slideEditor, /value="12"/)
  assert.match(slideEditor, /Bild-URLs \(eine pro Zeile\)/)
})

test('renderWidget and editorMarkup apply 1 / span and data-break-before when breakBefore is true', () => {
  const kiosk = renderWidget({ id: 'kiosk-break', type: 'web', title: 'Web', url: '', columns: 6, rows: 4, breakBefore: true }, false)
  assert.match(kiosk, /grid-column: 1 \/ span 6/)
  assert.match(kiosk, /data-break-before="true"/)

  const editor = renderWidget({ id: 'editor-break', type: 'web', title: 'Web', url: '', columns: 6, rows: 4, breakBefore: true }, true)
  assert.match(editor, /data-break-before="true"/)
  assert.match(editor, /checked/)
})

test('renderWidget supports showTitle option for visible header in kiosk and preview', () => {
  const kioskWithTitle = renderWidget({ id: 'kiosk-titled', type: 'web', title: 'Mein Dashboard', url: '', columns: 12, rows: 4, showTitle: true }, false)
  assert.match(kioskWithTitle, /class="widget kiosk-widget has-title"/)
  assert.match(kioskWithTitle, /<header class="kiosk-widget-header"><h2 class="kiosk-widget-title">Mein Dashboard<\/h2><\/header>/)

  const kioskWithoutTitle = renderWidget({ id: 'kiosk-untitled', type: 'web', title: 'Mein Dashboard', url: '', columns: 12, rows: 4, showTitle: false }, false)
  assert.doesNotMatch(kioskWithoutTitle, /kiosk-widget-header/)
  assert.match(kioskWithoutTitle, /<h2 class="visually-hidden">Mein Dashboard<\/h2>/)

  const editorTitled = renderWidget({ id: 'editor-titled', type: 'web', title: 'Mein Dashboard', url: '', columns: 12, rows: 4, showTitle: true }, true)
  assert.match(editorTitled, /data-field="showTitle" checked/)
  assert.match(editorTitled, /preview-header/)

  const editorUntitled = renderWidget({ id: 'editor-untitled', type: 'web', title: 'Mein Dashboard', url: '', columns: 12, rows: 4, showTitle: false }, true)
  assert.match(editorUntitled, /data-field="showTitle"/)
  assert.doesNotMatch(editorUntitled, /data-field="showTitle"[^>]*checked/)
  assert.doesNotMatch(editorUntitled, /preview-header/)
})

test('renderSlideshowCrudList outputs empty state when no urls present', () => {
  const empty = renderSlideshowCrudList([])
  assert.match(empty, /slideshow-empty-state/)
  assert.match(empty, /Noch keine Bilder hinzugefügt/)
})

test('renderSlideshowCrudList outputs items with order, thumb, and action buttons', () => {
  const html = renderSlideshowCrudList(['https://example.com/a.jpg', 'https://example.com/b.png'])
  assert.match(html, /data-index="0"/)
  assert.match(html, /#1/)
  assert.match(html, /data-action="slide-up"[^>]*disabled/)
  assert.match(html, /data-action="slide-down"/)
  assert.match(html, /data-action="slide-delete"/)
  assert.match(html, /data-index="1"/)
  assert.match(html, /#2/)
})

test('editorMarkup includes slideshow CRUD section, upload button, and raw url details', () => {
  const editor = renderWidget({
    id: 'slideshow-edit',
    type: 'slideshow',
    title: 'Urlaub',
    url: 'https://example.com/1.jpg\nhttps://example.com/2.jpg',
    columns: 8,
    rows: 4,
  }, true)

  assert.match(editor, /data-slideshow-crud/)
  assert.match(editor, /Bilder \(2 \/ 10\)/)
  assert.match(editor, /data-action="upload"/)
  assert.match(editor, /data-action="add-slideshow-url"/)
  assert.match(editor, /data-slideshow-url-input/)
  assert.match(editor, /raw-urls-details/)
  assert.match(editor, /data-field="url"/)
})

test('waste widget parses items and renders bin cards with urgency badges', () => {
  const widgetHtml = renderWidgetContent({
    id: 'waste-1',
    type: 'waste',
    title: 'Müll',
    url: '',
    columns: 6,
    rows: 4,
    wasteItems: 'Restmüll: Morgen\nBiomüll: In 4 Tagen\nGelber Sack: Nächste Woche\nPapiermüll: 2026-12-01',
  })

  assert.match(widgetHtml, /data-waste-widget/)
  assert.match(widgetHtml, /waste-item is-urgent/)
  assert.match(widgetHtml, /Restmüll/)
  assert.match(widgetHtml, /Morgen/)
  assert.match(widgetHtml, /Biomüll/)
  assert.match(widgetHtml, /Gelber Sack/)
  assert.match(widgetHtml, /Papiermüll/)
})

test('parseWasteItems renders realistic wheelie bin SVGs and handles Date: WasteType order', () => {
  const fakeNow = new Date(2026, 8, 26) // Saturday, 2026-09-26
  const items = parseWasteItems('Morgen: Gelber Sack\nMontag: Restmüll', fakeNow)

  assert.equal(items[0].name, 'Gelber Sack')
  assert.equal(items[0].date, 'Morgen')
  assert.equal(items[0].badgeText, 'Morgen!')
  assert.equal(items[0].isUrgent, true)
  assert.match(items[0].icon, /waste-wheelie-bin/)
  assert.match(items[0].icon, /#eab308/) // Yellow wheelie bin

  assert.equal(items[1].name, 'Restmüll')
  assert.equal(items[1].date, 'Montag')
  assert.equal(items[1].badgeText, 'In 2 Tagen')
  assert.match(items[1].icon, /waste-wheelie-bin/)
  assert.match(items[1].icon, /#374151/) // Black/anthracite wheelie bin
})

test('media widget renders cover, title, artist, and animated equalizer bars', () => {
  const widgetHtml = renderWidgetContent({
    id: 'media-1',
    type: 'media',
    title: 'Musik',
    url: '',
    columns: 6,
    rows: 3,
    mediaTitle: 'Heroes',
    mediaArtist: 'David Bowie',
    mediaAlbum: 'Heroes (1977)',
    mediaPlaying: true,
  })

  assert.match(widgetHtml, /data-media-widget/)
  assert.match(widgetHtml, /is-playing/)
  assert.match(widgetHtml, /data-media-field="title">Heroes</)
  assert.match(widgetHtml, /data-media-field="artist">David Bowie</)
  assert.match(widgetHtml, /data-media-field="album">Heroes \(1977\)</)
  assert.match(widgetHtml, /media-equalizer-bars is-animated/)
})

test('editorMarkup exposes custom input fields for waste and media widgets', () => {
  const wasteEditor = renderWidget({ id: 'w1', type: 'waste', title: 'Müll', url: '', columns: 6, rows: 4, wasteItems: 'Biomüll: Morgen' }, true)
  assert.match(wasteEditor, /data-field="wasteItems"/)
  assert.match(wasteEditor, /Biomüll: Morgen/)

  const mediaEditor = renderWidget({ id: 'm1', type: 'media', title: 'Song', url: '', columns: 6, rows: 3, mediaTitle: 'Yesterday', mediaPlaying: true }, true)
  assert.match(mediaEditor, /data-field="mediaTitle"/)
  assert.match(mediaEditor, /value="Yesterday"/)
  assert.match(mediaEditor, /data-field="mediaPlaying" checked/)
})

test('waste widget recognizes calendar feed url and renders feed container', () => {
  const widget = {
    id: 'waste-feed-widget',
    type: 'waste' as const,
    title: 'Müllabfuhr',
    url: 'webcal://example.com/muell.ics',
    columns: 6,
    rows: 4,
  }
  assert.equal(isWasteCalendarFeed(widget), true)

  const html = renderWidgetContent(widget)
  assert.match(html, /data-waste-feed/)
  assert.match(html, /data-waste-widget-id="waste-feed-widget"/)
  assert.match(html, /Müllkalender-Abo wird geladen/)
})

test('renderWasteEvents transforms upcoming calendar events into categorized bin cards', () => {
  const events = [
    { start: '2026-10-01T06:00:00Z', end: '2026-10-01T08:00:00Z', summary: 'Restmüll', location: '', allDay: false },
    { start: '2026-10-02T06:00:00Z', end: '2026-10-02T08:00:00Z', summary: 'Biotonne: Abholung', location: '', allDay: false },
    { start: '2026-10-05T06:00:00Z', end: '2026-10-05T08:00:00Z', summary: 'Gelber Sack', location: '', allDay: false },
    { start: '2026-10-15T06:00:00Z', end: '2026-10-15T08:00:00Z', summary: 'Altpapier', location: '', allDay: false },
  ]
  const fakeNow = new Date(2026, 9, 1) // 2026-10-01
  const html = renderWasteEvents(events, fakeNow)

  assert.match(html, /Restmüll/)
  assert.match(html, /Heute!/)
  assert.match(html, /Biotonne/)
  assert.match(html, /Morgen!/)
  assert.match(html, /Gelber Sack/)
  assert.match(html, /Altpapier/)
})

test('editorMarkup for waste widget includes ics upload and webcal feed fields', () => {
  const wasteEditor = renderWidget({
    id: 'w-editor',
    type: 'waste',
    title: 'Müllkalender',
    url: 'https://landkreis.de/abfall.ics',
    columns: 6,
    rows: 4,
    wasteItems: 'Restmüll: Morgen',
  }, true)

  assert.match(wasteEditor, /data-action="upload-ics"/)
  assert.match(wasteEditor, /\.ics-Datei importieren/)
  assert.match(wasteEditor, /data-field="url"/)
  assert.match(wasteEditor, /https:\/\/landkreis\.de\/abfall\.ics/)
  assert.match(wasteEditor, /data-field="wasteItems"/)
})

test('GERMAN_RADIO_STATIONS includes verified stations with HTTPS streams', () => {
  assert.ok(GERMAN_RADIO_STATIONS.length >= 10)
  const names = GERMAN_RADIO_STATIONS.map((s) => s.name)
  assert.ok(names.includes('1LIVE'))
  assert.ok(names.includes('WDR 2'))
  assert.ok(names.includes('SWR3'))
  assert.ok(names.includes('ANTENNE BAYERN'))
  assert.ok(names.includes('Deutschlandfunk'))
  assert.ok(names.includes('RADIO BOB!'))

  for (const station of GERMAN_RADIO_STATIONS) {
    if (station.id !== 'custom') {
      assert.match(station.streamUrl, /^https:\/\//)
    }
  }
})

test('media widget renders radio stream controls, live badge, audio element and volume slider', () => {
  const radioHtml = renderWidgetContent({
    id: 'radio-1',
    type: 'media',
    title: '1LIVE',
    url: 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3',
    columns: 8,
    rows: 3,
    mediaTitle: '1LIVE',
    mediaArtist: 'WDR - Eins Live',
    mediaPlaying: true,
  })

  assert.match(radioHtml, /data-media-widget/)
  assert.match(radioHtml, /data-stream-url="https:\/\/wdr-1live-live\.icecastssl\.wdr\.de/)
  assert.match(radioHtml, /data-action="toggle-play"/)
  assert.match(radioHtml, /LIVE RADIO/)
  assert.match(radioHtml, /data-media-field="title">1LIVE</)
  assert.match(radioHtml, /data-media-field="artist">WDR - Eins Live</)
  assert.match(radioHtml, /data-action="volume-slider"/)
  assert.match(radioHtml, /<audio preload="none" data-media-audio src="https:\/\/wdr-1live-live\.icecastssl\.wdr\.de/)
})

test('editorMarkup exposes German radio preset selector and stream test button', () => {
  const radioEditor = renderWidget({
    id: 'r-edit',
    type: 'media',
    title: '1LIVE',
    url: 'https://wdr-1live-live.icecastssl.wdr.de/wdr/1live/live/mp3/128/stream.mp3',
    columns: 8,
    rows: 3,
    mediaTitle: '1LIVE',
    mediaArtist: 'WDR - Eins Live',
  }, true)

  assert.match(radioEditor, /data-action="radio-preset"/)
  assert.match(radioEditor, /data-action="test-radio-stream"/)
  assert.match(radioEditor, /1LIVE/)
  assert.match(radioEditor, /SWR3/)
  assert.match(radioEditor, /data-field="url"/)
  assert.match(radioEditor, /data-field="mediaTitle"/)
})



