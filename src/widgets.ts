import { calendarMarkup, escapeHtml } from './dashboard-utils.ts'
import { widgetConstraints, type DashboardWidget, type WidgetType } from './settings.ts'

const typeLabels: Record<WidgetType, string> = {
  web: 'WEB',
  calendar: 'KALENDER',
  text: 'TEXT',
  image: 'BILD',
}

function safeResourceUrl(value: string, type: WidgetType) {
  const url = value.trim()
  if (!url) return ''
  if (type === 'image' && /^data:image\/(?:png|jpeg|gif|webp|svg\+xml);/i.test(url)) return url

  try {
    const parsed = new URL(url, 'https://homepiboard.local')
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null
    return url
  } catch {
    return null
  }
}

function frameContent(widget: DashboardWidget) {
  const url = safeResourceUrl(widget.url, widget.type)
  if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong><span>Bitte HTTP oder HTTPS verwenden.</span>'
  if (!url) return '<span class="placeholder-icon">↗</span><strong>URL fehlt</strong><span>Webseiten-URL eintragen</span>'

  return `<div class="frame-container"><iframe data-widget-frame src="${escapeHtml(url)}" title="${escapeHtml(widget.title)}" loading="lazy" scrolling="no" referrerpolicy="no-referrer" sandbox="allow-forms allow-popups allow-same-origin allow-scripts"></iframe><div class="frame-status" role="status"><span>Widget wird geladen …</span><button type="button" data-reload-frame>Neu laden</button></div></div>`
}

export function renderWidgetContent(widget: DashboardWidget) {
  if (widget.type === 'calendar') return widget.url ? frameContent(widget) : calendarMarkup()
  if (widget.type === 'text') return `<p class="text-widget-content">${escapeHtml(widget.url || 'Deinen Text hier eintragen')}</p>`
  if (widget.type === 'image') {
    const url = safeResourceUrl(widget.url, widget.type)
    if (url === null) return '<span class="placeholder-icon">!</span><strong>URL nicht erlaubt</strong>'
    return url
      ? `<img class="image-widget-content" src="${escapeHtml(url)}" alt="${escapeHtml(widget.title)}" />`
      : '<span class="placeholder-icon">▧</span><strong>Bild-URL fehlt</strong>'
  }
  return frameContent(widget)
}

function editorMarkup(widget: DashboardWidget, index: number) {
  const constraints = widgetConstraints[widget.type]
  const widgetIdToken = [...widget.id].map((character) => character.codePointAt(0)!.toString(36)).join('-') || 'empty'
  const controlId = `widget-editor-${widgetIdToken}`

  return `<article class="widget-editor" draggable="true" data-widget-id="${escapeHtml(widget.id)}" data-columns="${widget.columns}" data-rows="${widget.rows}">
    <header class="widget-card-header">
      <button class="drag-handle" type="button" aria-label="Widget ${index + 1} ziehen" title="Mit der Maus ziehen">⠿</button>
      <div class="widget-card-title"><span class="widget-number">Widget ${index + 1}</span><strong data-editor-title>${escapeHtml(widget.title)}</strong></div>
      <span class="type-badge" data-type-badge>${typeLabels[widget.type]}</span>
      <span class="dimension-label" data-dimension-label>${widget.columns} × ${widget.rows}</span>
      <div class="widget-card-actions">
        <button class="icon-button" type="button" data-action="move-up" aria-label="Widget nach oben verschieben" title="Nach oben">↑</button>
        <button class="icon-button" type="button" data-action="move-down" aria-label="Widget nach unten verschieben" title="Nach unten">↓</button>
        <button class="icon-button" type="button" data-action="duplicate" aria-label="Widget duplizieren" title="Duplizieren">⧉</button>
        <button class="icon-button danger-button" type="button" data-action="remove" aria-label="Widget entfernen" title="Entfernen">×</button>
        <button class="icon-button toggle-editor" type="button" data-action="toggle" aria-expanded="true" aria-controls="${controlId}-body" title="Editor ein- oder ausklappen">⌃</button>
      </div>
    </header>
    <div class="widget-card-body" id="${controlId}-body">
      <div class="widget-preview" data-widget-preview aria-label="Vorschau ${escapeHtml(widget.title)}"><div class="iframe-placeholder">${renderWidgetContent(widget)}</div></div>
      <div class="widget-edit-panel">
        <label for="${controlId}-type">Typ<select id="${controlId}-type" data-field="type"><option value="web" ${widget.type === 'web' ? 'selected' : ''}>Webseite</option><option value="calendar" ${widget.type === 'calendar' ? 'selected' : ''}>Kalender</option><option value="text" ${widget.type === 'text' ? 'selected' : ''}>Text</option><option value="image" ${widget.type === 'image' ? 'selected' : ''}>Bild</option></select></label>
        <label for="${controlId}-title">Titel<input id="${controlId}-title" data-field="title" value="${escapeHtml(widget.title)}" maxlength="30" /></label>
        <label class="content-field" for="${controlId}-url">Inhalt / URL<textarea id="${controlId}-url" data-field="url" rows="3" placeholder="${widget.type === 'text' ? 'Text eingeben' : 'https://example.com'}">${escapeHtml(widget.url)}</textarea></label>
        <fieldset class="size-fields"><legend>Größe im 24 × 8 Raster</legend><label for="${controlId}-columns">Breite<input id="${controlId}-columns" data-field="columns" type="number" inputmode="numeric" min="${constraints.minColumns}" max="24" step="1" value="${widget.columns}" /></label><label for="${controlId}-rows">Höhe<input id="${controlId}-rows" data-field="rows" type="number" inputmode="numeric" min="${constraints.minRows}" max="8" step="1" value="${widget.rows}" /></label></fieldset>
      </div>
    </div>
  </article>`
}

export function renderWidget(widget: DashboardWidget, editable = false, index = 0) {
  if (editable) return editorMarkup(widget, index)

  return `<article class="widget kiosk-widget" style="grid-column: span ${widget.columns}; grid-row: span ${widget.rows};" aria-label="${escapeHtml(widget.title)}"><h2 class="visually-hidden">${escapeHtml(widget.title)}</h2><div class="iframe-placeholder">${renderWidgetContent(widget)}</div></article>`
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
  })
}