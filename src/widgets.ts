import { calendarMarkup, escapeHtml } from './dashboard-utils.ts'
import type { CalendarFeedEvent } from './calendar-feed.ts'
import type { DashboardWidget, WidgetType } from './settings.ts'

const typeLabels: Record<WidgetType, string> = {
  web: 'WEB',
  calendar: 'KALENDER',
  text: 'TEXT',
  image: 'BILD',
  slideshow: 'DIASHOW',
  waste: 'MÜLL',
  energy: 'ENERGIE',
  media: 'MEDIA',
}

export interface ParsedWasteItem {
  name: string
  date: string
  color: string
  icon: string
  badgeText: string
  isUrgent: boolean
}

export function parseWasteItems(raw: string | undefined): ParsedWasteItem[] {
  const content = (raw && raw.trim()) ? raw : 'Restmüll: In 2 Tagen\nBiomüll: Donnerstag\nGelber Sack: Nächste Woche\nPapiermüll: In 10 Tagen'
  const lines = content.split(/[\r\n]+/).map((l) => l.trim()).filter(Boolean)

  return lines.map((line) => {
    let name = line
    let date = ''
    let customColor = ''

    if (line.includes('|')) {
      const parts = line.split('|')
      line = parts[0]!.trim()
      customColor = parts[1]!.trim()
    }

    const colonIndex = line.indexOf(':')
    if (colonIndex !== -1) {
      name = line.slice(0, colonIndex).trim()
      date = line.slice(colonIndex + 1).trim()
    }

    const lower = name.toLowerCase()
    let color = customColor
    let icon = '🗑️'

    if (lower.includes('bio') || lower.includes('grün') || lower.includes('kompost')) {
      if (!color) color = '#38a169'
      icon = '🍏'
    } else if (lower.includes('gelb') || lower.includes('wertstoff') || lower.includes('plastik') || lower.includes('sack')) {
      if (!color) color = '#d69e2e'
      icon = '♻️'
    } else if (lower.includes('papier') || lower.includes('blau') || lower.includes('pappe') || lower.includes('karton')) {
      if (!color) color = '#3182ce'
      icon = '📦'
    } else if (lower.includes('glas')) {
      if (!color) color = '#319795'
      icon = '🍾'
    } else {
      if (!color) color = '#718096'
      icon = '🗑️'
    }

    let badgeText = date || 'Geplant'
    let isUrgent = false
    const lowerDate = date.toLowerCase()
    if (lowerDate.includes('heute') || lowerDate.includes('morgen') || lowerDate === '1 tag' || lowerDate === 'in 1 tag') {
      isUrgent = true
    }

    const isoMatch = date.match(/^(\d{4})-(\d{2})-(\d{2})$/)
    if (isoMatch) {
      const target = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]))
      const now = new Date()
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
      const diffDays = Math.round((target.getTime() - startOfToday) / (1000 * 60 * 60 * 24))
      if (diffDays === 0) {
        badgeText = 'Heute!'
        isUrgent = true
      } else if (diffDays === 1) {
        badgeText = 'Morgen!'
        isUrgent = true
      } else if (diffDays > 1 && diffDays <= 7) {
        badgeText = `In ${diffDays} Tagen`
      } else if (diffDays > 7) {
        badgeText = `${isoMatch[3]}.${isoMatch[2]}.`
      }
    }

    return { name, date, color, icon, badgeText, isUrgent }
  })
}

export function wasteContent(widget: DashboardWidget) {
  const items = parseWasteItems(widget.wasteItems)
  const itemsHtml = items.map((item) => `
    <div class="waste-item ${item.isUrgent ? 'is-urgent' : ''}" style="--bin-color: ${escapeHtml(item.color)}">
      <div class="waste-bin-icon" aria-hidden="true">${item.icon}</div>
      <div class="waste-details">
        <strong class="waste-label">${escapeHtml(item.name)}</strong>
        <span class="waste-date-text">${escapeHtml(item.date)}</span>
      </div>
      <span class="waste-badge">${escapeHtml(item.badgeText)}</span>
    </div>
  `).join('')

  return `<div class="waste-widget-container" data-waste-widget>${itemsHtml}</div>`
}

