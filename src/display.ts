import { escapeHtml, weatherSymbol } from './dashboard-utils.ts'
import { createSettingsStore } from './settings-store.ts'
import { bindWidgetFrames, renderWidget } from './widgets.ts'

export function isNightTime(start: string, end: string, now = new Date()): boolean {
  const parseMinutes = (timeStr: string) => {
    const parts = (timeStr || '').split(':')
    const hours = Number(parts[0]) || 0
    const mins = Number(parts[1]) || 0
    return hours * 60 + mins
  }
  const currentMinutes = now.getHours() * 60 + now.getMinutes()
  const startMinutes = parseMinutes(start)
  const endMinutes = parseMinutes(end)

  if (startMinutes <= endMinutes) {
    return currentMinutes >= startMinutes && currentMinutes < endMinutes
  }
  return currentMinutes >= startMinutes || currentMinutes < endMinutes
}

export function calculatePixelShift(step: number): { x: number; y: number } {
  const shifts = [
    { x: 0, y: 0 },
    { x: 1, y: 0 },
    { x: 1, y: 1 },
    { x: 0, y: 1 },
    { x: -1, y: 1 },
    { x: -1, y: 0 },
    { x: -1, y: -1 },
    { x: 0, y: -1 },
    { x: 1, y: -1 },
  ]
  return shifts[Math.abs(step) % shifts.length]!
}

export function playNotificationSound(sound: string = 'doorbell', volume: number = 0.8): Promise<void> {
  try {
    const AudioContextClass = typeof window !== 'undefined'
      ? (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)
      : null
    if (!AudioContextClass) return Promise.resolve()
    const ctx = new AudioContextClass()
    if (ctx.state === 'suspended') {
      void ctx.resume()
    }
    const safeVol = Math.max(0.01, Math.min(1, volume))
    const now = ctx.currentTime

    if (sound === 'alert') {
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(800, now)
      gain1.gain.setValueAtTime(safeVol * 0.35, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.15)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.15)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(950, now + 0.2)
      gain2.gain.setValueAtTime(safeVol * 0.35, now + 0.2)
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.38)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.2)
      osc2.stop(now + 0.38)
    } else if (sound === 'chime') {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(safeVol * 0.45, now)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now)
      osc.stop(now + 1.2)
    } else {
      // Zweiklang-Türgong (D5 587Hz -> A4 440Hz)
      const osc1 = ctx.createOscillator()
      const gain1 = ctx.createGain()
      osc1.type = 'sine'
      osc1.frequency.setValueAtTime(587.33, now)
      gain1.gain.setValueAtTime(safeVol * 0.5, now)
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.45)
      osc1.connect(gain1)
      gain1.connect(ctx.destination)
      osc1.start(now)
      osc1.stop(now + 0.45)

      const osc2 = ctx.createOscillator()
      const gain2 = ctx.createGain()
      osc2.type = 'sine'
      osc2.frequency.setValueAtTime(440, now + 0.35)
      gain2.gain.setValueAtTime(safeVol * 0.45, now + 0.35)
      gain2.gain.exponentialRampToValueAtTime(0.0001, now + 1.4)
      osc2.connect(gain2)
      gain2.connect(ctx.destination)
      osc2.start(now + 0.35)
      osc2.stop(now + 1.4)
    }
    return Promise.resolve()
  } catch {
    return Promise.resolve()
  }
}

export function showNotificationBanner(
  notification: { id: string; title: string; message: string; image?: string; duration?: number; sound?: string },
  options: { soundEnabled: boolean; soundVolume: number }
) {
  let container = document.getElementById('kiosk-notification-container')
  if (!container) {
    container = document.createElement('div')
    container.id = 'kiosk-notification-container'
    container.className = 'kiosk-notification-container'
    document.body.appendChild(container)
  }

  if (options.soundEnabled) {
    void playNotificationSound(notification.sound || 'doorbell', options.soundVolume)
  }

  const durationSec = Math.max(3, Math.min(60, Number(notification.duration) || 10))
  const banner = document.createElement('div')
  banner.className = 'notification-banner'
  banner.setAttribute('role', 'alert')
  banner.innerHTML = `
    ${notification.image ? `<img class="notification-banner-img" src="${escapeHtml(notification.image)}" alt="Snapshot" />` : ''}
    <div class="notification-banner-body">
      <div class="notification-banner-top">
        <span class="notification-banner-icon">🔔</span>
        <strong class="notification-banner-title">${escapeHtml(notification.title)}</strong>
        <button type="button" class="notification-banner-close" aria-label="Schließen">×</button>
      </div>
      <p class="notification-banner-msg">${escapeHtml(notification.message)}</p>
    </div>
  `

  const dismiss = () => {
    banner.classList.add('is-dismissing')
    window.setTimeout(() => banner.remove(), 400)
  }

  banner.querySelector('.notification-banner-close')?.addEventListener('click', dismiss)
  banner.addEventListener('click', (e) => {
    if ((e.target as HTMLElement).tagName !== 'BUTTON') dismiss()
  })

  container.appendChild(banner)
  window.setTimeout(dismiss, durationSec * 1000)
}

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

