import './style.css'

type WebWidget = { id: string; title: string; url: string; columns: number; rows: number }
type DisplaySettings = { location: string; weatherCity: string; widgets: WebWidget[] }

const defaultSettings: DisplaySettings = { location: 'Zuhause', weatherCity: '', widgets: [] }
const settingsKey = 'homeboard-settings'

function loadSettings(): DisplaySettings {
  const storedSettings = localStorage.getItem(settingsKey)
  if (!storedSettings) return { ...defaultSettings }

  try {
    const parsed = JSON.parse(storedSettings) as Partial<DisplaySettings> & { url?: string; size?: string }
    const widgets: WebWidget[] = Array.isArray(parsed.widgets)
      ? parsed.widgets.map((widget, index) => ({
          id: widget.id || `widget-${index + 1}`,
          title: widget.title || `Web-Widget ${index + 1}`,
          url: widget.url || '',
          columns: Math.max(1, Math.min(12, Number(widget.columns) || 6)),
          rows: Math.max(1, Math.min(4, Number(widget.rows) || 1)),
        }))
      : parsed.url
        ? [{ id: 'widget-1', title: 'Web-Widget', url: parsed.url, columns: parsed.size === 'wide' ? 12 : 6, rows: parsed.size === 'tall' ? 2 : 1 }]
        : []
    return { location: parsed.location || defaultSettings.location, weatherCity: parsed.weatherCity || '', widgets }
  } catch {
    localStorage.removeItem(settingsKey)
    return { ...defaultSettings }
  }
}

function saveSettings(settings: DisplaySettings) {
  localStorage.setItem(settingsKey, JSON.stringify(settings))
}