export function energyContent(widget: DashboardWidget) {
  const solar = Number(widget.energySolar ?? 750)
  const house = Number(widget.energyHouse ?? 450)
  const grid = Number(widget.energyGrid ?? -300)
  const battery = Math.min(100, Math.max(0, Number(widget.energyBatteryPercent ?? 85)))
  const isExport = grid < 0

  return `<div class="energy-widget-container" data-energy-widget>
    <div class="energy-grid">
      <div class="energy-card energy-solar">
        <span class="energy-card-icon" aria-hidden="true">☀️</span>
        <span class="energy-card-label">Erzeugung</span>
        <strong class="energy-card-val" data-energy-field="solar">${solar} W</strong>
        <span class="energy-card-sub">PV / Balkonkraftwerk</span>
      </div>
      <div class="energy-card energy-house">
        <span class="energy-card-icon" aria-hidden="true">🏠</span>
        <span class="energy-card-label">Hausverbrauch</span>
        <strong class="energy-card-val" data-energy-field="house">${house} W</strong>
        <span class="energy-card-sub">Aktueller Bedarf</span>
      </div>
      <div class="energy-card energy-grid-flow ${isExport ? 'is-export' : 'is-import'}">
        <span class="energy-card-icon" aria-hidden="true">${isExport ? '🔄' : '⚡'}</span>
        <span class="energy-card-label">${isExport ? 'Einspeisung' : 'Netzbezug'}</span>
        <strong class="energy-card-val" data-energy-field="grid">${Math.abs(grid)} W</strong>
        <span class="energy-card-sub">${isExport ? 'ins Netz eingespeist' : 'vom Netz bezogen'}</span>
      </div>
      <div class="energy-card energy-battery">
        <span class="energy-card-icon" aria-hidden="true">🔋</span>
        <span class="energy-card-label">Batteriespeicher</span>
        <strong class="energy-card-val" data-energy-field="battery">${battery}%</strong>
        <div class="energy-battery-track" aria-hidden="true">
          <div class="energy-battery-fill" data-energy-field="battery-fill" style="width: ${battery}%"></div>
        </div>
      </div>
    </div>
  </div>`
}

export function mediaContent(widget: DashboardWidget) {
  const title = (widget.mediaTitle ?? 'Keine Wiedergabe').trim() || 'Keine Wiedergabe'
  const artist = (widget.mediaArtist ?? '').trim()
  const album = (widget.mediaAlbum ?? '').trim()
  const coverUrl = safeResourceUrl(widget.mediaCoverUrl ?? '', 'image')
  const isPlaying = widget.mediaPlaying !== false && title !== 'Keine Wiedergabe'

  return `<div class="media-widget-container ${isPlaying ? 'is-playing' : 'is-paused'}" data-media-widget>
    <div class="media-cover-wrapper">
      ${coverUrl ? `<img class="media-cover" src="${escapeHtml(coverUrl)}" alt="Cover" />` : '<div class="media-cover-placeholder" aria-hidden="true">🎵</div>'}
      <div class="media-badge-status" aria-hidden="true">${isPlaying ? '▶' : '⏸'}</div>
    </div>
    <div class="media-info">
      <strong class="media-title" data-media-field="title">${escapeHtml(title)}</strong>
      ${artist ? `<span class="media-artist" data-media-field="artist">${escapeHtml(artist)}</span>` : '<span class="media-artist" data-media-field="artist">Bereit</span>'}
      ${album ? `<span class="media-album" data-media-field="album">${escapeHtml(album)}</span>` : ''}
      <div class="media-equalizer-bars ${isPlaying ? 'is-animated' : ''}" aria-hidden="true">
        <span></span><span></span><span></span><span></span>
      </div>
    </div>
  </div>`
}

