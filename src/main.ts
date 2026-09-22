import './style.css'

type WidgetSize = 'standard' | 'wide' | 'tall'
type WebWidget = { id: string; title: string; url: string; size: WidgetSize }
type DisplaySettings = { location: string; weatherCity: string; widgets: WebWidget[] }

const defaultSettings: DisplaySettings = { location: 'Zuhause', weatherCity: '', widgets: [] }
const settingsKey = 'homeboard-settings'

function loadSettings(): DisplaySettings {
  const storedSettings = localStorage.getItem(settingsKey)
  if (!storedSettings) return { ...defaultSettings }

  try {
    const parsed = JSON.parse(storedSettings) as Partial<DisplaySettings> & { url?: string; size?: WidgetSize }
    const widgets: WebWidget[] = Array.isArray(parsed.widgets)
      ? parsed.widgets.map((widget, index) => ({
          id: widget.id || `widget-${index + 1}`,
          title: widget.title || `Web-Widget ${index + 1}`,
          url: widget.url || '',
          size: widget.size === 'wide' || widget.size === 'tall' ? widget.size : 'standard',
        }))
      : parsed.url
        ? [{ id: 'widget-1', title: 'Web-Widget', url: parsed.url, size: parsed.size === 'wide' || parsed.size === 'tall' ? parsed.size : 'standard' }]
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

function widgetClass(size: WidgetSize) {
  return size === 'standard' ? '' : ` widget-${size}`
}

function escapeHtml(value: string) {
  return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character]!)
}

function renderWidget(widget: WebWidget) {
  const content = widget.url
    ? `<iframe src="${escapeHtml(widget.url)}" title="${escapeHtml(widget.title)}" loading="lazy"></iframe>`
    : '<span class="placeholder-icon">↗</span><strong>URL fehlt</strong><span>In der Admin-Seite konfigurieren</span>'
  return `<article class="widget iframe-widget${widgetClass(widget.size)}"><div class="widget-heading"><span>${escapeHtml(widget.title)}</span><span class="live-dot">LIVE</span></div><div class="iframe-placeholder">${content}</div></article>`
}

function renderDisplayPage() {
  const settings = loadSettings()
  const widgets = settings.widgets.length ? settings.widgets.map(renderWidget).join('') : '<article class="widget iframe-widget"><div class="widget-heading"><span>Web-Widget</span><span class="live-dot">BEREIT</span></div><div class="iframe-placeholder"><span class="placeholder-icon">↗</span><strong>Deine Inhalte</strong><span>URL in der Admin-Seite eintragen</span></div></article>'
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <main class="signage-shell">
    <header class="header-bar"><div class="brand-mark"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></div><div class="header-status"><span>${escapeHtml(settings.location)}</span><span class="status-divider"></span><span class="weather-status" id="weather"></span><time id="date">--.--.----</time><strong id="clock">--:--</strong><a class="settings-button" href="/admin" aria-label="Anzeige konfigurieren">⚙</a></div></header>
    <section class="widget-grid" aria-label="Anzeigen-Widgets">
      <article class="widget widget-featured"><div class="widget-kicker">Heute</div><h1>Ein ruhiger<br><em>Überblick.</em></h1><p>Deine Startseite für Zuhause.</p><span class="widget-index">01 / ${String(settings.widgets.length + 2).padStart(2, '0')}</span></article>
      ${widgets}
      <article class="widget note-widget"><div class="widget-heading"><span>Notiz</span><span class="widget-menu">•••</span></div><p class="note-copy">Platz für einen kurzen Hinweis, eine Nachricht oder dein nächstes Vorhaben.</p><span class="note-date">Zuletzt bearbeitet · heute</span></article>
    </section>
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
  return `<div class="widget-editor" draggable="true" data-widget-id="${escapeHtml(widget.id)}"><div class="widget-editor-top"><strong>⠿ Widget ${index + 1}</strong><button class="remove-widget" type="button" data-remove-id="${escapeHtml(widget.id)}">Entfernen</button></div><label>Titel<input data-field="title" value="${escapeHtml(widget.title)}" maxlength="30" /></label><label>URL<input data-field="url" type="url" value="${escapeHtml(widget.url)}" placeholder="https://example.com" /></label><label>Größe<select data-field="size"><option value="standard" ${widget.size === 'standard' ? 'selected' : ''}>Standard</option><option value="wide" ${widget.size === 'wide' ? 'selected' : ''}>Breit</option><option value="tall" ${widget.size === 'tall' ? 'selected' : ''}>Hoch</option></select></label></div>`
}

function renderAdminPage() {
  const settings = loadSettings()
  document.querySelector<HTMLDivElement>('#app')!.innerHTML = `<main class="admin-shell"><header class="admin-header"><a class="brand-mark" href="/"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></a><a class="back-link" href="/">Anzeige öffnen <span>↗</span></a></header><section class="admin-content"><div class="admin-intro"><span class="widget-kicker">Administration</span><h1>Deine Anzeige<br><em>einrichten.</em></h1><p>Änderungen werden lokal in diesem Browser gespeichert und beim nächsten Öffnen der Anzeige übernommen.</p></div><form class="admin-form" id="admin-form"><label>Bezeichnung <span>Text im Header</span><input id="admin-location" maxlength="24" value="${escapeHtml(settings.location)}" /></label><label>Wetterort <span>Optional, zum Beispiel Berlin</span><input id="admin-weather-city" maxlength="40" value="${escapeHtml(settings.weatherCity)}" placeholder="Berlin" /></label><div class="widget-editors" id="widget-editors">${settings.widgets.map(renderWidgetEditor).join('')}</div><button class="add-widget" id="add-widget" type="button">+ Web-Widget hinzufügen</button><div class="admin-actions"><button class="reset-button" id="reset-button" type="button">Zurücksetzen</button><button class="save-button" type="submit">Speichern</button></div><p class="save-message" id="save-message" role="status"></p></form></section></main>`

  const editorList = document.querySelector<HTMLElement>('#widget-editors')!
  const message = document.querySelector<HTMLElement>('#save-message')!
  const weatherCityInput = document.querySelector<HTMLInputElement>('#admin-weather-city')!
  document.querySelector<HTMLButtonElement>('#add-widget')!.addEventListener('click', () => {
    const nextWidget: WebWidget = { id: `widget-${Date.now()}`, title: `Web-Widget ${editorList.children.length + 1}`, url: '', size: 'standard' }
    editorList.insertAdjacentHTML('beforeend', renderWidgetEditor(nextWidget, editorList.children.length))
    bindEditorInteractions()
  })

  function bindEditorInteractions() {
    editorList.querySelectorAll<HTMLButtonElement>('[data-remove-id]').forEach((button) => {
      button.onclick = () => button.closest('.widget-editor')?.remove()
    })
    editorList.querySelectorAll<HTMLElement>('.widget-editor').forEach((editor) => {
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
    })
  }
  bindEditorInteractions()

  document.querySelector<HTMLFormElement>('#admin-form')!.addEventListener('submit', (event) => {
    event.preventDefault()
    const widgets = [...editorList.querySelectorAll<HTMLElement>('.widget-editor')].map((editor) => ({
      id: editor.dataset.widgetId!,
      title: editor.querySelector<HTMLInputElement>('[data-field="title"]')!.value.trim() || 'Web-Widget',
      url: editor.querySelector<HTMLInputElement>('[data-field="url"]')!.value.trim(),
      size: editor.querySelector<HTMLSelectElement>('[data-field="size"]')!.value as WidgetSize,
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