export function initNetworkStatus(target: HTMLElement, initialSource: 'server' | 'local') {
  const update = (online: boolean, label = online ? 'ONLINE' : 'OFFLINE', title = online ? 'Netzwerkverbindung aktiv' : 'Keine Netzwerkverbindung') => {
    target.textContent = label
    target.title = title
    target.classList.toggle('is-online', online)
    target.classList.toggle('is-offline', !online)
  }

  if (initialSource === 'local') {
    update(false, 'LOKAL', 'Server nicht erreichbar (Offline-Modus)')
  } else {
    update(typeof navigator !== 'undefined' ? navigator.onLine : true)
  }

  window.addEventListener('online', () => update(true))
  window.addEventListener('offline', () => update(false, 'OFFLINE', 'Keine Netzwerkverbindung'))

  window.setInterval(async () => {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      update(false, 'OFFLINE', 'Keine Netzwerkverbindung')
      return
    }
    try {
      const res = await fetch('/api/settings', { method: 'GET', cache: 'no-store' })
      if (res.ok) {
        update(true, 'ONLINE', 'Server erreichbar')
      } else {
        update(false, 'LOKAL', 'Server antwortet nicht regulär')
      }
    } catch {
      update(false, 'LOKAL', 'Server nicht erreichbar')
    }
  }, 30000)
}