function safeResourceUrl(value: string, type: WidgetType) {
  const url = value.trim()
  if (!url) return ''
  if ((type === 'image' || type === 'slideshow') && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);/i.test(url)) return url

  try {
    const parsed = new URL(url, 'https://homepiboard.local')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

export function parseSlideshowUrls(content: string): string[] {
  return content
    .split(/[\r\n]+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
}

function frameContent(widget: DashboardWidget) {
  const url = safeResourceUrl(widget.url, widget.type)
  if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong><span>Bitte HTTP oder HTTPS verwenden.</span>'
  if (!url) return '<span class="placeholder-icon">↗</span><strong>URL fehlt</strong><span>Webseiten-URL eintragen</span>'

  const refreshAttr = widget.refreshIntervalMinutes && widget.refreshIntervalMinutes > 0
    ? ` data-refresh-interval="${widget.refreshIntervalMinutes}"`
    : ''

  return `<div class="frame-container"${refreshAttr}><iframe data-widget-frame src="${escapeHtml(url)}" title="${escapeHtml(widget.title)}" loading="lazy" scrolling="no" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-same-origin allow-scripts"></iframe><div class="frame-status" role="status"><span>Widget wird geladen …</span><button type="button" data-reload-frame>Neu laden</button></div></div>`
}

function slideshowContent(widget: DashboardWidget) {
  const rawUrls = parseSlideshowUrls(widget.url)
  const validUrls = rawUrls
    .map((url) => safeResourceUrl(url, 'slideshow'))
    .filter((url): url is string => Boolean(url))

  if (!validUrls.length) {
    return '<span class="placeholder-icon">▨</span><strong>Diashow</strong><span>Bild-URLs eintragen (eine pro Zeile)</span>'
  }

  const interval = widget.intervalSeconds || 8
  const slidesHtml = validUrls.map((url, i) =>
    `<div class="slideshow-slide ${i === 0 ? 'is-active' : ''}" style="background-image: url('${escapeHtml(url)}')"><img class="visually-hidden" src="${escapeHtml(url)}" alt="${escapeHtml(widget.title)} (Bild ${i + 1})" /></div>`
  ).join('')

  const indicatorsHtml = validUrls.length > 1
    ? `<div class="slideshow-indicators">${validUrls.map((_, i) => `<span class="slideshow-dot ${i === 0 ? 'is-active' : ''}"></span>`).join('')}</div>`
    : ''

  return `<div class="slideshow-container" data-slideshow-widget data-slideshow-interval="${interval}">${slidesHtml}${indicatorsHtml}</div>`
}

function calendarFeedContent(widget: DashboardWidget) {
  return `<div class="calendar-feed" data-calendar-feed data-calendar-widget-id="${escapeHtml(widget.id)}"><div class="calendar-feed-status" role="status">Kalender wird geladen …</div></div>`
}

function eventDateLabel(event: CalendarFeedEvent) {
  const start = new Date(event.start)
  if (event.allDay) return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit' }).format(start)
  return new Intl.DateTimeFormat('de-DE', { weekday: 'short', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }).format(start)
}

export function calendarAgendaMarkup(events: CalendarFeedEvent[], now = new Date()) {
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const upcoming = events
    .filter((event) => new Date(event.end || event.start).getTime() >= startOfToday)
    .slice(0, 40)
  if (!upcoming.length) return '<div class="calendar-feed-empty" role="status">Keine anstehenden Termine.</div>'

  return `<ol class="calendar-agenda">${upcoming.map((event) => `<li class="calendar-agenda-event"><time datetime="${escapeHtml(event.start)}">${escapeHtml(eventDateLabel(event))}</time><div><strong>${escapeHtml(event.summary)}</strong>${event.location ? `<span>${escapeHtml(event.location)}</span>` : ''}</div></li>`).join('')}</ol>`
}

export function isBuiltInCalendar(type: WidgetType, url: string) {
  return type === 'calendar' && !url.trim()
}

export function renderWidgetContent(widget: DashboardWidget) {
  if (widget.type === 'calendar') return isBuiltInCalendar(widget.type, widget.url) ? calendarMarkup() : calendarFeedContent(widget)
  if (widget.type === 'text') return `<p class="text-widget-content">${escapeHtml(widget.url || 'Deinen Text hier eintragen')}</p>`
  if (widget.type === 'image') {
    const url = safeResourceUrl(widget.url, widget.type)
    if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong>'
    return url
      ? `<img class="image-widget-content" src="${escapeHtml(url)}" alt="${escapeHtml(widget.title)}" />`
      : '<span class="placeholder-icon">▧</span><strong>Bild-URL fehlt</strong>'
  }
  if (widget.type === 'slideshow') return slideshowContent(widget)
  if (widget.type === 'waste') return wasteContent(widget)
  if (widget.type === 'energy') return energyContent(widget)
  if (widget.type === 'media') return mediaContent(widget)
  return frameContent(widget)
}

export function renderSlideshowCrudList(urls: string[]): string {
  if (urls.length === 0) {
    return '<div class="slideshow-empty-state">Noch keine Bilder hinzugefügt. Lade oben Bilder hoch (max. 10) oder füge Bild-URLs ein.</div>'
  }
  return urls.map((url, i) => {
    let displayName = url
    try {
      const parsed = new URL(url, 'http://localhost')
      displayName = parsed.pathname.split('/').filter(Boolean).pop() || url
    } catch {
      displayName = url.slice(0, 30)
    }
    return `<div class="slideshow-image-item" data-index="${i}">
      <span class="image-order">#${i + 1}</span>
      <img class="image-thumb" src="${escapeHtml(url)}" alt="Bild ${i + 1}" loading="lazy" onerror="this.style.opacity='0.3'" />
      <span class="image-name" title="${escapeHtml(url)}">${escapeHtml(displayName)}</span>
      <div class="image-item-actions">
        <button type="button" class="icon-button" data-action="slide-up" data-index="${i}" title="Nach oben" ${i === 0 ? 'disabled' : ''}>↑</button>
        <button type="button" class="icon-button" data-action="slide-down" data-index="${i}" title="Nach unten" ${i === urls.length - 1 ? 'disabled' : ''}>↓</button>
        <button type="button" class="icon-button danger-button" data-action="slide-delete" data-index="${i}" title="Bild löschen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </div>`
  }).join('')
}

function editorMarkup(widget: DashboardWidget, index: number) {
  const widgetIdToken = [...widget.id].map((character) => character.codePointAt(0)!.toString(36)).join('-') || 'empty'
  const controlId = `widget-editor-${widgetIdToken}`
  const urlPlaceholder = widget.type === 'text'
    ? 'Text eingeben'
    : widget.type === 'slideshow'
      ? 'https://example.com/bild1.jpg\nhttps://example.com/bild2.jpg'
      : 'https://example.com'
  const urlLabel = widget.type === 'slideshow' ? 'Bild-URLs (eine pro Zeile)' : 'Inhalt / URL'

  const extraSettingField = widget.type === 'web'
    ? `<label class="refresh-field" for="${controlId}-refresh">Aktualisierung<span>in Minuten (0 = aus)</span><input id="${controlId}-refresh" data-field="refreshIntervalMinutes" type="number" min="0" max="1440" value="${widget.refreshIntervalMinutes || 0}" /></label>`
    : widget.type === 'slideshow'
      ? `<label class="interval-field" for="${controlId}-interval">Wechsel<span>in Sekunden</span><input id="${controlId}-interval" data-field="intervalSeconds" type="number" min="2" max="3600" value="${widget.intervalSeconds || 8}" /></label>`
      : ''

  const slideshowUrls = widget.type === 'slideshow' ? parseSlideshowUrls(widget.url) : []

  return `<article class="widget-editor" data-widget-id="${escapeHtml(widget.id)}" data-columns="${widget.columns}" data-rows="${widget.rows}" ${widget.breakBefore ? 'data-break-before="true"' : ''} style="--widget-columns: ${widget.columns}; --widget-rows: ${widget.rows}">
    <header class="widget-card-header">
      <button class="drag-handle" type="button" draggable="true" aria-label="Widget ${index + 1} anordnen" title="Widget verschieben (anfassen und ziehen)">⠿</button>
      <div class="widget-card-title"><span class="widget-number">#${index + 1}</span><strong data-editor-title>${escapeHtml(widget.title)}</strong></div>
      <span class="type-badge" data-type-badge>${typeLabels[widget.type]}</span>
      <span class="dimension-label" id="${controlId}-dimensions" data-dimension-label aria-live="polite" aria-atomic="true">${widget.columns} × ${widget.rows}</span>
      <div class="widget-card-actions">
        <button class="icon-button toggle-editor" type="button" data-action="toggle" aria-expanded="false" aria-controls="${controlId}-dialog" title="Einstellungen bearbeiten (Typ, Titel, URL)">⚙</button>
        <button class="icon-button" type="button" data-action="move-left" aria-label="Widget nach links verschieben" title="Nach links">←</button>
        <button class="icon-button" type="button" data-action="move-right" aria-label="Widget nach rechts verschieben" title="Nach rechts">→</button>
        <button class="icon-button" type="button" data-action="move-up" aria-label="Widget eine Zeile nach oben verschieben" title="Zeile nach oben">↑</button>
        <button class="icon-button" type="button" data-action="move-down" aria-label="Widget eine Zeile nach unten verschieben" title="Zeile nach unten">↓</button>
        <button class="icon-button" type="button" data-action="duplicate" aria-label="Widget duplizieren" title="Duplizieren">⧉</button>
        <button class="icon-button danger-button" type="button" data-action="remove" aria-label="Widget löschen" title="Widget löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
      </div>
    </header>
    <div class="widget-card-body" id="${controlId}-body">
      <div class="widget-preview${widget.showTitle ? ' has-title' : ''}" data-widget-preview aria-label="Vorschau ${escapeHtml(widget.title)}">
        <div class="widget-preview-content" data-widget-preview-content>
          ${widget.showTitle ? `<header class="kiosk-widget-header preview-header"><h2 class="kiosk-widget-title">${escapeHtml(widget.title)}</h2></header>` : ''}
          <div class="iframe-placeholder">${renderWidgetContent(widget)}</div>
        </div>
      </div>
    </div>
    <button class="widget-resize-handle" type="button" data-resize-handle aria-label="Widgetgröße ziehen. Pfeiltasten ändern Breite und Höhe." aria-describedby="${controlId}-dimensions" title="Ecke ziehen, um Größe anzupassen (Breite &amp; Höhe)">
      <output class="widget-resize-readout" data-resize-readout aria-hidden="true">${widget.columns} × ${widget.rows}</output>
      <svg class="resize-handle-icon" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="12" y1="2" x2="2" y2="12"/><line x1="12" y1="6" x2="6" y2="12"/><line x1="12" y1="10" x2="10" y2="12"/></svg>
    </button>
    <dialog class="widget-dialog" id="${controlId}-dialog" data-widget-dialog>
      <div class="dialog-content">
        <div class="dialog-heading">
          <div><span class="widget-kicker">Widget ${index + 1}</span><h2 data-dialog-title>${escapeHtml(widget.title)}</h2></div>
          <button class="close-button" type="button" data-action="close-dialog" aria-label="Schließen">×</button>
        </div>
        <div class="dialog-form-fields">
          <label for="${controlId}-type">Typ<select id="${controlId}-type" data-field="type">
            <option value="web" ${widget.type === 'web' ? 'selected' : ''}>Webseite</option>
            <option value="calendar" ${widget.type === 'calendar' ? 'selected' : ''}>Kalender</option>
            <option value="text" ${widget.type === 'text' ? 'selected' : ''}>Text</option>
            <option value="image" ${widget.type === 'image' ? 'selected' : ''}>Bild</option>
            <option value="slideshow" ${widget.type === 'slideshow' ? 'selected' : ''}>Diashow</option>
            <option value="waste" ${widget.type === 'waste' ? 'selected' : ''}>Müllkalender</option>
            <option value="energy" ${widget.type === 'energy' ? 'selected' : ''}>Energie / PV</option>
            <option value="media" ${widget.type === 'media' ? 'selected' : ''}>Media-Player</option>
          </select></label>
          <label for="${controlId}-title">Titel<input id="${controlId}-title" data-field="title" value="${escapeHtml(widget.title)}" maxlength="30" /></label>
          <label class="content-field checkbox-label" for="${controlId}-show-title"><input type="checkbox" id="${controlId}-show-title" data-field="showTitle" ${widget.showTitle ? 'checked' : ''} /><span>Titel in der Anzeige anzeigen</span></label>
          ${widget.type === 'waste' ? `
          <label class="content-field" for="${controlId}-waste"><span data-content-label>Abholtermine (Format: Tonne: Datum oder z.B. In 2 Tagen, eine pro Zeile)</span><textarea id="${controlId}-waste" data-field="wasteItems" rows="5" placeholder="Restmüll: In 2 Tagen&#10;Biomüll: Donnerstag&#10;Gelber Sack: 2026-10-02&#10;Papiermüll: In 10 Tagen">${escapeHtml(widget.wasteItems || '')}</textarea></label>
          <input type="hidden" id="${controlId}-url" data-field="url" value="${escapeHtml(widget.url)}" />
          ` : widget.type === 'energy' ? `
          <div class="energy-form-group">
            <label for="${controlId}-solar">Solarerzeugung (W)<input id="${controlId}-solar" data-field="energySolar" type="number" min="0" value="${widget.energySolar ?? 750}" /></label>
            <label for="${controlId}-house">Hausverbrauch (W)<input id="${controlId}-house" data-field="energyHouse" type="number" min="0" value="${widget.energyHouse ?? 450}" /></label>
            <label for="${controlId}-grid">Netz (W, neg. = Einspeisung)<input id="${controlId}-grid" data-field="energyGrid" type="number" value="${widget.energyGrid ?? -300}" /></label>
            <label for="${controlId}-battery">Akkustand (%)<input id="${controlId}-battery" data-field="energyBatteryPercent" type="number" min="0" max="100" value="${widget.energyBatteryPercent ?? 85}" /></label>
          </div>
          <p class="editor-field-hint">💡 Live-Werte können per HTTP <code>POST /api/energy</code> aktualisiert werden.</p>
          <input type="hidden" id="${controlId}-url" data-field="url" value="${escapeHtml(widget.url)}" />
          ` : widget.type === 'media' ? `
          <div class="media-form-group">
            <label for="${controlId}-media-title">Titel<input id="${controlId}-media-title" data-field="mediaTitle" value="${escapeHtml(widget.mediaTitle || '')}" placeholder="Songtitel" /></label>
            <label for="${controlId}-media-artist">Künstler<input id="${controlId}-media-artist" data-field="mediaArtist" value="${escapeHtml(widget.mediaArtist || '')}" placeholder="Künstler" /></label>
            <label for="${controlId}-media-album">Album<input id="${controlId}-media-album" data-field="mediaAlbum" value="${escapeHtml(widget.mediaAlbum || '')}" placeholder="Album" /></label>
            <label for="${controlId}-media-cover">Cover-Bild URL<input id="${controlId}-media-cover" data-field="mediaCoverUrl" type="url" value="${escapeHtml(widget.mediaCoverUrl || '')}" placeholder="https://..." /></label>
            <label class="content-field checkbox-label" for="${controlId}-media-playing"><input type="checkbox" id="${controlId}-media-playing" data-field="mediaPlaying" ${widget.mediaPlaying !== false ? 'checked' : ''} /><span>Wiedergabe aktiv (animierter Equalizer)</span></label>
          </div>
          <p class="editor-field-hint">💡 Live-Status kann per HTTP <code>POST /api/media</code> aktualisiert werden.</p>
          <input type="hidden" id="${controlId}-url" data-field="url" value="${escapeHtml(widget.url)}" />
          ` : `
          ${(widget.type === 'image' || widget.type === 'slideshow') ? `<div class="content-field upload-field"><label class="upload-zone" for="${controlId}-upload"><input type="file" id="${controlId}-upload" data-action="upload" accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml" ${widget.type === 'slideshow' ? 'multiple' : ''} style="display: none;" /><span class="upload-btn"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span>${widget.type === 'slideshow' ? 'Bilder hochladen (max. 10 Bilder, je max. 5 MB)' : 'Bild hochladen (max. 5 MB)'}</span></span><span class="upload-status" data-upload-status aria-live="polite"></span></label></div>` : ''}
          ${widget.type === 'image' && widget.url ? `
          <div class="single-image-item" data-single-image-item>
            <img class="single-image-thumb" src="${escapeHtml(widget.url)}" alt="Aktuelles Bild" onerror="this.style.opacity='0.3'" />
            <span class="single-image-name" title="${escapeHtml(widget.url)}">${escapeHtml(widget.url)}</span>
            <button type="button" class="icon-button danger-button" data-action="clear-image" title="Bild entfernen"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg></button>
          </div>
          ` : ''}
          ${widget.type === 'slideshow' ? `
          <div class="slideshow-crud-section" data-slideshow-crud>
            <div class="slideshow-crud-header">
              <span class="slideshow-count-badge" data-slideshow-count>Bilder (${slideshowUrls.length} / 10)</span>
            </div>
            <div class="slideshow-crud-list" data-slideshow-list>
              ${renderSlideshowCrudList(slideshowUrls)}
            </div>
            <div class="slideshow-add-url-row">
              <input type="url" class="slideshow-url-input" data-slideshow-url-input placeholder="https://example.com/bild.jpg" />
              <button type="button" class="slideshow-add-url-btn" data-action="add-slideshow-url">+ URL hinzufügen</button>
            </div>
          </div>
          <details class="raw-urls-details">
            <summary>URLs manuell bearbeiten (Textform)</summary>
            <label class="content-field" for="${controlId}-url"><span data-content-label>${urlLabel}</span><textarea id="${controlId}-url" data-field="url" rows="3" placeholder="${urlPlaceholder}">${escapeHtml(widget.url)}</textarea></label>
          </details>
          ` : `
          <label class="content-field" for="${controlId}-url"><span data-content-label>${urlLabel}</span><textarea id="${controlId}-url" data-field="url" rows="3" placeholder="${urlPlaceholder}">${escapeHtml(widget.url)}</textarea></label>
          `}
          ${extraSettingField}
          `}
          <label class="content-field checkbox-label" for="${controlId}-break"><input type="checkbox" id="${controlId}-break" data-field="breakBefore" ${widget.breakBefore ? 'checked' : ''} /><span>In neuer Zeile beginnen (unterhalb vorheriger Widgets)</span></label>
          <input type="hidden" id="${controlId}-columns" data-field="columns" value="${widget.columns}" />
          <input type="hidden" id="${controlId}-rows" data-field="rows" value="${widget.rows}" />
        </div>
        <div class="dialog-actions">
          <button class="dialog-delete-btn danger-button" type="button" data-action="remove-dialog" title="Widget löschen"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></svg><span>Widget löschen</span></button>
          <button class="secondary-button" type="button" data-action="close-dialog">Abbrechen</button>
          <button class="save-button" type="button" data-action="save-dialog">Fertig</button>
        </div>
      </div>
    </dialog>
  </article>`
}

export function renderWidget(widget: DashboardWidget, editable = false, index = 0) {
  if (editable) return editorMarkup(widget, index)

  const colStyle = widget.breakBefore ? `grid-column: 1 / span ${widget.columns};` : `grid-column: span ${widget.columns};`
  const titleHeader = widget.showTitle
    ? `<header class="kiosk-widget-header"><h2 class="kiosk-widget-title">${escapeHtml(widget.title)}</h2></header>`
    : `<h2 class="visually-hidden">${escapeHtml(widget.title)}</h2>`
  return `<article class="widget kiosk-widget${widget.showTitle ? ' has-title' : ''}" ${widget.breakBefore ? 'data-break-before="true"' : ''} style="${colStyle} grid-row: span ${widget.rows};" aria-label="${escapeHtml(widget.title)}">${titleHeader}<div class="iframe-placeholder">${renderWidgetContent(widget)}</div></article>`
}

export function widgetTypeLabel(type: WidgetType) {
  return typeLabels[type]
}

export function bindWidgetFrames(root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>('.frame-container').forEach((container) => {
    if (container.dataset.frameBound === 'true') return
    container.dataset.frameBound = 'true'
    const frame = container.querySelector<HTMLIFrameElement>('[data-widget-frame]')
    const reload = container.querySelector<HTMLButtonElement>('[data-reload-frame]')
    if (!frame || !reload) return

    let timer = 0
    const startLoading = () => {
      window.clearTimeout(timer)
      container.classList.remove('is-loaded', 'is-slow')
      timer = window.setTimeout(() => container.classList.add('is-slow'), 8000)
    }
    const markLoaded = () => {
      window.clearTimeout(timer)
      container.classList.add('is-loaded')
      container.classList.remove('is-slow')
    }

    frame.addEventListener('load', markLoaded)
    reload.addEventListener('click', () => {
      startLoading()
      frame.src = frame.src
    })
    startLoading()

    const refreshIntervalMinutes = Number(container.dataset.refreshInterval) || 0
    if (refreshIntervalMinutes > 0) {
      window.setInterval(() => {
        startLoading()
        frame.src = frame.src
      }, refreshIntervalMinutes * 60 * 1000)
    }
  })

  root.querySelectorAll<HTMLElement>('[data-slideshow-widget]').forEach((container) => {
    if (container.dataset.slideshowBound === 'true') return
    container.dataset.slideshowBound = 'true'
    const slides = container.querySelectorAll<HTMLElement>('.slideshow-slide')
    const dots = container.querySelectorAll<HTMLElement>('.slideshow-dot')
    if (slides.length <= 1) return

    const intervalSeconds = Math.max(2, Number(container.dataset.slideshowInterval) || 8)
    let currentIndex = 0

    window.setInterval(() => {
      slides[currentIndex]?.classList.remove('is-active')
      dots[currentIndex]?.classList.remove('is-active')
      currentIndex = (currentIndex + 1) % slides.length
      slides[currentIndex]?.classList.add('is-active')
      dots[currentIndex]?.classList.add('is-active')
    }, intervalSeconds * 1000)
  })

  root.querySelectorAll<HTMLElement>('[data-calendar-feed]').forEach((container) => {
    if (container.dataset.calendarBound === 'true') return
    container.dataset.calendarBound = 'true'
    const widgetId = container.dataset.calendarWidgetId
    if (!widgetId) return

    void fetch(`/api/calendar/${encodeURIComponent(widgetId)}`, { cache: 'no-store' })
      .then(async (response) => {
        const body = await response.json() as { events?: CalendarFeedEvent[]; error?: string }
        if (!response.ok) throw new Error(body.error || 'Kalender konnte nicht geladen werden.')
        container.innerHTML = calendarAgendaMarkup(Array.isArray(body.events) ? body.events : [])
      })
      .catch((error: unknown) => {
        const message = error instanceof Error ? error.message : 'Kalender konnte nicht geladen werden.'
        container.innerHTML = `<div class="calendar-feed-error" role="alert"><strong>Kalender konnte nicht geladen werden.</strong><span>${escapeHtml(message)}</span></div>`
      })
  })
}