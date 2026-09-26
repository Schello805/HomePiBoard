import { adminErrorMessage, clearPinError, formatCpuTemp, formatUptime, validatePinChange } from './admin.ts'
import { escapeHtml } from './dashboard-utils.ts'
import { playNotificationSound } from './display.ts'
import { normalizeSettings, SETTINGS_VERSION } from './settings.ts'
import { createSettingsStore } from './settings-store.ts'

export async function renderSettingsPage(app: HTMLElement) {
  const store = createSettingsStore()
  const pinKey = 'homepiboard-admin-pin'
  const { settings } = await store.load()

  app.innerHTML = `
    <div class="settings-page-shell">
      <header class="settings-topbar">
        <div class="settings-brand">
          <img class="brand-logo" src="/homepiboard-logo.svg" alt="HomePiBoard" />
          <div>
            <span class="widget-kicker">System- &amp; Display-Einstellungen</span>
            <h1 class="settings-title">Einstellungen</h1>
          </div>
        </div>
        <div class="settings-nav-actions">
          <a class="topbar-btn secondary" href="/admin" title="Zurück zum Widget-Editor">← Widget-Editor</a>
          <a class="topbar-btn secondary" href="/" target="_blank" rel="noreferrer" title="HDMI-Live-Anzeige im neuen Tab öffnen">📺 Anzeige ↗</a>
          <button class="system-status-pill" id="settings-status-pill" type="button" title="Telemetrie anzeigen">Lade Telemetrie …</button>
          <button class="save-button" id="save-settings-btn" type="button">💾 Einstellungen speichern</button>
        </div>
      </header>

      <main class="settings-main-content">
        <div class="settings-grid-layout">
          <!-- 1. HDMI & Bildschirm -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">📺</span>
              <div>
                <h2 class="settings-card-title">HDMI &amp; Bildschirm</h2>
                <p class="settings-card-desc">Skalierung und Mauszeiger für deinen angeschlossenen Monitor</p>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="system-field-row">
                <label for="settings-display-scale">
                  <span>Display-Zoom / Skalierung</span>
                  <select id="settings-display-scale">
                    <option value="80" ${(settings.displayScale || 100) === 80 ? 'selected' : ''}>80% (Sehr kompakt)</option>
                    <option value="90" ${(settings.displayScale || 100) === 90 ? 'selected' : ''}>90% (Kompakt)</option>
                    <option value="100" ${(settings.displayScale || 100) === 100 ? 'selected' : ''}>100% (Standard)</option>
                    <option value="110" ${(settings.displayScale || 100) === 110 ? 'selected' : ''}>110% (Leicht vergrößert)</option>
                    <option value="125" ${(settings.displayScale || 100) === 125 ? 'selected' : ''}>125% (TV-Empfehlung ab 2m)</option>
                    <option value="150" ${(settings.displayScale || 100) === 150 ? 'selected' : ''}>150% (Groß)</option>
                  </select>
                </label>
                <div class="system-field-info">
                  <span>Erkannte HDMI-Auflösung:</span>
                  <strong id="settings-detected-resolution">-- × --</strong>
                </div>
              </div>
              <label class="system-checkbox-label" for="settings-hide-cursor">
                <input type="checkbox" id="settings-hide-cursor" ${settings.hideCursor !== false ? 'checked' : ''} />
                <span>Mauszeiger auf der HDMI-Anzeige automatisch ausblenden (nach 2 Sek. Inaktivität)</span>
              </label>
            </div>
          </section>

          <!-- 2. Uhrzeit, Datum & Sprache -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">🕒</span>
              <div>
                <h2 class="settings-card-title">Uhrzeit, Datum &amp; Sprache</h2>
                <p class="settings-card-desc">Formatierung von Uhrzeit und Header-Datum</p>
              </div>
            </div>
            <div class="settings-card-body">
              <div class="system-field-row">
                <label for="settings-locale">
                  <span>Sprache / Datumsformat</span>
                  <select id="settings-locale">
                    <option value="de-DE" ${(settings.locale || 'de-DE') === 'de-DE' ? 'selected' : ''}>Deutsch (Deutschland)</option>
                    <option value="de-AT" ${(settings.locale || 'de-DE') === 'de-AT' ? 'selected' : ''}>Deutsch (Österreich)</option>
                    <option value="de-CH" ${(settings.locale || 'de-DE') === 'de-CH' ? 'selected' : ''}>Deutsch (Schweiz)</option>
                    <option value="en-US" ${(settings.locale || 'de-DE') === 'en-US' ? 'selected' : ''}>English (US)</option>
                    <option value="en-GB" ${(settings.locale || 'de-DE') === 'en-GB' ? 'selected' : ''}>English (UK)</option>
                    <option value="fr-FR" ${(settings.locale || 'de-DE') === 'fr-FR' ? 'selected' : ''}>Français</option>
                  </select>
                </label>
                <label for="settings-timezone">
                  <span>Zeitzone</span>
                  <select id="settings-timezone">
                    <option value="auto" ${(settings.timezone || 'auto') === 'auto' ? 'selected' : ''}>Automatisch (Systemzeit)</option>
                    <option value="Europe/Berlin" ${(settings.timezone || 'auto') === 'Europe/Berlin' ? 'selected' : ''}>Europe/Berlin (Deutschland)</option>
                    <option value="Europe/Vienna" ${(settings.timezone || 'auto') === 'Europe/Vienna' ? 'selected' : ''}>Europe/Vienna (Österreich)</option>
                    <option value="Europe/Zurich" ${(settings.timezone || 'auto') === 'Europe/Zurich' ? 'selected' : ''}>Europe/Zurich (Schweiz)</option>
                    <option value="UTC" ${(settings.timezone || 'auto') === 'UTC' ? 'selected' : ''}>UTC</option>
                  </select>
                </label>
              </div>
              <label class="system-checkbox-label" for="settings-show-weekday">
                <input type="checkbox" id="settings-show-weekday" ${settings.showWeekday !== false ? 'checked' : ''} />
                <span>Wochentag im Header anzeigen (z. B. Sa., 26.09.2026)</span>
              </label>
              <label class="system-checkbox-label" for="settings-show-seconds">
                <input type="checkbox" id="settings-show-seconds" ${settings.showSeconds ? 'checked' : ''} />
                <span>Sekunden in der Digitaluhr anzeigen (z. B. 12:45:30)</span>
              </label>
            </div>
          </section>

          <!-- 3. Nachtmodus & Bildschirmschutz -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">🌙</span>
              <div>
                <h2 class="settings-card-title">Nachtmodus &amp; Bildschirmschutz</h2>
                <p class="settings-card-desc">Automatische Dimmung nachts und Schutz vor Burn-In</p>
              </div>
            </div>
            <div class="settings-card-body">
              <label class="system-checkbox-label" for="settings-night-mode-enabled">
                <input type="checkbox" id="settings-night-mode-enabled" ${settings.nightModeEnabled ? 'checked' : ''} />
                <span>Automatischer Nachtmodus aktivieren</span>
              </label>
              <div class="system-field-row">
                <label for="settings-night-mode-start">
                  <span>Beginn (Nachtruhe)</span>
                  <input type="time" id="settings-night-mode-start" value="${settings.nightModeStart || '22:00'}" />
                </label>
                <label for="settings-night-mode-end">
                  <span>Ende (Aufwachen)</span>
                  <input type="time" id="settings-night-mode-end" value="${settings.nightModeEnd || '06:00'}" />
                </label>
              </div>
              <label for="settings-night-mode-style">
                <span>Nacht-Darstellung</span>
                <select id="settings-night-mode-style">
                  <option value="dim" ${(settings.nightModeStyle || 'dim') === 'dim' ? 'selected' : ''}>Gedimmt (15% Helligkeit)</option>
                  <option value="clock" ${(settings.nightModeStyle || 'dim') === 'clock' ? 'selected' : ''}>Minimalistische Nacht-Uhr</option>
                </select>
              </label>
              <label class="system-checkbox-label" for="settings-pixel-shift-enabled">
                <input type="checkbox" id="settings-pixel-shift-enabled" ${settings.pixelShiftEnabled !== false ? 'checked' : ''} />
                <span>Pixel-Shift aktivieren (Burn-In-Schutz alle 5 Min. für OLED &amp; LCD)</span>
              </label>
              <small class="system-field-hint">💡 Wake-on-Tap: Durch Berührung oder Mausklick schaltet das Display nachts sofort für 30 Sekunden auf normale Helligkeit zurück.</small>
            </div>
          </section>

          <!-- 4. Audio-Ausgabe & Türklingel-Gong -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">🔊</span>
              <div>
                <h2 class="settings-card-title">Audio &amp; Benachrichtigungen</h2>
                <p class="settings-card-desc">Tonausgang (HDMI vs. 3,5mm Klinke) und Signalton für Smart-Home-Events</p>
              </div>
            </div>
            <div class="settings-card-body">
              <label for="settings-audio-output">
                <span>Audio-Ausgang des Raspberry Pi</span>
                <select id="settings-audio-output">
                  <option value="hdmi" ${(settings.audioOutput || 'hdmi') === 'hdmi' ? 'selected' : ''}>📺 HDMI (Fernseher / HDMI-Monitor — Standard)</option>
                  <option value="jack" ${(settings.audioOutput || 'hdmi') === 'jack' ? 'selected' : ''}>🎧 3,5mm Klinkenbuchse (Kopfhörer / analoge Boxen)</option>
                </select>
              </label>

              <label class="system-checkbox-label" for="settings-notification-sound-enabled">
                <input type="checkbox" id="settings-notification-sound-enabled" ${settings.notificationSoundEnabled !== false ? 'checked' : ''} />
                <span>Akustischen Signalton bei Benachrichtigungen abspielen</span>
              </label>
              <div class="settings-slider-row">
                <label for="settings-notification-sound-volume">
                  <div class="settings-slider-label-header">
                    <span>Lautstärke des Signaltons</span>
                    <strong id="settings-notification-sound-volume-val" class="settings-slider-value">${Math.round((settings.notificationSoundVolume ?? 0.8) * 100)}%</strong>
                  </div>
                  <input type="range" id="settings-notification-sound-volume" min="0.1" max="1.0" step="0.05" value="${settings.notificationSoundVolume ?? 0.8}" />
                </label>
                <button class="topbar-btn" id="settings-test-sound-btn" type="button">🔔 Signalton testen</button>
              </div>
              <small class="system-field-hint">💡 Sende <code>POST /api/notify</code> mit JSON: <code>{"title": "Türklingel", "message": "Jemand steht an der Tür", "sound": "doorbell"}</code></small>
            </div>
          </section>

          <!-- 5. Live Raspberry Pi Telemetrie -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">📊</span>
              <div>
                <h2 class="settings-card-title">Live Raspberry Pi Telemetrie</h2>
                <p class="settings-card-desc">Hardware-Auslastung, Temperatur und Netzwerkstatus</p>
              </div>
              <button class="topbar-btn" id="settings-telemetry-refresh-btn" type="button" title="Telemetrie neu laden">↻ Aktualisieren</button>
            </div>
            <div class="settings-card-body">
              <div id="settings-telemetry-container" class="system-telemetry-container">
                <span>Lade Telemetrie …</span>
              </div>
            </div>
          </section>

          <!-- 6. Software-Aktualisierung (1-Klick-Update) -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">🚀</span>
              <div>
                <h2 class="settings-card-title">Software-Aktualisierung (1-Klick-Update)</h2>
                <p class="settings-card-desc">System direkt per Mausklick aktualisieren – ganz ohne SSH oder Pi-Neustart</p>
              </div>
              <button class="topbar-btn" id="settings-update-check-btn" type="button">🔍 Nach Updates suchen</button>
            </div>
            <div class="settings-card-body">
              <div class="system-update-container">
                <div class="update-status-row">
                  <span class="telemetry-label">Aktuelle Version:</span>
                  <strong id="settings-update-current-version">Lade …</strong>
                </div>
                <div class="update-status-row">
                  <span class="update-badge is-uptodate" id="settings-update-badge">Lade Status …</span>
                </div>
                <p class="system-field-hint" id="settings-update-hint">Aktualisiert Code, Abhängigkeiten, Frontend und HDMI-Display vollautomatisch.</p>
                <div class="update-actions">
                  <button class="save-button" id="settings-trigger-update-btn" type="button">🚀 Jetzt aktualisieren</button>
                </div>
                <div class="update-log-box" id="settings-update-log-box" style="display: none;">
                  <pre id="settings-update-log-text"></pre>
                </div>
              </div>
            </div>
          </section>

          <!-- 7. Sicherheit: Admin-PIN ändern -->
          <section class="settings-card">
            <div class="settings-card-header">
              <span class="settings-card-icon">🔒</span>
              <div>
                <h2 class="settings-card-title">Sicherheit &amp; Admin-PIN</h2>
                <p class="settings-card-desc">PIN zum Schützen von Einstellungen und Bild-Uploads</p>
              </div>
            </div>
            <div class="settings-card-body">
              <form id="settings-pin-change-form" class="settings-pin-form">
                <div class="system-field-row">
                  <label for="settings-curr-pin">
                    <span>Aktuelle PIN</span>
                    <input id="settings-curr-pin" type="password" inputmode="numeric" required />
                  </label>
                  <label for="settings-new-pin">
                    <span>Neue PIN (4–64 Ziffern)</span>
                    <input id="settings-new-pin" type="password" inputmode="numeric" pattern="[0-9]{4,64}" minlength="4" maxlength="64" required />
                  </label>
                </div>
                <label for="settings-confirm-pin">
                  <span>Neue PIN wiederholen</span>
                  <input id="settings-confirm-pin" type="password" inputmode="numeric" pattern="[0-9]{4,64}" minlength="4" maxlength="64" required />
                </label>
                <p class="pin-error" id="settings-pin-error" role="alert"></p>
                <div class="settings-pin-actions">
                  <button class="secondary-button" id="settings-pin-submit" type="submit">PIN jetzt ändern</button>
                </div>
              </form>
            </div>
          </section>
        </div>
      </main>

      <p class="save-message" id="settings-save-message" role="status"></p>

      <dialog class="pin-dialog" id="settings-pin-dialog">
        <form method="dialog" id="settings-pin-form">
          <div class="dialog-heading">
            <div>
              <span class="widget-kicker">Admin-Bereich</span>
              <h2>PIN eingeben</h2>
            </div>
            <button class="close-button" id="settings-pin-close" type="button" aria-label="Schließen">×</button>
          </div>
          <label for="settings-dialog-pin">
            Admin-PIN
            <input id="settings-dialog-pin" type="password" inputmode="numeric" autocomplete="current-password" required />
          </label>
          <p class="pin-error" id="settings-dialog-pin-error" role="alert"></p>
          <div class="dialog-actions">
            <button class="secondary-button" id="settings-pin-cancel" type="button">Abbrechen</button>
            <button class="save-button" id="settings-dialog-pin-submit" value="default">Entsperren</button>
          </div>
        </form>
      </dialog>
    </div>
  `

  // Element Queries
  const displayScaleSelect = app.querySelector<HTMLSelectElement>('#settings-display-scale')!
  const detectedResolutionEl = app.querySelector<HTMLElement>('#settings-detected-resolution')!
  const hideCursorCheckbox = app.querySelector<HTMLInputElement>('#settings-hide-cursor')!
  const localeSelect = app.querySelector<HTMLSelectElement>('#settings-locale')!
  const timezoneSelect = app.querySelector<HTMLSelectElement>('#settings-timezone')!
  const showWeekdayCheckbox = app.querySelector<HTMLInputElement>('#settings-show-weekday')!
  const showSecondsCheckbox = app.querySelector<HTMLInputElement>('#settings-show-seconds')!
  const nightModeEnabledCheckbox = app.querySelector<HTMLInputElement>('#settings-night-mode-enabled')!
  const nightModeStartInput = app.querySelector<HTMLInputElement>('#settings-night-mode-start')!
  const nightModeEndInput = app.querySelector<HTMLInputElement>('#settings-night-mode-end')!
  const nightModeStyleSelect = app.querySelector<HTMLSelectElement>('#settings-night-mode-style')!
  const pixelShiftCheckbox = app.querySelector<HTMLInputElement>('#settings-pixel-shift-enabled')!
  const notificationSoundEnabledCheckbox = app.querySelector<HTMLInputElement>('#settings-notification-sound-enabled')!
  const notificationSoundVolumeInput = app.querySelector<HTMLInputElement>('#settings-notification-sound-volume')!
  const audioOutputSelect = app.querySelector<HTMLSelectElement>('#settings-audio-output')!
  const testSoundBtn = app.querySelector<HTMLButtonElement>('#settings-test-sound-btn')!
  const telemetryRefreshBtn = app.querySelector<HTMLButtonElement>('#settings-telemetry-refresh-btn')!
  const systemTelemetryContainer = app.querySelector<HTMLElement>('#settings-telemetry-container')!
  const systemStatusPill = app.querySelector<HTMLButtonElement>('#settings-status-pill')!
  const saveBtn = app.querySelector<HTMLButtonElement>('#save-settings-btn')!
  const saveMessage = app.querySelector<HTMLElement>('#settings-save-message')!

  const updateCheckBtn = app.querySelector<HTMLButtonElement>('#settings-update-check-btn')
  const updateCurrentVersion = app.querySelector<HTMLElement>('#settings-update-current-version')
  const updateBadge = app.querySelector<HTMLElement>('#settings-update-badge')
  const updateHint = app.querySelector<HTMLElement>('#settings-update-hint')
  const triggerUpdateBtn = app.querySelector<HTMLButtonElement>('#settings-trigger-update-btn')
  const updateLogBox = app.querySelector<HTMLElement>('#settings-update-log-box')
  const updateLogText = app.querySelector<HTMLElement>('#settings-update-log-text')

  const pinDialog = app.querySelector<HTMLDialogElement>('#settings-pin-dialog')!
  const pinInput = app.querySelector<HTMLInputElement>('#settings-dialog-pin')!
  const pinError = app.querySelector<HTMLElement>('#settings-dialog-pin-error')!
  const pinClose = app.querySelector<HTMLButtonElement>('#settings-pin-close')!
  const pinCancel = app.querySelector<HTMLButtonElement>('#settings-pin-cancel')!
  const pinSubmit = app.querySelector<HTMLButtonElement>('#settings-dialog-pin-submit')!

  const pinChangeForm = app.querySelector<HTMLFormElement>('#settings-pin-change-form')!
  const currentPinInput = app.querySelector<HTMLInputElement>('#settings-curr-pin')!
  const newPinInput = app.querySelector<HTMLInputElement>('#settings-new-pin')!
  const confirmPinInput = app.querySelector<HTMLInputElement>('#settings-confirm-pin')!
  const pinChangeError = app.querySelector<HTMLElement>('#settings-pin-error')!

  let saveTimer: number | undefined
  function showFeedback(text: string, isError = false) {
    if (saveTimer) window.clearTimeout(saveTimer)
    saveMessage.textContent = text
    saveMessage.classList.toggle('is-error', isError)
    saveMessage.classList.add('is-visible')
    saveTimer = window.setTimeout(() => {
      saveMessage.classList.remove('is-visible')
    }, 4000)
  }

  function updateResolutionDisplay() {
    const currentRes = typeof window !== 'undefined' && window.screen
      ? `${window.screen.width} × ${window.screen.height} (${Math.round((window.devicePixelRatio || 1) * 100)}% DPI)`
      : '1920 × 1080'
    const storedRes = typeof localStorage !== 'undefined' ? localStorage.getItem('homepiboard-display-resolution') : null
    detectedResolutionEl.textContent = storedRes ? `${storedRes} (dieses Gerät: ${currentRes})` : currentRes
  }

  async function refreshTelemetry() {
    try {
      const res = await fetch('/api/system', { method: 'GET', cache: 'no-store' })
      if (!res.ok) throw new Error('system-telemetry-failed')
      const data = await res.json() as {
        hostname: string
        platform: string
        arch: string
        nodeVersion: string
        uptimeSeconds: number
        loadAvg: number[]
        cpuTemp: number | null
        memory: { totalMb: number; freeMb: number; usedMb: number; percent: number }
        network: { primaryIp: string; addresses: Array<{ name: string; address: string }> }
      }

      const tempStr = data.cpuTemp !== null ? formatCpuTemp(data.cpuTemp) : ''
      const ramStr = `${data.memory.percent}% RAM`
      const ipStr = data.network.primaryIp
      systemStatusPill.textContent = [ipStr, tempStr, ramStr].filter(Boolean).join(' • ')
      systemStatusPill.title = `IP: ${ipStr} | CPU: ${tempStr || 'N/A'} | RAM: ${data.memory.usedMb}/${data.memory.totalMb} MB (${ramStr})`

      const uptimeStr = formatUptime(data.uptimeSeconds)
      const loadStr = data.loadAvg.join(', ')

      systemTelemetryContainer.innerHTML = `
        <div class="system-telemetry-grid">
          <div class="telemetry-card">
            <span class="telemetry-label">🌐 Lokale IP (HDMI / LAN)</span>
            <div class="telemetry-val-group">
              <strong class="telemetry-val">${escapeHtml(ipStr)}</strong>
              <a class="telemetry-link" href="http://${escapeHtml(ipStr)}:4173/admin" target="_blank" rel="noreferrer" title="Im Browser öffnen">Öffnen ↗</a>
            </div>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">🌡️ CPU-Temperatur</span>
            <strong class="telemetry-val ${data.cpuTemp !== null && data.cpuTemp > 70 ? 'is-warning' : ''}">${escapeHtml(tempStr || 'N/A (nicht Linux)')}</strong>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">💾 Arbeitsspeicher (RAM)</span>
            <strong class="telemetry-val">${data.memory.usedMb} / ${data.memory.totalMb} MB <small>(${data.memory.percent}%)</small></strong>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">⚡ CPU-Auslastung (Load)</span>
            <strong class="telemetry-val">${escapeHtml(loadStr)}</strong>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">⏱️ Systemlaufzeit (Uptime)</span>
            <strong class="telemetry-val">${escapeHtml(uptimeStr)}</strong>
          </div>
          <div class="telemetry-card">
            <span class="telemetry-label">🖥️ Betriebssystem / Host</span>
            <strong class="telemetry-val"><small>${escapeHtml(data.hostname)} (${escapeHtml(data.platform)} ${escapeHtml(data.arch)})</small></strong>
          </div>
        </div>
      `
    } catch {
      systemStatusPill.textContent = 'Pi: Offline'
      systemTelemetryContainer.innerHTML = '<p class="telemetry-offline-hint">Telemetriedaten konnten nicht geladen werden.</p>'
    }
  }

  let pinRequest: Promise<string | null> | null = null
  function requestPin() {
    if (pinRequest) return pinRequest
    pinRequest = new Promise<string | null>((resolve) => {
      let active = true
      pinError.textContent = ''
      pinInput.value = ''
      pinSubmit.disabled = false
      pinDialog.showModal()
      pinInput.focus()

      const finish = (value: string | null) => {
        if (!active) return
        active = false
        cleanup()
        if (pinDialog.open) pinDialog.close()
        pinRequest = null
        resolve(value)
      }
      const close = () => finish(null)
      const submit = async (event: SubmitEvent) => {
        event.preventDefault()
        const pin = pinInput.value.trim()
        clearPinError(pinError)
        pinSubmit.disabled = true
        pinSubmit.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Prüfe …</span>'
        let valid = false
        try {
          valid = await store.verifyPin(pin)
        } catch (error) {
          pinError.textContent = adminErrorMessage(error, 'Die PIN konnte nicht geprüft werden. Prüfe die Serververbindung.')
        }
        if (!active) return
        pinSubmit.disabled = false
        pinSubmit.textContent = 'Entsperren'
        if (!valid) {
          if (!pinError.textContent) pinError.textContent = 'Die PIN ist nicht korrekt oder der Server ist nicht erreichbar.'
          pinInput.select()
          return
        }
        sessionStorage.setItem(pinKey, pin)
        finish(pin)
      }
      const cleanup = () => {
        pinDialog.removeEventListener('cancel', close)
        pinClose.removeEventListener('click', close)
        pinCancel.removeEventListener('click', close)
        pinDialog.querySelector('form')?.removeEventListener('submit', submit)
      }
      pinDialog.addEventListener('cancel', close)
      pinClose.addEventListener('click', close)
      pinCancel.addEventListener('click', close)
      pinDialog.querySelector('form')?.addEventListener('submit', submit)
    })
    return pinRequest
  }

  async function checkUpdateStatus(fetchRemote = false) {
    if (!updateCurrentVersion || !updateBadge) return
    if (fetchRemote && updateCheckBtn) {
      updateCheckBtn.disabled = true
      updateCheckBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Prüfe …</span>'
    }
    try {
      const res = await fetch(`/api/system/update-status${fetchRemote ? '?check=1' : ''}`, { method: 'GET', cache: 'no-store' })
      if (!res.ok) throw new Error('status-failed')
      const data = await res.json() as {
        success: boolean
        branch: string
        currentCommit: string
        currentCommitMsg: string
        remoteCommit: string
        updateAvailable: boolean
        pendingCommits: string[]
      }
      updateCurrentVersion.textContent = `${data.branch} (${data.currentCommit})`
      updateCurrentVersion.title = data.currentCommitMsg || ''

      if (data.updateAvailable) {
        updateBadge.className = 'update-badge is-available'
        updateBadge.textContent = `⚡ Update verfügbar (${data.remoteCommit})`
        if (data.pendingCommits && data.pendingCommits.length) {
          updateHint!.textContent = `Neu: ${data.pendingCommits.join(', ')}`
        } else {
          updateHint!.textContent = 'Ein neues Update ist auf GitHub verfügbar. Klicke unten, um es direkt einzuspielen.'
        }
        if (triggerUpdateBtn) {
          triggerUpdateBtn.textContent = `🚀 Jetzt auf ${data.remoteCommit} aktualisieren`
          triggerUpdateBtn.disabled = false
        }
      } else {
        updateBadge.className = 'update-badge is-uptodate'
        updateBadge.textContent = '✓ Auf neuestem Stand'
        updateHint!.textContent = 'Dein HomePiBoard ist auf dem aktuellsten Stand von GitHub.'
        if (triggerUpdateBtn) {
          triggerUpdateBtn.textContent = '🔄 Neu kompilieren / erzwingen'
          triggerUpdateBtn.disabled = false
        }
      }
    } catch {
      updateCurrentVersion.textContent = 'Unbekannt'
      updateBadge.className = 'update-badge is-error'
      updateBadge.textContent = 'Prüfung fehlgeschlagen'
    } finally {
      if (updateCheckBtn) {
        updateCheckBtn.disabled = false
        updateCheckBtn.textContent = '🔍 Nach Updates suchen'
      }
    }
  }

  async function triggerUpdate() {
    if (!triggerUpdateBtn) return
    let pin = sessionStorage.getItem(pinKey)
    if (!pin) {
      pin = await requestPin()
      if (!pin) return
    }

    triggerUpdateBtn.disabled = true
    if (updateCheckBtn) updateCheckBtn.disabled = true
    triggerUpdateBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Update läuft (git pull, build) …</span>'
    if (updateBadge) {
      updateBadge.className = 'update-badge is-updating'
      updateBadge.textContent = '⏳ Update wird ausgeführt …'
    }
    if (updateLogBox) {
      updateLogBox.style.display = 'block'
      if (updateLogText) updateLogText.textContent = 'Starte Aktualisierung...\n'
    }

    try {
      let res = await fetch('/api/system/update', {
        method: 'POST',
        headers: { 'x-admin-pin': pin },
      })

      if (res.status === 401) {
        sessionStorage.removeItem(pinKey)
        const retryPin = await requestPin()
        if (!retryPin) {
          throw new Error('PIN erforderlich.')
        }
        pin = retryPin
        res = await fetch('/api/system/update', {
          method: 'POST',
          headers: { 'x-admin-pin': pin },
        })
      }

      if (!res.ok) {
        const errData = await res.json().catch(() => ({})) as { error?: string }
        throw new Error(errData.error || `HTTP ${res.status}`)
      }

      const result = await res.json() as { success: boolean; newCommit: string; log: string; restarting?: boolean }
      if (updateLogText) {
        updateLogText.textContent = result.log || 'Update erfolgreich abgeschlossen!'
      }
      if (updateBadge) {
        updateBadge.className = 'update-badge is-uptodate'
        updateBadge.textContent = `🎉 Erfolgreich auf ${result.newCommit} aktualisiert!`
      }
      if (updateHint) {
        updateHint.textContent = result.restarting
          ? 'Der Server und der HDMI-Monitor starten neu. Die Seite lädt in 3 Sekunden automatisch neu …'
          : 'Update abgeschlossen. Der HDMI-Monitor wurde aktualisiert.'
      }

      if (result.restarting) {
        triggerUpdateBtn.textContent = '✓ Aktualisiert (Server startet neu...)'
        window.setTimeout(() => {
          window.location.reload()
        }, 3500)
      } else {
        triggerUpdateBtn.textContent = '✓ Erfolgreich'
        window.setTimeout(() => {
          triggerUpdateBtn.disabled = false
          triggerUpdateBtn.textContent = '🚀 Jetzt aktualisieren'
          if (updateCheckBtn) updateCheckBtn.disabled = false
        }, 3000)
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      if (updateBadge) {
        updateBadge.className = 'update-badge is-error'
        updateBadge.textContent = '❌ Update fehlgeschlagen'
      }
      if (updateLogText) {
        updateLogText.textContent += `\nFehler: ${msg}`
      }
      triggerUpdateBtn.disabled = false
      triggerUpdateBtn.textContent = 'Erneut versuchen'
      if (updateCheckBtn) updateCheckBtn.disabled = false
    }
  }

  let isSettingsDirty = false
  const markDirty = () => {
    isSettingsDirty = true
    saveBtn.innerHTML = '<span class="unsaved-badge-dot">●</span> <span>Änderungen speichern</span>'
    saveBtn.classList.add('is-dirty')
  }
  const markClean = () => {
    isSettingsDirty = false
    saveBtn.textContent = '💾 Einstellungen speichern'
    saveBtn.classList.remove('is-dirty')
  }

  async function saveSettings() {
    let pin = sessionStorage.getItem(pinKey)
    if (!pin) {
      pin = await requestPin()
      if (!pin) return
    }

    const { settings: currentSettings } = await store.load()
    const nextSettings = normalizeSettings({
      ...currentSettings,
      version: SETTINGS_VERSION,
      timezone: timezoneSelect.value,
      locale: localeSelect.value,
      showWeekday: showWeekdayCheckbox.checked,
      showSeconds: showSecondsCheckbox.checked,
      displayScale: Number(displayScaleSelect.value),
      hideCursor: hideCursorCheckbox.checked,
      nightModeEnabled: nightModeEnabledCheckbox.checked,
      nightModeStart: nightModeStartInput.value,
      nightModeEnd: nightModeEndInput.value,
      nightModeStyle: nightModeStyleSelect.value as 'dim' | 'clock',
      pixelShiftEnabled: pixelShiftCheckbox.checked,
      notificationSoundEnabled: notificationSoundEnabledCheckbox.checked,
      notificationSoundVolume: Number(notificationSoundVolumeInput.value) || 0.8,
      audioOutput: (audioOutputSelect?.value as 'hdmi' | 'jack') || 'hdmi',
    })

    saveBtn.disabled = true
    saveBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Speichert …</span>'

    try {
      const saved = await store.save(nextSettings, pin)
      if (saved.source === 'local') {
        showFeedback('Änderungen nur lokal gespeichert (Server offline).', true)
      } else {
        markClean()
        showFeedback('✓ Einstellungen erfolgreich gespeichert! Alle Anzeigen übernehmen die Änderung.')
      }
    } catch (error) {
      showFeedback(adminErrorMessage(error, 'Fehler beim Speichern der Einstellungen.'), true)
    } finally {
      saveBtn.disabled = false
      if (!isSettingsDirty) {
        markClean()
      } else {
        markDirty()
      }
    }
  }

  // Dirty tracking for settings form inputs
  app.querySelectorAll<HTMLInputElement | HTMLSelectElement>('.settings-main-content input, .settings-main-content select').forEach((ctrl) => {
    if (ctrl.closest('#settings-pin-change-form')) return
    ctrl.addEventListener('input', markDirty)
    ctrl.addEventListener('change', markDirty)
  })

  // Event Listeners
  const soundVolumeValEl = app.querySelector<HTMLElement>('#settings-notification-sound-volume-val')
  notificationSoundVolumeInput?.addEventListener('input', () => {
    if (soundVolumeValEl) {
      soundVolumeValEl.textContent = `${Math.round(Number(notificationSoundVolumeInput.value) * 100)}%`
    }
  })
  saveBtn.addEventListener('click', saveSettings)
  testSoundBtn?.addEventListener('click', () => {
    void playNotificationSound('doorbell', Number(notificationSoundVolumeInput?.value) || 0.8)
  })
  telemetryRefreshBtn.addEventListener('click', async () => {
    telemetryRefreshBtn.disabled = true
    telemetryRefreshBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Lade …</span>'
    try {
      await refreshTelemetry()
    } finally {
      telemetryRefreshBtn.disabled = false
      telemetryRefreshBtn.textContent = '↻ Aktualisieren'
    }
  })

  updateCheckBtn?.addEventListener('click', () => checkUpdateStatus(true))
  triggerUpdateBtn?.addEventListener('click', triggerUpdate)

  pinChangeForm.addEventListener('submit', async (e) => {
    e.preventDefault()
    clearPinError(pinChangeError)
    const validationMessage = validatePinChange(newPinInput.value, confirmPinInput.value)
    if (validationMessage) {
      pinChangeError.textContent = validationMessage
      return
    }

    const submitBtn = pinChangeForm.querySelector<HTMLButtonElement>('#settings-pin-submit')!
    submitBtn.disabled = true
    submitBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Ändere PIN …</span>'

    try {
      await store.changePin(currentPinInput.value, newPinInput.value)
      sessionStorage.setItem(pinKey, newPinInput.value)
      pinChangeForm.reset()
      showFeedback('✓ Admin-PIN erfolgreich geändert.')
    } catch (error) {
      pinChangeError.textContent = adminErrorMessage(error, 'Die PIN konnte nicht geändert werden.')
    } finally {
      submitBtn.disabled = false
      submitBtn.textContent = 'PIN jetzt ändern'
    }
  })

  // Init
  updateResolutionDisplay()
  refreshTelemetry()
  checkUpdateStatus(false)
  window.setInterval(refreshTelemetry, 30000)
}