export async function renderDisplayPage(app: HTMLElement) {
  const store = createSettingsStore()
  const { settings, source } = await store.load()
  const isOnline = source === 'server' && (typeof navigator === 'undefined' || navigator.onLine)
  const widgets = settings.widgets.length
    ? settings.widgets.map((widget) => renderWidget(widget)).join('')
    : '<div class="empty-display"><span class="widget-kicker">Noch keine Widgets</span><a href="/admin">Admin öffnen <span>↗</span></a></div>'

  app.innerHTML = `
    <main class="signage-shell">
      <header class="header-bar">
        <div class="brand-mark"><img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" /></div>
        <div class="header-status">
          <span class="connection-status ${isOnline ? 'is-online' : 'is-offline'}" id="network-status" title="Netzwerkstatus">${isOnline ? 'ONLINE' : (source === 'local' ? 'LOKAL' : 'OFFLINE')}</span>
          <span class="weather-location">${escapeHtml(settings.weatherCity || settings.location)}</span>
          <span class="status-divider"></span>
          <span class="weather-status" id="weather"></span>
          <time id="date">--.--.----</time>
          <strong id="clock">--:--</strong>
          <a class="settings-button" href="/admin" aria-label="Anzeige konfigurieren">⚙</a>
        </div>
      </header>
      <section class="widget-grid" aria-label="Anzeigen-Widgets">${widgets}</section>
      <div class="night-clock-overlay" id="night-clock-overlay" aria-hidden="true">
        <strong class="night-clock-time" id="night-clock-time">--:--</strong>
        <span class="night-clock-date" id="night-clock-date">--.--.----</span>
        <span class="night-clock-hint">Tippen zum Aktivieren</span>
      </div>
    </main>`

  const shell = app.querySelector<HTMLElement>('.signage-shell')!
  const clock = app.querySelector<HTMLElement>('#clock')!
  const date = app.querySelector<HTMLElement>('#date')!
  const weather = app.querySelector<HTMLElement>('#weather')!
  const networkStatus = app.querySelector<HTMLElement>('#network-status')!
  const nightClockOverlay = app.querySelector<HTMLElement>('#night-clock-overlay')!
  const nightClockTime = app.querySelector<HTMLElement>('#night-clock-time')!
  const nightClockDate = app.querySelector<HTMLElement>('#night-clock-date')!

  if (settings.displayScale && settings.displayScale !== 100) {
    shell.style.setProperty('--kiosk-scale', String(settings.displayScale / 100))
    shell.style.zoom = String(settings.displayScale / 100)
  }

  if (typeof window !== 'undefined' && window.screen) {
    try {
      localStorage.setItem('homepiboard-display-resolution', `${window.screen.width} × ${window.screen.height} (${Math.round((window.devicePixelRatio || 1) * 100)}% DPI)`)
    } catch {
      // storage unavailable
    }
  }

  if (settings.hideCursor !== false) {
    shell.classList.add('kiosk-hide-cursor')
    let cursorTimer: number | undefined
    const handleMouseMove = () => {
      shell.classList.remove('kiosk-hide-cursor')
      if (cursorTimer) window.clearTimeout(cursorTimer)
      cursorTimer = window.setTimeout(() => {
        shell.classList.add('kiosk-hide-cursor')
      }, 2000)
    }
    window.addEventListener('mousemove', handleMouseMove, { passive: true })
  }

  const showWeekday = settings.showWeekday !== false
  const locale = settings.locale || 'de-DE'
  const timeOptions: Intl.DateTimeFormatOptions = {
    hour: '2-digit',
    minute: '2-digit',
    ...(settings.showSeconds ? { second: '2-digit' } : {}),
    ...(settings.timezone && settings.timezone !== 'auto' ? { timeZone: settings.timezone } : {}),
  }
  const dateOptions: Intl.DateTimeFormatOptions = {
    ...(showWeekday ? { weekday: 'short' } : {}),
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...(settings.timezone && settings.timezone !== 'auto' ? { timeZone: settings.timezone } : {}),
  }

  const updateTime = () => {
    const now = new Date()
    try {
      const formattedTime = now.toLocaleTimeString(locale, timeOptions)
      const formattedDate = now.toLocaleDateString(locale, dateOptions)
      clock.textContent = formattedTime
      if (showWeekday) {
        const parts = formattedDate.split(/(^[^\d]+)/).filter(Boolean)
        if (parts.length >= 2) {
          const weekdayStr = parts[0]!.trim()
          const dateStr = parts.slice(1).join('').trim().replace(/^,?\s*/, '')
          date.innerHTML = `<span class="header-weekday">${escapeHtml(weekdayStr)}</span> ${escapeHtml(dateStr)}`
        } else {
          date.textContent = formattedDate
        }
      } else {
        date.textContent = formattedDate
      }
      if (nightClockTime) nightClockTime.textContent = formattedTime
      if (nightClockDate) nightClockDate.textContent = formattedDate
    } catch {
      const fbTime = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })
      const fbDate = now.toLocaleDateString('de-DE', { weekday: showWeekday ? 'short' : undefined, day: '2-digit', month: '2-digit', year: 'numeric' })
      clock.textContent = fbTime
      date.textContent = fbDate
      if (nightClockTime) nightClockTime.textContent = fbTime
      if (nightClockDate) nightClockDate.textContent = fbDate
    }
  }

  updateTime()
  window.setInterval(updateTime, 1000)

  // 1. Automatischer Nachtmodus & Display-Dimmen
  let isTemporarilyAwake = false
  let wakeTimer: number | undefined
  const checkNightMode = () => {
    if (!settings.nightModeEnabled) {
      shell.classList.remove('is-night-dim', 'is-night-clock')
      nightClockOverlay.setAttribute('aria-hidden', 'true')
      return
    }

    const inNightWindow = isNightTime(settings.nightModeStart || '22:00', settings.nightModeEnd || '06:00')
    if (inNightWindow && !isTemporarilyAwake) {
      if (settings.nightModeStyle === 'clock') {
        shell.classList.add('is-night-clock')
        shell.classList.remove('is-night-dim')
        nightClockOverlay.setAttribute('aria-hidden', 'false')
      } else {
        shell.classList.add('is-night-dim')
        shell.classList.remove('is-night-clock')
        nightClockOverlay.setAttribute('aria-hidden', 'true')
      }
    } else {
      shell.classList.remove('is-night-dim', 'is-night-clock')
      nightClockOverlay.setAttribute('aria-hidden', 'true')
    }
  }

  const wakeDisplay = () => {
    if (shell.classList.contains('is-night-dim') || shell.classList.contains('is-night-clock')) {
      isTemporarilyAwake = true
      shell.classList.remove('is-night-dim', 'is-night-clock')
      nightClockOverlay.setAttribute('aria-hidden', 'true')
      if (wakeTimer) window.clearTimeout(wakeTimer)
      wakeTimer = window.setTimeout(() => {
        isTemporarilyAwake = false
        checkNightMode()
      }, 30000)
    }
  }

  window.addEventListener('pointerdown', wakeDisplay, { passive: true })
  checkNightMode()
  window.setInterval(checkNightMode, 30000)

  // Pixel-Shift (Burn-in Schutz) alle 5 Minuten
  if (settings.pixelShiftEnabled !== false) {
    let shiftStep = 0
    window.setInterval(() => {
      shiftStep++
      const { x, y } = calculatePixelShift(shiftStep)
      shell.style.setProperty('--pixel-shift-x', `${x}px`)
      shell.style.setProperty('--pixel-shift-y', `${y}px`)
    }, 5 * 60 * 1000)
  }

  // 4. Benachrichtigungs-Zentrale (SSE Stream)
  const soundOpts = {
    soundEnabled: settings.notificationSoundEnabled !== false,
    soundVolume: Number(settings.notificationSoundVolume ?? 0.8),
  }

  if (typeof EventSource !== 'undefined') {
    try {
      const sse = new EventSource('/api/notify/stream')
      sse.onmessage = (event) => {
        try {
          const notif = JSON.parse(event.data) as { id: string; title: string; message: string; image?: string; duration?: number; sound?: string }
          if (notif && notif.title) {
            wakeDisplay()
            showNotificationBanner(notif, soundOpts)
          }
        } catch {
          // ignore malformed
        }
      }
    } catch {
      // EventSource failed
    }
  }

  // Live Updates für Media-Widgets
  const updateLiveWidgets = async () => {
    try {
      const mediaRes = await fetch('/api/media', { cache: 'no-store' })
      if (!mediaRes.ok) return
      const mediaData = await mediaRes.json() as { title?: string; artist?: string; album?: string; coverUrl?: string; isPlaying?: boolean }
      
      // Nur aktualisieren wenn ein externer Streamer (Spotify, HomeAssistant etc.) echte Daten sendet
      if (!mediaData || !mediaData.title || mediaData.title === 'Keine Wiedergabe') {
        return
      }

      app.querySelectorAll<HTMLElement>('[data-media-widget]').forEach((widget) => {
        // Falls das Widget ein lokales Webradio mit eigener Stream-URL abspielt, nicht überschreiben
        if (widget.dataset.streamUrl) {
          return
        }

        const titleEl = widget.querySelector('[data-media-field="title"]')
        const artistEl = widget.querySelector('[data-media-field="artist"]')
        const albumEl = widget.querySelector('[data-media-field="album"]')
        const eqBars = widget.querySelector('.media-equalizer-bars')
        const playIcon = widget.querySelector('.media-play-icon')

        if (titleEl) titleEl.textContent = mediaData.title || ''
        if (artistEl) artistEl.textContent = mediaData.artist || ''
        if (albumEl) albumEl.textContent = mediaData.album || ''
        if (eqBars) eqBars.classList.toggle('is-animated', Boolean(mediaData.isPlaying))
        if (playIcon) playIcon.textContent = mediaData.isPlaying ? '⏸' : '▶'
      })
    } catch {
      // live media offline
    }
  }

  window.setInterval(updateLiveWidgets, 10000)

  initScreenWakeLock()
  initNetworkStatus(networkStatus, source)
  bindWidgetFrames(app)
  bindRadioWidgets(app)
  if (settings.weatherCity) await loadWeather(settings.weatherCity, weather)
}