function weatherSymbol(code: number) {
  if (code === 0) return 'klar'
  if (code <= 3) return 'bewölkt'
  if (code <= 67) return 'Regen'
  if (code <= 77) return 'Schnee'
  return 'Gewitter'
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function renderWidget(widget: WebWidget, editable = false, index = 0) {
  const content = widget.url
    ? `<iframe src="${escapeHtml(widget.url)}" title="${escapeHtml(widget.title)}" loading="lazy" scrolling="no"></iframe>`
    : '<span class="placeholder-icon">↗</span><strong>URL fehlt</strong><span>In der Admin-Seite konfigurieren</span>'
  const editor = editable ? `<div class="widget-edit-panel"><div class="widget-editor-top"><strong>⠿ Widget ${index + 1}</strong><span class="dimension-label">${widget.columns} × ${widget.rows}</span></div><label>Titel<input data-field="title" value="${escapeHtml(widget.title)}" maxlength="30" /></label><label>URL<input data-field="url" type="url" value="${escapeHtml(widget.url)}" placeholder="https://example.com" /></label></div><span class="resize-handle" title="Widget-Größe ziehen" aria-label="Widget-Größe ziehen"></span>` : ''
  const removeButton = editable ? `<button class="card-remove remove-widget" type="button" data-remove-id="${escapeHtml(widget.id)}" aria-label="Widget entfernen">×</button>` : ''
  return `<article class="widget iframe-widget${editable ? ' admin-widget widget-editor' : ' kiosk-widget'}" style="grid-column: span ${widget.columns}; grid-row: span ${widget.rows};"${editable ? ` draggable="true" data-widget-id="${escapeHtml(widget.id)}" data-columns="${widget.columns}" data-rows="${widget.rows}"` : ''}><div class="widget-heading"><span>${escapeHtml(widget.title)}</span><span class="live-dot">LIVE</span>${removeButton}</div><div class="iframe-placeholder">${content}</div>${editor}</article>`
}

function renderDisplayPage() {
  const settings = loadSettings()
  const widgets = settings.widgets.length ? settings.widgets.map((widget) => renderWidget(widget)).join('') : '<div class="empty-display"><span class="widget-kicker">Noch keine Widgets</span><a href="/admin">Admin öffnen <span>↗</span></a></div>'
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="signage-shell">
    <header class="header-bar"><div class="brand-mark"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></div><div class="header-status"><span>${escapeHtml(settings.location)}</span><span class="status-divider"></span><span class="weather-status" id="weather"></span><time id="date">--.--.----</time><strong id="clock">--:--</strong><a class="settings-button" href="/admin" aria-label="Anzeige konfigurieren">⚙</a></div></header>
    <section class="widget-grid" aria-label="Anzeigen-Widgets">${widgets}</section>
  </main>`

  const clock = document.querySelector<HTMLElement>('#clock')!
  const date = document.querySelector<HTMLElement>('#date')!
  const weather = document.querySelector<HTMLElement>('#weather')!
  function updateTime() {
    const now = new Date()
    clock.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    date.textContent = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }
  updateTime()
  window.setInterval(updateTime, 1000)
  if (settings.weatherCity) loadWeather(settings.weatherCity, weather)
}

async function loadWeather(city: string, target: HTMLElement) {
  try {
    const search = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`)
    const places = await search.json() as { results?: Array<{ latitude: number; longitude: number }> }
    const place = places.results?.[0]
    if (!place) return
    const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&timezone=auto`)
    const data = await forecast.json() as { current?: { temperature_2m: number; weather_code: number } }
    if (data.current) target.textContent = `${Math.round(data.current.temperature_2m)}° · ${weatherSymbol(data.current.weather_code)}`
  } catch {
    target.textContent = ''
  }
}

function renderWidgetEditor(widget: WebWidget, index: number) {
  return renderWidget(widget, true, index)
}

function renderAdminPage() {
  const settings = loadSettings()
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<main class="admin-shell"><header class="admin-header"><a class="brand-mark" href="/"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></a><a class="back-link" href="/">Anzeige öffnen <span>↗</span></a></header><section class="admin-content"><div class="admin-intro"><div><span class="widget-kicker">Live-Layout</span><h1>Anzeige <em>bearbeiten.</em></h1></div><p>Widgets ziehen, Größe anpassen und Layout speichern.</p></div><form class="admin-form" id="admin-form"><div class="admin-global-fields"><label>Bezeichnung <span>Text im Header</span><input id="admin-location" maxlength="24" value="${escapeHtml(settings.location)}" /></label><label>Wetterort <span>Optional, zum Beispiel Berlin</span><input id="admin-weather-city" maxlength="40" value="${escapeHtml(settings.weatherCity)}" placeholder="Berlin" /></label></div><div class="widget-editors" id="widget-editors">${settings.widgets.map(renderWidgetEditor).join('')}</div><button class="add-widget" id="add-widget" type="button">+ Web-Widget hinzufügen</button><div class="admin-actions"><button class="reset-button" id="reset-button" type="button">Zurücksetzen</button><button class="save-button" type="submit">Speichern</button></div><p class="save-message" id="save-message" role="status"></p></form></section></main>`

  const editorList = document.querySelector<HTMLElement>('#widget-editors')!
  const message = document.querySelector<HTMLElement>('#save-message')!
  const weatherCityInput = document.querySelector<HTMLInputElement>('#admin-weather-city')!
  document.querySelector<HTMLButtonElement>('#add-widget')!.addEventListener('click', () => {
    const nextWidget: WebWidget = { id: `widget-${Date.now()}`, title: `Web-Widget ${editorList.children.length + 1}`, url: '', columns: 6, rows: 1 }
    editorList.insertAdjacentHTML('beforeend', renderWidgetEditor(nextWidget, editorList.children.length))
    bindEditorInteractions()
  })

  function bindEditorInteractions() {
    editorList.querySelectorAll<HTMLButtonElement>('[data-remove-id]').forEach((button) => {
      const editor = button.closest<HTMLElement>('.widget-editor')
      if (!editor || editor.dataset.interactionsBound === 'true') return
      button.onclick = (event) => {
        event.preventDefault()
        event.stopPropagation()
        editor.remove()
      }
    })
    editorList.querySelectorAll<HTMLElement>('.widget-editor').forEach((editor) => {
      if (editor.dataset.interactionsBound === 'true') return
      editor.dataset.interactionsBound = 'true'
      editor.querySelectorAll<HTMLElement>('input, button, select').forEach((control) => {
        control.addEventListener('pointerdown', (event) => event.stopPropagation())
      })
      editor.addEventListener('dragstart', (event) => {
        editor.classList.add('is-dragging')
        event.dataTransfer?.setData('text/plain', editor.dataset.widgetId || '')
      })
      editor.addEventListener('dragend', () => editor.classList.remove('is-dragging'))
      editor.addEventListener('dragover', (event) => {
        event.preventDefault()
        editor.classList.add('is-drop-target')
      })
      editor.addEventListener('dragleave', () => editor.classList.remove('is-drop-target'))
      editor.addEventListener('drop', (event) => {
        event.preventDefault()
        editor.classList.remove('is-drop-target')
        const sourceId = event.dataTransfer?.getData('text/plain')
        const source = sourceId ? editorList.querySelector<HTMLElement>(`[data-widget-id="${CSS.escape(sourceId)}"]`) : null
        if (source && source !== editor) editorList.insertBefore(source, editor)
      })
      editor.querySelector<HTMLElement>('.resize-handle')?.addEventListener('pointerdown', (event) => {
        event.preventDefault()
        event.stopPropagation()
        const startX = event.clientX
        const startY = event.clientY
        const startColumns = Number(editor.dataset.columns) || 6
        const startRows = Number(editor.dataset.rows) || 1
        const gridStyle = getComputedStyle(editorList)
        const gap = Number.parseFloat(gridStyle.columnGap) || 16
        const columnWidth = (editorList.clientWidth - gap * 11) / 12
        const rowHeight = 316
        const move = (moveEvent: PointerEvent) => {
          const columns = Math.max(1, Math.min(12, startColumns + Math.round((moveEvent.clientX - startX) / (columnWidth + gap))))
          const rows = Math.max(1, Math.min(4, startRows + Math.round((moveEvent.clientY - startY) / rowHeight)))
          editor.dataset.columns = String(columns)
          editor.dataset.rows = String(rows)
          editor.style.gridColumn = `span ${columns}`
          editor.style.gridRow = `span ${rows}`
          editor.querySelector<HTMLElement>('.dimension-label')!.textContent = `${columns} × ${rows}`
        }
        const stop = () => {
          window.removeEventListener('pointermove', move)
          window.removeEventListener('pointerup', stop)
        }
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', stop, { once: true })
      })
    })
  }
  bindEditorInteractions()

  document.querySelector<HTMLFormElement>('#admin-form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    const widgets = [...editorList.querySelectorAll<HTMLElement>('.widget-editor')].map((editor) => ({
      id: editor.dataset.widgetId!,
      title: editor.querySelector<HTMLInputElement>('[data-field="title"]')!.value.trim() || 'Web-Widget',
      url: editor.querySelector<HTMLInputElement>('[data-field="url"]')!.value.trim(),
      columns: Number(editor.dataset.columns) || 6,
      rows: Number(editor.dataset.rows) || 1,
    }))
    saveSettings({ location: document.querySelector<HTMLInputElement>('#admin-location')!.value.trim() || defaultSettings.location, weatherCity: weatherCityInput.value.trim(), widgets })
    message.textContent = 'Gespeichert. Die Anzeige übernimmt die Widgets beim nächsten Öffnen.'
  })

  document.querySelector<HTMLButtonElement>('#reset-button')!.addEventListener('click', () => {
    saveSettings(defaultSettings)
    window.location.reload()
  })
}

if (window.location.pathname === '/admin') renderAdminPage()
else renderDisplayPage()
