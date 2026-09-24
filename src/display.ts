import { escapeHtml, weatherSymbol } from './dashboard-utils.ts'
import { createSettingsStore } from './settings-store.ts'
import { bindWidgetFrames, renderWidget } from './widgets.ts'

async function loadWeather(city: string, target: HTMLElement) {
  try {
    const search = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=de&format=json`)
    if (!search.ok) throw new Error(`geocoding-${search.status}`)
    const places = await search.json() as { results?: Array<{ latitude: number; longitude: number }> }
    const place = places.results?.[0]
    if (!place) throw new Error('location-not-found')

    const forecast = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code&timezone=auto`)
    if (!forecast.ok) throw new Error(`weather-${forecast.status}`)
    const data = await forecast.json() as { current?: { temperature_2m: number; relative_humidity_2m: number; weather_code: number } }
    if (!data.current) throw new Error('weather-missing')

    target.textContent = `${Math.round(data.current.temperature_2m)}° · ${weatherSymbol(data.current.weather_code)} · ${data.current.relative_humidity_2m}% Luftfeuchte`
  } catch {
    target.textContent = 'Wetter nicht verfügbar'
    target.classList.add('is-unavailable')
  }
}

export async function renderDisplayPage(app: HTMLElement) {
  const store = createSettingsStore()
  const { settings, source } = await store.load()
  const widgets = settings.widgets.length
    ? settings.widgets.map((widget) => renderWidget(widget)).join('')
    : '<div class="empty-display"><span class="widget-kicker">Noch keine Widgets</span><a href="/admin">Admin öffnen <span>↗</span></a></div>'

  app.innerHTML = `
    <main class="signage-shell">
      <header class="header-bar">
        <div class="brand-mark"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></div>
        <div class="header-status">
          ${source === 'local' ? '<span class="connection-status" title="Server nicht erreichbar">LOKAL</span>' : ''}
          <span class="weather-location">${escapeHtml(settings.weatherCity || settings.location)}</span>
          <span class="status-divider"></span>
          <span class="weather-status" id="weather"></span>
          <time id="date">--.--.----</time>
          <strong id="clock">--:--</strong>
          <a class="settings-button" href="/admin" aria-label="Anzeige konfigurieren">⚙</a>
        </div>
      </header>
      <section class="widget-grid" aria-label="Anzeigen-Widgets">${widgets}</section>
    </main>`

  const clock = app.querySelector<HTMLElement>('#clock')!
  const date = app.querySelector<HTMLElement>('#date')!
  const weather = app.querySelector<HTMLElement>('#weather')!
  const updateTime = () => {
    const now = new Date()
    clock.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
    date.textContent = now.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' })
  }

  updateTime()
  window.setInterval(updateTime, 1000)
  bindWidgetFrames(app)
  if (settings.weatherCity) await loadWeather(settings.weatherCity, weather)
}