export function initScreenWakeLock() {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) {
    return
  }

  let wakeLockSentinel: unknown = null

  const acquireLock = async () => {
    try {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        wakeLockSentinel = await (navigator.wakeLock as { request: (type: string) => Promise<unknown> }).request('screen')
      }
    } catch {
      // Wake lock not allowed or unavailable
    }
  }

  void acquireLock()

  if (typeof document !== 'undefined') {
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        void acquireLock()
      }
    })
  }

  if (typeof window !== 'undefined') {
    window.setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible' && !wakeLockSentinel) {
        void acquireLock()
      }
    }, 60000)
  }
}


export function bindRadioWidgets(root: ParentNode, options: { allowAutoplay?: boolean } = {}) {
  const widgets = root.querySelectorAll<HTMLElement>('[data-media-widget]')
  widgets.forEach((widget) => {
    const streamUrl = widget.dataset.streamUrl || ''
    const playBtn = widget.querySelector<HTMLButtonElement>('[data-action="toggle-play"]')
    const audio = widget.querySelector<HTMLAudioElement>('audio[data-media-audio]')
    const eqBars = widget.querySelector('.media-equalizer-bars')
    const statusText = widget.querySelector<HTMLElement>('[data-media-status]')
    const volumeSlider = widget.querySelector<HTMLInputElement>('[data-action="volume-slider"]')
    const volumeVal = widget.querySelector<HTMLElement>('[data-media-volume-val]')
    const volumeIcon = widget.querySelector<HTMLElement>('.media-volume-icon')
    const durationEl = widget.querySelector<HTMLElement>('[data-media-duration]')

    if (!audio || !streamUrl) return

    let playbackSeconds = 0
    let timerInterval: number | undefined

    const formatTime = (totalSec: number) => {
      const mins = Math.floor(totalSec / 60)
      const secs = totalSec % 60
      if (mins >= 60) {
        const hrs = Math.floor(mins / 60)
        const remMins = mins % 60
        return `${hrs}:${remMins < 10 ? '0' : ''}${remMins}:${secs < 10 ? '0' : ''}${secs}`
      }
      return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`
    }

    const startTimer = () => {
      if (timerInterval) clearInterval(timerInterval)
      const timer = setInterval(() => {
        if (!audio.paused) {
          if (audio.currentTime && isFinite(audio.currentTime) && audio.currentTime > 0) {
            playbackSeconds = Math.floor(audio.currentTime)
          } else {
            playbackSeconds++
          }
          if (durationEl) {
            durationEl.textContent = formatTime(playbackSeconds)
          }
        }
      }, 1000)
      if (typeof timer === 'object' && timer && typeof (timer as { unref?: () => void }).unref === 'function') {
        (timer as { unref: () => void }).unref()
      }
      timerInterval = timer as unknown as number
    }

    const stopTimer = () => {
      if (timerInterval) {
        clearInterval(timerInterval)
        timerInterval = undefined
      }
    }

    const applyVolume = (val: number) => {
      const safeVal = Math.max(0, Math.min(1, isNaN(val) ? 0.8 : val))
      audio.volume = safeVal
      if (volumeSlider) {
        volumeSlider.value = String(safeVal)
      }
      if (volumeVal) {
        volumeVal.textContent = `${Math.round(safeVal * 100)}%`
      }
      if (volumeIcon) {
        volumeIcon.textContent = safeVal === 0 ? '🔇' : (safeVal < 0.4 ? '🔉' : '🔊')
      }
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('homepiboard-radio-volume', String(safeVal))
        }
      } catch {
        // storage disabled
      }
    }

    // Gespeicherte Lautstärke wiederherstellen
    try {
      const saved = typeof localStorage !== 'undefined' ? localStorage.getItem('homepiboard-radio-volume') : null
      if (saved !== null) {
        applyVolume(Number(saved))
      } else if (volumeSlider) {
        applyVolume(Number(volumeSlider.value))
      }
    } catch {
      // ignore
    }

    const setPlayingState = (isPlaying: boolean) => {
      widget.classList.toggle('is-playing', isPlaying)
      widget.classList.toggle('is-paused', !isPlaying)
      widget.classList.toggle('is-waiting-for-gesture', false)
      if (eqBars) eqBars.classList.toggle('is-animated', isPlaying)
      
      const icons = typeof widget.querySelectorAll === 'function'
        ? widget.querySelectorAll<HTMLElement>('.media-play-icon')
        : (widget.querySelector('.media-play-icon') ? [widget.querySelector('.media-play-icon') as HTMLElement] : [])
      if (icons.length) {
        icons.forEach((icon) => {
          icon.textContent = isPlaying ? '⏸' : '▶'
        })
      } else if (playBtn) {
        playBtn.innerHTML = `<span class="media-play-icon" aria-hidden="true">${isPlaying ? '⏸' : '▶'}</span>`
      }

      if (playBtn) {
        playBtn.setAttribute?.('title', isPlaying ? 'Wiedergabe pausieren' : 'Wiedergabe starten')
        playBtn.setAttribute?.('aria-label', isPlaying ? 'Pause' : 'Abspielen')
      }
      const coverWrapper = widget.querySelector<HTMLElement>('.media-cover-wrapper')
      if (coverWrapper) {
        coverWrapper.setAttribute?.('title', isPlaying ? 'Wiedergabe pausieren' : 'Wiedergabe starten')
      }
      if (statusText) statusText.textContent = isPlaying ? 'Auf Sendung' : 'Bereit'

      if (isPlaying) {
        startTimer()
      } else {
        stopTimer()
      }
    }

    const startAudio = async (isAutoplay = false): Promise<boolean> => {
      try {
        if (!audio.src || audio.src !== streamUrl) {
          audio.src = streamUrl
        }
        if (typeof audio.load === 'function' && (!audio.readyState || audio.readyState === 0)) {
          audio.load()
        }
        const vol = Math.max(0, Math.min(1, Number(volumeSlider?.value) || 0.8))
        audio.volume = vol
        await audio.play()
        setPlayingState(true)
        return true
      } catch (err: unknown) {
        const isNotAllowed = err instanceof Error && (err.name === 'NotAllowedError' || /user gesture|interact|notallowed/i.test(err.message))
        if (isAutoplay && isNotAllowed) {
          console.warn('Radio Autoplay: Browser erfordert Nutzerinteraktion. Warte auf ersten Klick oder Touch...')
          widget.classList.toggle('is-playing', false)
          widget.classList.toggle('is-paused', true)
          widget.classList.toggle('is-waiting-for-gesture', true)
          if (eqBars) eqBars.classList.toggle('is-animated', false)
          const icons = typeof widget.querySelectorAll === 'function'
            ? widget.querySelectorAll<HTMLElement>('.media-play-icon')
            : (widget.querySelector('.media-play-icon') ? [widget.querySelector('.media-play-icon') as HTMLElement] : [])
          icons.forEach((icon) => { icon.textContent = '▶' })
          if (statusText) statusText.textContent = 'Tippen für Ton'

          const onFirstInteraction = () => {
            if (typeof window !== 'undefined') {
              window.removeEventListener('pointerdown', onFirstInteraction)
              window.removeEventListener('click', onFirstInteraction)
              window.removeEventListener('keydown', onFirstInteraction)
            }
            widget.classList.toggle('is-waiting-for-gesture', false)
            void startAudio(false)
          }

          if (typeof window !== 'undefined') {
            window.addEventListener('pointerdown', onFirstInteraction, { passive: true })
            window.addEventListener('click', onFirstInteraction, { passive: true })
            window.addEventListener('keydown', onFirstInteraction, { passive: true })
          }
          return false
        }

        console.error('Radio stream playback error:', err)
        setPlayingState(false)
        if (statusText) statusText.textContent = 'Stream-Fehler'
        return false
      }
    }

    const togglePlay = () => {
      if (!audio.paused) {
        try {
          audio.pause()
          audio.src = ''
          if (typeof audio.removeAttribute === 'function') {
            audio.removeAttribute('src')
          }
          if (typeof audio.load === 'function') {
            audio.load()
          }
        } catch {
          // ignore
        }
        setPlayingState(false)
        return Promise.resolve()
      } else {
        return startAudio(false)
      }
    }

    const toggleTriggers = typeof widget.querySelectorAll === 'function'
      ? widget.querySelectorAll<HTMLElement>('[data-action="toggle-play"]')
      : (playBtn ? [playBtn] : [])
    toggleTriggers.forEach((trigger) => {
      trigger.addEventListener('click', (e) => {
        e.stopPropagation()
        return togglePlay()
      })
    })

    if (volumeSlider) {
      const handleVol = (e: Event) => {
        e.stopPropagation()
        applyVolume(Number(volumeSlider.value))
      }
      volumeSlider.addEventListener('input', handleVol)
      volumeSlider.addEventListener('change', handleVol)
      volumeSlider.addEventListener('pointerdown', (e) => e.stopPropagation())
      volumeSlider.addEventListener('mousedown', (e) => e.stopPropagation())
    }

    volumeIcon?.addEventListener('click', (e) => {
      e.stopPropagation()
      if (audio.volume > 0) {
        audio.dataset.prevVolume = String(audio.volume)
        applyVolume(0)
      } else {
        const prev = Number(audio.dataset.prevVolume) || 0.8
        applyVolume(prev)
      }
    })

    audio.addEventListener('play', () => setPlayingState(true))
    audio.addEventListener('pause', () => setPlayingState(false))
    audio.addEventListener('timeupdate', () => {
      if (audio.currentTime && isFinite(audio.currentTime)) {
        playbackSeconds = Math.floor(audio.currentTime)
        if (durationEl) {
          durationEl.textContent = formatTime(playbackSeconds)
        }
      }
    })
    audio.addEventListener('error', () => {
      if (audio.paused || !audio.getAttribute?.('src')) {
        return
      }
      setPlayingState(false)
      if (statusText) statusText.textContent = 'Stream-Fehler'
    })

    if (options.allowAutoplay !== false && widget.classList.contains('is-playing')) {
      void startAudio(true)
    }
  })
}

