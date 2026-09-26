import { escapeHtml } from './dashboard-utils.ts'
import { playNotificationSound } from './display.ts'
import { createWidget, defaultSettings, GRID_COLUMNS, GRID_ROWS, layoutFits, MAX_WIDGET_COLUMNS, MAX_WIDGET_ROWS, normalizeSettings, SETTINGS_VERSION, widgetConstraints, type DashboardWidget, type WidgetType } from './settings.ts'
import { createSettingsStore, RateLimitError, SettingsServerError, UnauthorizedError } from './settings-store.ts'
import { parseCalendarFeed } from './calendar-feed.ts'
import { bindWidgetFrames, isBuiltInCalendar, parseSlideshowUrls, renderSlideshowCrudList, renderWidget, renderWidgetContent, widgetTypeLabel } from './widgets.ts'

const pinKey = 'homepiboard-admin-pin'

export function validatePinChange(newPin: string, confirmation: string) {
  if (!/^\d{4,64}$/.test(newPin)) return 'Die neue PIN muss aus 4 bis 64 Ziffern bestehen.'
  if (newPin !== confirmation) return 'Die neuen PINs stimmen nicht überein.'
  return ''
}

export function adminErrorMessage(error: unknown, fallback: string) {
  if (error instanceof RateLimitError) {
    return `Zu viele Fehlversuche. Versuche es in ${error.retryAfterSeconds} Sekunden erneut.`
  }
  if (error instanceof SettingsServerError && error.status === 500) {
    return `${fallback} Prüfe die Serverkonfiguration und gegebenenfalls data/auth.json.`
  }
  return fallback
}

export function clearPinError(errorElement: { textContent: string }) {
  errorElement.textContent = ''
}

export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const mins = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}d ${hours}h ${mins}m`
  if (hours > 0) return `${hours}h ${mins}m`
  return `${mins}m`
}

export function formatCpuTemp(temp: number | null): string {
  return temp !== null ? `${temp.toFixed(1)} °C` : 'N/A'
}

export function resizeWidgetDimensions(type: WidgetType, columns: number, rows: number, deltaColumns: number, deltaRows: number, currentColumns = columns, currentRows = rows) {
  const constraints = widgetConstraints[type]
  const resizedColumns = Math.max(constraints.minColumns, Math.min(MAX_WIDGET_COLUMNS, Math.round(columns + deltaColumns)))
  const resizedRows = Math.max(constraints.minRows, Math.min(MAX_WIDGET_ROWS, Math.round(rows + deltaRows)))
  return {
    columns: resizedColumns,
    rows: resizedRows,
    changed: resizedColumns !== currentColumns || resizedRows !== currentRows,
  }
}

export function resizeKeyboardDelta(key: string, accelerated = false): [number, number] | null {
  const step = accelerated ? 4 : 1
  const directions: Record<string, [number, number]> = {
    ArrowLeft: [-step, 0],
    ArrowRight: [step, 0],
    ArrowUp: [0, -step],
    ArrowDown: [0, step],
  }
  return directions[key] ?? null
}

export function resizePointerDelta(deltaX: number, deltaY: number, columnWidth: number, rowHeight: number): [number, number] {
  const snap = (distance: number, cellSize: number) => {
    const units = Math.floor(Math.abs(distance) / Math.max(1, cellSize) + 0.5)
    return units === 0 ? 0 : Math.sign(distance) * units
  }
  return [snap(deltaX, columnWidth), snap(deltaY, rowHeight)]
}

export function resizeChangedFromStart(startColumns: number, startRows: number, currentColumns: number, currentRows: number) {
  return startColumns !== currentColumns || startRows !== currentRows
}

export function lostPointerCaptureAction(intentionallyReleasing: boolean): 'cleanup' | 'cancel' {
  return intentionallyReleasing ? 'cleanup' : 'cancel'
}

export function widgetPreviewAspectRatio(type: WidgetType, columns: number, rows: number, viewportWidth: number, viewportHeight: number, url = '') {
  if (viewportWidth <= 720) {
    const usesBuiltInCalendar = isBuiltInCalendar(type, url)
    const minimumHeight = usesBuiltInCalendar ? 315 : 250
    const preferredHeight = viewportHeight * (usesBuiltInCalendar ? 0.65 : 0.55)
    const maximumHeight = usesBuiltInCalendar ? 520 : 460
    const widgetHeight = Math.min(maximumHeight, Math.max(minimumHeight, preferredHeight))
    return Math.max(1, viewportWidth) / widgetHeight
  }
  const gridWidth = Math.max(1, viewportWidth - 16)
  const gridHeight = Math.max(1, viewportHeight - 87 + 8)
  const gap = Math.min(14, Math.max(6, viewportWidth * 0.01))
  const columnWidth = Math.max(1, (gridWidth - gap * (GRID_COLUMNS - 1)) / GRID_COLUMNS)
  const rowHeight = Math.max(1, (gridHeight - gap * (GRID_ROWS - 1)) / GRID_ROWS)
  const widgetWidth = columnWidth * columns + gap * Math.max(0, columns - 1)
  const widgetHeight = rowHeight * rows + gap * Math.max(0, rows - 1)
  return Math.min(4, Math.max(0.75, widgetWidth / widgetHeight))
}

export function compactFieldCharacters(value: string) {
  const longestLine = value.split(/\r?\n/).reduce((longest, line) => Math.max(longest, line.length), 0)
  return Math.min(80, Math.max(4, longestLine * 2))
}

type CompactFieldControl = {
  tagName: string
  type?: string
  value: string
  placeholder?: string
  style: { width: string }
  selectedOptions?: ArrayLike<{ textContent: string | null }>
}

export function syncCompactField(control: CompactFieldControl) {
  const isSelect = control.tagName === 'SELECT'
  const selectedText = isSelect ? control.selectedOptions?.[0]?.textContent?.trim() : ''
  const content = selectedText || control.value || control.placeholder || ''
  const chromeWidth = isSelect ? 38 : control.tagName === 'INPUT' && control.type === 'number' ? 40 : 32
  control.style.width = `min(100%, calc(${compactFieldCharacters(content)}ch + ${chromeWidth}px))`
}

export type ConfirmModalOptions = {
  kicker?: string
  title: string
  message: string
  confirmText?: string
  cancelText?: string
  isDanger?: boolean
}

export function loadingSpinnerHtml(): string {
  return '<span class="loading-spinner" aria-hidden="true"></span>'
}

export function createConfirmModal(root: ParentNode) {
  const dialog = root.querySelector<HTMLDialogElement>('#confirm-dialog')
  const kickerEl = root.querySelector<HTMLElement>('#confirm-kicker')
  const titleEl = root.querySelector<HTMLElement>('#confirm-title')
  const messageEl = root.querySelector<HTMLElement>('#confirm-message')
  const closeBtn = root.querySelector<HTMLButtonElement>('#confirm-close')
  const cancelBtn = root.querySelector<HTMLButtonElement>('#confirm-cancel')
  const okBtn = root.querySelector<HTMLButtonElement>('#confirm-ok')

  return (options: ConfirmModalOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      if (!dialog) {
        resolve(typeof window !== 'undefined' && typeof window.confirm === 'function' ? window.confirm(options.message) : true)
        return
      }

      if (kickerEl) kickerEl.textContent = options.kicker || 'Bestätigung'
      if (titleEl) titleEl.textContent = options.title
      if (messageEl) messageEl.textContent = options.message
      if (okBtn) {
        okBtn.textContent = options.confirmText || 'Bestätigen'
        okBtn.className = options.isDanger !== false ? 'danger-confirm-button' : 'save-button'
      }
      if (cancelBtn) cancelBtn.textContent = options.cancelText || 'Abbrechen'

      let settled = false
      const finish = (result: boolean) => {
        if (settled) return
        settled = true
        cleanup()
        if (typeof dialog.close === 'function') {
          dialog.close()
        } else {
          dialog.removeAttribute('open')
        }
        resolve(result)
      }

      const onOk = (e: Event) => {
        e.preventDefault()
        finish(true)
      }
      const onCancel = (e: Event) => {
        e.preventDefault()
        finish(false)
      }
      const onKeyDown = (e: KeyboardEvent) => {
        if (e.key === 'Escape') {
          e.preventDefault()
          finish(false)
        }
      }

      const cleanup = () => {
        okBtn?.removeEventListener('click', onOk)
        cancelBtn?.removeEventListener('click', onCancel)
        closeBtn?.removeEventListener('click', onCancel)
        dialog.removeEventListener('keydown', onKeyDown)
      }

      okBtn?.addEventListener('click', onOk)
      cancelBtn?.addEventListener('click', onCancel)
      closeBtn?.addEventListener('click', onCancel)
      dialog.addEventListener('keydown', onKeyDown)

      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      okBtn?.focus()
    })
  }
}

function renderWidgetEditor(widget: DashboardWidget, index: number) {
  return renderWidget(widget, true, index)
}

export async function renderAdminPage(app: HTMLElement) {
  const store = createSettingsStore()
  const loaded = await store.load()
  const settings = loaded.settings

  app.innerHTML = `<main class="admin-shell">
    <form class="admin-form" id="admin-form">
      <header class="admin-topbar">
        <div class="admin-topbar-brand">
          <a class="brand-mark" href="/" aria-label="HomePiBoard Anzeige"><img class="brand-logo" src="/homepiboard-logo.svg" alt="" /></a>
          <span class="admin-brand-title">HomePiBoard <em>EDIT</em></span>
        </div>
        <div class="admin-global-fields">
          <label class="topbar-field" for="admin-location"><span>Name</span><input id="admin-location" maxlength="24" value="${escapeHtml(settings.location)}" placeholder="Zuhause" /></label>
          <label class="topbar-field" for="admin-weather-city"><span>Wetter</span><input id="admin-weather-city" maxlength="40" value="${escapeHtml(settings.weatherCity)}" placeholder="Berlin" /></label>
          <button class="topbar-btn" id="display-settings-button" type="button" title="Display-, HDMI- & Systemeinstellungen">⚙ System & HDMI</button>
          <button class="topbar-btn" id="change-pin-button" type="button" title="Admin-PIN ändern">🔑 PIN</button>
        </div>
        <div class="admin-header-actions">
          <span class="connection-status ${loaded.source === 'server' ? 'is-online' : ''}">${loaded.source === 'server' ? 'SERVER' : 'LOKAL'}</span>
          <span class="save-state" id="save-state">GESPEICHERT</span>
          <button class="topbar-btn secondary" id="reset-button" type="button" title="Werkseinstellungen: Löscht alle Widgets und setzt Einstellungen auf Standard zurück">↺ Zurücksetzen</button>
          <button class="save-button" id="save-button" type="submit">Speichern</button>
          <a class="back-link" href="/" title="Zurück zur Anzeige">Anzeige ↗</a>
        </div>
      </header>
      <div class="admin-subbar">
        <div class="admin-subbar-info">
          <span class="widget-count" id="widget-count"></span>
          <span class="grid-hint">${GRID_COLUMNS} × ${GRID_ROWS} Raster • Ecke ↘ ziehen • ⚙ Einstellungen</span>
          <button class="system-status-pill" id="system-status-pill" type="button" title="Raspberry Pi Telemetrie anzeigen">Pi Telemetrie …</button>
        </div>
        <div class="add-widget-menu" aria-label="Widget hinzufügen">
          <span class="add-label">+ Widget:</span>
          <button type="button" data-add-type="web">↗ Webseite</button>
          <button type="button" data-add-type="calendar">▦ Kalender</button>
          <button type="button" data-add-type="text">≡ Text</button>
          <button type="button" data-add-type="image">▧ Bild</button>
          <button type="button" data-add-type="slideshow">▨ Diashow</button>
          <button type="button" data-add-type="waste">🗑️ Müll</button>
          <button type="button" data-add-type="media">📻 Radio</button>
        </div>
      </div>
      <p class="layout-warning" id="layout-warning" role="alert"></p>
      <div class="admin-canvas">
        <div class="widget-editors" id="widget-editors">${settings.widgets.map(renderWidgetEditor).join('')}</div>
        <div class="empty-editor-state" id="empty-editor-state">
          <strong>Noch keine Widgets</strong>
          <span>Klicke oben auf ein Widget, um es hinzuzufügen.</span>
        </div>
      </div>
      <p class="save-message" id="save-message" role="status"></p>
    </form>
  </main>
  <dialog class="pin-dialog" id="pin-dialog"><form method="dialog" id="pin-form"><div class="dialog-heading"><div><span class="widget-kicker">Admin-Bereich</span><h2>PIN eingeben</h2></div><button class="close-button" id="pin-close" type="button" aria-label="Schließen">×</button></div><label for="admin-pin">Admin-PIN<input id="admin-pin" type="password" inputmode="numeric" autocomplete="current-password" required /></label><p class="pin-error" id="pin-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="pin-cancel" type="button">Abbrechen</button><button class="save-button" id="pin-submit" value="default">Entsperren</button></div></form></dialog>
  <dialog class="pin-dialog" id="change-pin-dialog"><form id="change-pin-form"><div class="dialog-heading"><div><span class="widget-kicker">Sicherheit</span><h2>Admin-PIN ändern</h2></div><button class="close-button" id="change-pin-close" type="button" aria-label="Schließen">×</button></div><label for="current-admin-pin">Aktuelle PIN<input id="current-admin-pin" type="password" inputmode="numeric" autocomplete="current-password" required /></label><label for="new-admin-pin">Neue PIN<span>4 bis 64 Ziffern</span><input id="new-admin-pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,64}" minlength="4" maxlength="64" required /></label><label for="confirm-admin-pin">Neue PIN wiederholen<input id="confirm-admin-pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{4,64}" minlength="4" maxlength="64" required /></label><p class="pin-error" id="change-pin-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="change-pin-cancel" type="button">Abbrechen</button><button class="save-button" id="change-pin-submit" type="submit">PIN speichern</button></div></form></dialog>
  <dialog class="pin-dialog system-settings-dialog" id="system-settings-dialog">
    <div class="system-dialog-content">
      <div class="dialog-heading">
        <div>
          <span class="widget-kicker">Raspberry Pi & HDMI</span>
          <h2>System- & Display-Einstellungen</h2>
        </div>
        <button class="close-button" id="system-settings-close" type="button" aria-label="Schließen">×</button>
      </div>

      <section class="system-dialog-section">
        <h3 class="system-section-title">📺 HDMI & Bildschirm</h3>
        <div class="system-field-row">
          <label for="admin-display-scale">
            <span>Display-Zoom / Skalierung</span>
            <select id="admin-display-scale">
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
            <strong id="admin-detected-resolution">-- × --</strong>
          </div>
        </div>
        <label class="system-checkbox-label" for="admin-hide-cursor">
          <input type="checkbox" id="admin-hide-cursor" ${settings.hideCursor !== false ? 'checked' : ''} />
          <span>Mauszeiger auf der HDMI-Anzeige automatisch ausblenden (nach 2 Sek. Inaktivität)</span>
        </label>
      </section>

      <section class="system-dialog-section">
        <h3 class="system-section-title">🕒 Uhrzeit, Sprache & Datum</h3>
        <div class="system-field-row">
          <label for="admin-locale">
            <span>Sprache / Datumsformat</span>
            <select id="admin-locale">
              <option value="de-DE" ${(settings.locale || 'de-DE') === 'de-DE' ? 'selected' : ''}>Deutsch (Deutschland)</option>
              <option value="de-AT" ${(settings.locale || 'de-DE') === 'de-AT' ? 'selected' : ''}>Deutsch (Österreich)</option>
              <option value="de-CH" ${(settings.locale || 'de-DE') === 'de-CH' ? 'selected' : ''}>Deutsch (Schweiz)</option>
              <option value="en-US" ${(settings.locale || 'de-DE') === 'en-US' ? 'selected' : ''}>English (US)</option>
              <option value="en-GB" ${(settings.locale || 'de-DE') === 'en-GB' ? 'selected' : ''}>English (UK)</option>
              <option value="fr-FR" ${(settings.locale || 'de-DE') === 'fr-FR' ? 'selected' : ''}>Français</option>
            </select>
          </label>
          <label for="admin-timezone">
            <span>Zeitzone</span>
            <select id="admin-timezone">
              <option value="auto" ${(settings.timezone || 'auto') === 'auto' ? 'selected' : ''}>Automatisch (Systemzeit)</option>
              <option value="Europe/Berlin" ${(settings.timezone || 'auto') === 'Europe/Berlin' ? 'selected' : ''}>Europe/Berlin (Deutschland)</option>
              <option value="Europe/Vienna" ${(settings.timezone || 'auto') === 'Europe/Vienna' ? 'selected' : ''}>Europe/Vienna (Österreich)</option>
              <option value="Europe/Zurich" ${(settings.timezone || 'auto') === 'Europe/Zurich' ? 'selected' : ''}>Europe/Zurich (Schweiz)</option>
              <option value="UTC" ${(settings.timezone || 'auto') === 'UTC' ? 'selected' : ''}>UTC</option>
            </select>
          </label>
        </div>
        <label class="system-checkbox-label" for="admin-show-seconds">
          <input type="checkbox" id="admin-show-seconds" ${settings.showSeconds ? 'checked' : ''} />
          <span>Sekunden in der Digitaluhr anzeigen (z. B. 12:45:30)</span>
        </label>
      </section>

      <section class="system-dialog-section">
        <h3 class="system-section-title">🌙 Nachtmodus &amp; Bildschirmschutz</h3>
        <label class="system-checkbox-label" for="admin-night-mode-enabled">
          <input type="checkbox" id="admin-night-mode-enabled" ${settings.nightModeEnabled ? 'checked' : ''} />
          <span>Automatischer Nachtmodus aktivieren</span>
        </label>
        <div class="system-field-row">
          <label for="admin-night-mode-start">
            <span>Beginn (Nachtruhe)</span>
            <input type="time" id="admin-night-mode-start" value="${settings.nightModeStart || '22:00'}" />
          </label>
          <label for="admin-night-mode-end">
            <span>Ende (Aufwachen)</span>
            <input type="time" id="admin-night-mode-end" value="${settings.nightModeEnd || '06:00'}" />
          </label>
          <label for="admin-night-mode-style">
            <span>Nacht-Darstellung</span>
            <select id="admin-night-mode-style">
              <option value="dim" ${(settings.nightModeStyle || 'dim') === 'dim' ? 'selected' : ''}>Gedimmt (15% Helligkeit)</option>
              <option value="clock" ${(settings.nightModeStyle || 'dim') === 'clock' ? 'selected' : ''}>Minimalistische Nacht-Uhr</option>
            </select>
          </label>
        </div>
        <label class="system-checkbox-label" for="admin-pixel-shift-enabled">
          <input type="checkbox" id="admin-pixel-shift-enabled" ${settings.pixelShiftEnabled !== false ? 'checked' : ''} />
          <span>Pixel-Shift aktivieren (Burn-In-Schutz alle 5 Min. für OLED &amp; LCD)</span>
        </label>
        <small class="system-field-hint">💡 Wake-on-Tap: Durch Berührung oder Klick schaltet das Display nachts sofort für 30 Sekunden auf normale Helligkeit zurück.</small>
      </section>

      <section class="system-dialog-section">
        <div class="system-section-header">
          <h3 class="system-section-title">🔔 Webhook-Benachrichtigungen &amp; Klingel-Gong</h3>
          <button class="topbar-btn" id="test-sound-btn" type="button" title="Gong-Signalton anhören">🔔 Signalton testen</button>
        </div>
        <label class="system-checkbox-label" for="admin-notification-sound-enabled">
          <input type="checkbox" id="admin-notification-sound-enabled" ${settings.notificationSoundEnabled !== false ? 'checked' : ''} />
          <span>Akustischen Signalton bei Benachrichtigungen abspielen</span>
        </label>
        <div class="system-field-row">
          <label for="admin-notification-sound-volume">
            <span>Lautstärke des Signaltons</span>
            <input type="range" id="admin-notification-sound-volume" min="0.1" max="1.0" step="0.05" value="${settings.notificationSoundVolume ?? 0.8}" />
          </label>
        </div>
        <small class="system-field-hint">💡 HTTP-Webhook: Sende <code>POST /api/notify</code> mit JSON: <code>{"title": "Türklingel", "message": "Jemand steht an der Haustür", "sound": "doorbell"}</code></small>
      </section>

      <section class="system-dialog-section">
        <div class="system-section-header">
          <h3 class="system-section-title">📊 Live Raspberry Pi Telemetrie</h3>
          <button class="topbar-btn" id="telemetry-refresh-btn" type="button" title="Telemetrie aktualisieren">↻ Aktualisieren</button>
        </div>
        <div id="system-telemetry-container" class="system-telemetry-container">
          <span>Lade Telemetrie …</span>
        </div>
      </section>

      <div class="dialog-actions">
        <button class="secondary-button" id="system-settings-cancel" type="button">Abbrechen</button>
        <button class="save-button" id="system-settings-apply" type="button">Übernehmen</button>
      </div>
    </div>
  </dialog>
  <dialog class="pin-dialog confirm-dialog" id="confirm-dialog">
    <form method="dialog" id="confirm-form">
      <div class="dialog-heading">
        <div>
          <span class="widget-kicker" id="confirm-kicker">Bestätigung</span>
          <h2 id="confirm-title">Wirklich löschen?</h2>
        </div>
        <button class="close-button" id="confirm-close" type="button" aria-label="Schließen">×</button>
      </div>
      <p class="confirm-message" id="confirm-message">Möchtest du dieses Widget wirklich unwiderruflich löschen?</p>
      <div class="dialog-actions">
        <button class="secondary-button" id="confirm-cancel" type="button">Abbrechen</button>
        <button class="danger-confirm-button" id="confirm-ok" type="button">Löschen</button>
      </div>
    </form>
  </dialog>`

  const showConfirm = createConfirmModal(app)
  const editorList = app.querySelector<HTMLElement>('#widget-editors')!
  const message = app.querySelector<HTMLElement>('#save-message')!
  const saveButton = app.querySelector<HTMLButtonElement>('#save-button')!
  const saveState = app.querySelector<HTMLElement>('#save-state')!
  const connectionStatus = app.querySelector<HTMLElement>('.connection-status')!
  const widgetCount = app.querySelector<HTMLElement>('#widget-count')!
  const emptyState = app.querySelector<HTMLElement>('#empty-editor-state')!
  const layoutWarning = app.querySelector<HTMLElement>('#layout-warning')!
  const pinDialog = app.querySelector<HTMLDialogElement>('#pin-dialog')!
  const pinForm = app.querySelector<HTMLFormElement>('#pin-form')!
  const pinClose = app.querySelector<HTMLButtonElement>('#pin-close')!
  const pinCancel = app.querySelector<HTMLButtonElement>('#pin-cancel')!
  const pinSubmit = app.querySelector<HTMLButtonElement>('#pin-submit')!
  const pinInput = app.querySelector<HTMLInputElement>('#admin-pin')!
  const pinError = app.querySelector<HTMLElement>('#pin-error')!
  const changePinButton = app.querySelector<HTMLButtonElement>('#change-pin-button')!
  const changePinDialog = app.querySelector<HTMLDialogElement>('#change-pin-dialog')!
  const changePinForm = app.querySelector<HTMLFormElement>('#change-pin-form')!
  const changePinClose = app.querySelector<HTMLButtonElement>('#change-pin-close')!
  const changePinCancel = app.querySelector<HTMLButtonElement>('#change-pin-cancel')!
  const changePinSubmit = app.querySelector<HTMLButtonElement>('#change-pin-submit')!
  const currentPinInput = app.querySelector<HTMLInputElement>('#current-admin-pin')!
  const newPinInput = app.querySelector<HTMLInputElement>('#new-admin-pin')!
  const confirmPinInput = app.querySelector<HTMLInputElement>('#confirm-admin-pin')!
  const changePinError = app.querySelector<HTMLElement>('#change-pin-error')!
  const displaySettingsButton = app.querySelector<HTMLButtonElement>('#display-settings-button')!
  const systemSettingsDialog = app.querySelector<HTMLDialogElement>('#system-settings-dialog')!
  const systemSettingsClose = app.querySelector<HTMLButtonElement>('#system-settings-close')!
  const systemSettingsCancel = app.querySelector<HTMLButtonElement>('#system-settings-cancel')!
  const systemSettingsApply = app.querySelector<HTMLButtonElement>('#system-settings-apply')!
  const displayScaleSelect = app.querySelector<HTMLSelectElement>('#admin-display-scale')!
  const detectedResolutionEl = app.querySelector<HTMLElement>('#admin-detected-resolution')!
  const hideCursorCheckbox = app.querySelector<HTMLInputElement>('#admin-hide-cursor')!
  const localeSelect = app.querySelector<HTMLSelectElement>('#admin-locale')!
  const timezoneSelect = app.querySelector<HTMLSelectElement>('#admin-timezone')!
  const showSecondsCheckbox = app.querySelector<HTMLInputElement>('#admin-show-seconds')!
  const nightModeEnabledCheckbox = app.querySelector<HTMLInputElement>('#admin-night-mode-enabled')!
  const nightModeStartInput = app.querySelector<HTMLInputElement>('#admin-night-mode-start')!
  const nightModeEndInput = app.querySelector<HTMLInputElement>('#admin-night-mode-end')!
  const nightModeStyleSelect = app.querySelector<HTMLSelectElement>('#admin-night-mode-style')!
  const pixelShiftCheckbox = app.querySelector<HTMLInputElement>('#admin-pixel-shift-enabled')!
  const notificationSoundEnabledCheckbox = app.querySelector<HTMLInputElement>('#admin-notification-sound-enabled')!
  const notificationSoundVolumeInput = app.querySelector<HTMLInputElement>('#admin-notification-sound-volume')!
  const testSoundBtn = app.querySelector<HTMLButtonElement>('#test-sound-btn')!
  const telemetryRefreshBtn = app.querySelector<HTMLButtonElement>('#telemetry-refresh-btn')!
  const systemTelemetryContainer = app.querySelector<HTMLElement>('#system-telemetry-container')!
  const systemStatusPill = app.querySelector<HTMLButtonElement>('#system-status-pill')!
  let dirty = false
  let pinRequest: Promise<string | null> | null = null

  testSoundBtn?.addEventListener('click', () => {
    void playNotificationSound('doorbell', Number(notificationSoundVolumeInput?.value) || 0.8)
  })

  function bindCompactFields(root: ParentNode) {
    root.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('input, select, textarea').forEach((control) => {
      syncCompactField(control)
      if (control.dataset.compactWidthBound === 'true') return
      control.dataset.compactWidthBound = 'true'
      control.addEventListener('input', () => syncCompactField(control))
      control.addEventListener('change', () => syncCompactField(control))
    })
  }

  function showMessage(text: string, error = false) {
    message.textContent = text
    message.classList.toggle('is-error', error)
    message.classList.add('is-visible')
    window.setTimeout(() => message.classList.remove('is-visible'), 5000)
  }

  function markDirty() {
    dirty = true
    saveState.textContent = 'UNGESPEICHERT'
    saveState.classList.add('is-dirty')
  }

  function markSaved() {
    dirty = false
    saveState.textContent = 'GESPEICHERT'
    saveState.classList.remove('is-dirty')
  }

  function updateConnectionStatus(source: 'server' | 'local') {
    connectionStatus.textContent = source === 'server' ? 'SERVER' : 'LOKAL'
    connectionStatus.classList.toggle('is-online', source === 'server')
  }

  function readWidget(editor: HTMLElement): DashboardWidget {
    const type = editor.querySelector<HTMLSelectElement>('[data-field="type"]')!.value as WidgetType
    const constraints = widgetConstraints[type]
    const refreshInput = editor.querySelector<HTMLInputElement>('[data-field="refreshIntervalMinutes"]')
    const intervalInput = editor.querySelector<HTMLInputElement>('[data-field="intervalSeconds"]')
    const refreshIntervalMinutes = type === 'web' && refreshInput
      ? Math.max(0, Math.min(1440, Math.round(Number(refreshInput.value) || 0)))
      : undefined
    const intervalSeconds = type === 'slideshow' && intervalInput
      ? Math.max(2, Math.min(3600, Math.round(Number(intervalInput.value) || 8)))
      : undefined

    const breakBefore = editor.dataset.breakBefore === 'true'
    const showTitleInput = editor.querySelector<HTMLInputElement>('[data-field="showTitle"]')
    const showTitle = Boolean(showTitleInput?.checked)

    const urlInput = editor.querySelector<HTMLInputElement | HTMLTextAreaElement>('[data-field="url"]')
    const url = urlInput ? urlInput.value.trim() : ''

    const wasteInput = editor.querySelector<HTMLTextAreaElement>('[data-field="wasteItems"]')
    const wasteItems = type === 'waste' && wasteInput ? wasteInput.value.trim() : undefined


    const mediaTitleInput = editor.querySelector<HTMLInputElement>('[data-field="mediaTitle"]')
    const mediaArtistInput = editor.querySelector<HTMLInputElement>('[data-field="mediaArtist"]')
    const mediaAlbumInput = editor.querySelector<HTMLInputElement>('[data-field="mediaAlbum"]')
    const mediaCoverInput = editor.querySelector<HTMLInputElement>('[data-field="mediaCoverUrl"]')
    const mediaPlayingInput = editor.querySelector<HTMLInputElement>('[data-field="mediaPlaying"]')
    const mediaTitle = type === 'media' && mediaTitleInput ? mediaTitleInput.value.trim() : undefined
    const mediaArtist = type === 'media' && mediaArtistInput ? mediaArtistInput.value.trim() : undefined
    const mediaAlbum = type === 'media' && mediaAlbumInput ? mediaAlbumInput.value.trim() : undefined
    const mediaCoverUrl = type === 'media' && mediaCoverInput ? mediaCoverInput.value.trim() : undefined
    const mediaPlaying = type === 'media' && mediaPlayingInput ? Boolean(mediaPlayingInput.checked) : undefined

    return {
      id: editor.dataset.widgetId!,
      type,
      title: editor.querySelector<HTMLInputElement>('[data-field="title"]')!.value.trim() || widgetTypeLabel(type),
      url,
      columns: Math.max(constraints.minColumns, Math.min(MAX_WIDGET_COLUMNS, Math.round(Number(editor.querySelector<HTMLInputElement>('[data-field="columns"]')!.value) || constraints.defaultColumns))),
      rows: Math.max(constraints.minRows, Math.min(MAX_WIDGET_ROWS, Math.round(Number(editor.querySelector<HTMLInputElement>('[data-field="rows"]')!.value) || constraints.defaultRows))),
      ...(refreshIntervalMinutes !== undefined ? { refreshIntervalMinutes } : {}),
      ...(intervalSeconds !== undefined ? { intervalSeconds } : {}),
      ...(breakBefore ? { breakBefore: true } : {}),
      ...(showTitle ? { showTitle: true } : {}),
      ...(wasteItems !== undefined ? { wasteItems } : {}),
      ...(mediaTitle !== undefined ? { mediaTitle } : {}),
      ...(mediaArtist !== undefined ? { mediaArtist } : {}),
      ...(mediaAlbum !== undefined ? { mediaAlbum } : {}),
      ...(mediaCoverUrl !== undefined ? { mediaCoverUrl } : {}),
      ...(mediaPlaying !== undefined ? { mediaPlaying } : {}),
    }
  }

  function readWidgets() {
    return [...editorList.querySelectorAll<HTMLElement>('.widget-editor')].map(readWidget)
  }

  function getWidgetRowGroups(editors: HTMLElement[]): HTMLElement[][] {
    const rows: HTMLElement[][] = []
    let currentRow: HTMLElement[] = []
    let currentCols = 0

    for (const editor of editors) {
      const cols = Math.min(GRID_COLUMNS, Math.max(1, Number(editor.dataset.columns) || 12))
      const breakBefore = editor.dataset.breakBefore === 'true'

      if (breakBefore || currentCols + cols > GRID_COLUMNS) {
        if (currentRow.length > 0) {
          rows.push(currentRow)
        }
        currentRow = [editor]
        currentCols = cols
      } else {
        currentRow.push(editor)
        currentCols += cols
      }
    }
    if (currentRow.length > 0) {
      rows.push(currentRow)
    }
    return rows
  }

  function updateEditorIndexes() {
    const editors = [...editorList.querySelectorAll<HTMLElement>('.widget-editor')]
    const rows = getWidgetRowGroups(editors)

    rows.forEach((row, rowIndex) => {
      row.forEach((editor, colIndex) => {
        const left = editor.querySelector<HTMLButtonElement>('[data-action="move-left"]')
        const right = editor.querySelector<HTMLButtonElement>('[data-action="move-right"]')
        const up = editor.querySelector<HTMLButtonElement>('[data-action="move-up"]')
        const down = editor.querySelector<HTMLButtonElement>('[data-action="move-down"]')

        if (left) left.disabled = colIndex === 0
        if (right) right.disabled = colIndex === row.length - 1
        if (up) up.disabled = rowIndex === 0 && editor.dataset.breakBefore !== 'true'
        if (down) down.disabled = rowIndex === rows.length - 1 && row.length === 1
      })
    })

    editors.forEach((editor, index) => {
      editor.querySelector<HTMLElement>('.widget-number')!.textContent = `#${index + 1}`
    })
    widgetCount.textContent = `${editors.length} ${editors.length === 1 ? 'Widget' : 'Widgets'}`
    emptyState.hidden = editors.length > 0
    validateLayout()
  }

  function validateLayout() {
    const widgets = readWidgets()
    const valid = layoutFits(widgets)
    layoutWarning.textContent = valid ? '' : 'Eine Widgetgröße überschreitet die technische Sicherheitsgrenze.'
    saveButton.disabled = !valid
    return valid
  }

  function refreshEditor(editor: HTMLElement, refreshPreview = true) {
    const widget = readWidget(editor)
    const constraints = widgetConstraints[widget.type]
    const columns = editor.querySelector<HTMLInputElement>('[data-field="columns"]')!
    const rows = editor.querySelector<HTMLInputElement>('[data-field="rows"]')!
    columns.min = String(constraints.minColumns)
    rows.min = String(constraints.minRows)
    columns.value = String(widget.columns)
    rows.value = String(widget.rows)
    syncCompactField(columns)
    syncCompactField(rows)
    editor.dataset.columns = String(widget.columns)
    editor.dataset.rows = String(widget.rows)
    if (widget.breakBefore) {
      editor.dataset.breakBefore = 'true'
      editor.style.gridColumn = `1 / span ${Math.min(GRID_COLUMNS, widget.columns)}`
    } else {
      delete editor.dataset.breakBefore
      editor.style.gridColumn = `span ${Math.min(GRID_COLUMNS, widget.columns)}`
    }
    const breakInput = editor.querySelector<HTMLInputElement>('[data-field="breakBefore"]')
    if (breakInput) breakInput.checked = Boolean(widget.breakBefore)
    const showTitleInput = editor.querySelector<HTMLInputElement>('[data-field="showTitle"]')
    if (showTitleInput) showTitleInput.checked = Boolean(widget.showTitle)
    editor.style.setProperty('--widget-columns', String(widget.columns))
    editor.style.setProperty('--widget-rows', String(widget.rows))
    editor.style.gridRow = `span ${widget.rows}`
    editor.classList.toggle('is-full-width', widget.columns >= 24)
    editor.style.setProperty('--widget-preview-aspect', String(widgetPreviewAspectRatio(widget.type, widget.columns, widget.rows, window.innerWidth, window.innerHeight, widget.url)))
    editor.querySelector<HTMLElement>('[data-editor-title]')!.textContent = widget.title
    const dialogTitle = editor.querySelector<HTMLElement>('[data-dialog-title]')
    if (dialogTitle) dialogTitle.textContent = widget.title
    const previewTitle = editor.querySelector<HTMLElement>('.preview-header .kiosk-widget-title')
    if (previewTitle) previewTitle.textContent = widget.title
    editor.querySelector<HTMLElement>('[data-type-badge]')!.textContent = widgetTypeLabel(widget.type)
    editor.querySelector<HTMLElement>('[data-dimension-label]')!.textContent = `${widget.columns} × ${widget.rows}`
    const content = editor.querySelector<HTMLTextAreaElement | HTMLInputElement>('[data-field="url"]')
    if (content) {
      if (widget.type === 'text') {
        content.placeholder = 'Text eingeben'
      } else if (widget.type === 'slideshow') {
        content.placeholder = 'https://example.com/bild1.jpg\nhttps://example.com/bild2.jpg'
      } else if (widget.type === 'waste') {
        content.placeholder = 'https://.../abfall.ics oder webcal://...'
      } else if (widget.type === 'calendar') {
        content.placeholder = 'https://... oder webcal://...'
      } else {
        content.placeholder = 'https://example.com'
      }
      syncCompactField(content)
    }
    const contentLabel = editor.querySelector<HTMLElement>('[data-content-label]')
    if (contentLabel) {
      contentLabel.textContent = widget.type === 'slideshow' ? 'Bild-URLs (eine pro Zeile)' : 'Inhalt / URL'
    }
    if (refreshPreview) {
      const preview = editor.querySelector<HTMLElement>('[data-widget-preview]')!
      const previewContent = editor.querySelector<HTMLElement>('[data-widget-preview-content]')!
      preview.setAttribute('aria-label', `Vorschau ${widget.title}`)
      preview.classList.toggle('has-title', Boolean(widget.showTitle))
      previewContent.innerHTML = `${widget.showTitle ? `<header class="kiosk-widget-header preview-header"><h2 class="kiosk-widget-title">${escapeHtml(widget.title)}</h2></header>` : ''}<div class="iframe-placeholder">${renderWidgetContent(widget)}</div>`
      bindWidgetFrames(previewContent)
    }
    validateLayout()
  }

  function addWidget(type: WidgetType) {
    const index = editorList.children.length + 1
    const widget = createWidget(type, index, `widget-${Date.now()}-${index}`)
    editorList.insertAdjacentHTML('beforeend', renderWidgetEditor(widget, index - 1))
    const editor = editorList.lastElementChild as HTMLElement
    bindEditor(editor)
    bindWidgetFrames(editor)
    updateEditorIndexes()
    markDirty()
    editor.scrollIntoView({ behavior: 'smooth', block: 'center' })
    const dialog = editor.querySelector<HTMLDialogElement>('[data-widget-dialog]')
    if (dialog && typeof dialog.showModal === 'function') {
      dialog.showModal()
      editor.querySelector<HTMLButtonElement>('[data-action="toggle"]')?.classList.add('is-active')
      editor.querySelector<HTMLInputElement>('[data-field="title"]')?.focus()
    }
  }

  function duplicateWidget(editor: HTMLElement) {
    const source = readWidget(editor)
    const duplicate = { ...source, id: `widget-${Date.now()}-copy`, title: `${source.title} Kopie`.slice(0, 30) }
    editor.insertAdjacentHTML('afterend', renderWidgetEditor(duplicate, 0))
    const copy = editor.nextElementSibling as HTMLElement
    bindEditor(copy)
    bindWidgetFrames(copy)
    updateEditorIndexes()
    markDirty()
    copy.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  function moveEditor2D(editor: HTMLElement, action: 'left' | 'right' | 'up' | 'down') {
    const editors = [...editorList.querySelectorAll<HTMLElement>('.widget-editor')]
    const rows = getWidgetRowGroups(editors)
    let rowIndex = -1
    let colIndex = -1

    for (let r = 0; r < rows.length; r++) {
      const c = rows[r]!.indexOf(editor)
      if (c !== -1) {
        rowIndex = r
        colIndex = c
        break
      }
    }
    if (rowIndex === -1) return

    const currentRow = rows[rowIndex]!

    if (action === 'left') {
      if (colIndex > 0) {
        const leftNeighbor = currentRow[colIndex - 1]!
        editorList.insertBefore(editor, leftNeighbor)
        if (leftNeighbor.dataset.breakBefore === 'true') {
          delete leftNeighbor.dataset.breakBefore
          editor.dataset.breakBefore = 'true'
        }
      }
    } else if (action === 'right') {
      if (colIndex < currentRow.length - 1) {
        const rightNeighbor = currentRow[colIndex + 1]!
        editorList.insertBefore(editor, rightNeighbor.nextElementSibling)
        if (editor.dataset.breakBefore === 'true') {
          delete editor.dataset.breakBefore
          rightNeighbor.dataset.breakBefore = 'true'
        }
      }
    } else if (action === 'down') {
      if (currentRow.length > 1) {
        if (colIndex === 0) {
          const nextInRow = currentRow[1]!
          if (editor.dataset.breakBefore === 'true') {
            nextInRow.dataset.breakBefore = 'true'
            delete editor.dataset.breakBefore
          }
          const lastInRow = currentRow[currentRow.length - 1]!
          editorList.insertBefore(editor, lastInRow.nextElementSibling)
          editor.dataset.breakBefore = 'true'
        } else {
          editor.dataset.breakBefore = 'true'
        }
      } else if (rowIndex < rows.length - 1) {
        const nextRow = rows[rowIndex + 1]!
        const lastInNextRow = nextRow[nextRow.length - 1]!
        editorList.insertBefore(editor, lastInNextRow.nextElementSibling)
      }
    } else if (action === 'up') {
      if (editor.dataset.breakBefore === 'true') {
        delete editor.dataset.breakBefore
      } else if (rowIndex > 0) {
        const prevRow = rows[rowIndex - 1]!
        const firstInPrevRow = prevRow[0]!
        editorList.insertBefore(editor, firstInPrevRow)
      }
    }

    refreshEditor(editor, false)
    updateEditorIndexes()
    markDirty()
    editor.querySelector<HTMLButtonElement>(`[data-action="move-${action}"]`)?.focus()
  }

  function bindEditor(editor: HTMLElement) {
    if (editor.dataset.interactionsBound === 'true') return
    editor.dataset.interactionsBound = 'true'
    const initialWidget = readWidget(editor)
    if (initialWidget.breakBefore) {
      editor.dataset.breakBefore = 'true'
      editor.style.gridColumn = `1 / span ${Math.min(GRID_COLUMNS, initialWidget.columns)}`
    } else {
      editor.style.gridColumn = `span ${Math.min(GRID_COLUMNS, initialWidget.columns)}`
    }
    editor.style.gridRow = `span ${initialWidget.rows}`
    editor.classList.toggle('is-full-width', initialWidget.columns >= 24)
    editor.style.setProperty('--widget-preview-aspect', String(widgetPreviewAspectRatio(initialWidget.type, initialWidget.columns, initialWidget.rows, window.innerWidth, window.innerHeight, initialWidget.url)))
    bindCompactFields(editor)

    editor.querySelectorAll<HTMLElement>('input, button, select, textarea').forEach((control) => control.addEventListener('pointerdown', (event) => event.stopPropagation()))
    editor.querySelector<HTMLButtonElement>('[data-action="move-left"]')?.addEventListener('click', () => moveEditor2D(editor, 'left'))
    editor.querySelector<HTMLButtonElement>('[data-action="move-right"]')?.addEventListener('click', () => moveEditor2D(editor, 'right'))
    editor.querySelector<HTMLButtonElement>('[data-action="move-up"]')?.addEventListener('click', () => moveEditor2D(editor, 'up'))
    editor.querySelector<HTMLButtonElement>('[data-action="move-down"]')?.addEventListener('click', () => moveEditor2D(editor, 'down'))
    const removeHandler = async () => {
      const title = readWidget(editor).title
      const confirmed = await showConfirm({
        kicker: 'Widget entfernen',
        title: `„${title}“ löschen?`,
        message: `Möchtest du das Widget „${title}“ wirklich von deiner Anzeige entfernen?`,
        confirmText: 'Löschen',
        isDanger: true,
      })
      if (!confirmed) return
      closeDialog()
      editor.remove()
      updateEditorIndexes()
      markDirty()
    }
    editor.querySelectorAll<HTMLButtonElement>('[data-action="remove"], [data-action="remove-dialog"]').forEach((btn) => {
      btn.addEventListener('click', (event) => {
        event.stopPropagation()
        void removeHandler()
      })
    })

    const dialog = editor.querySelector<HTMLDialogElement>('[data-widget-dialog]')
    const toggleButton = editor.querySelector<HTMLButtonElement>('[data-action="toggle"]')
    editor.querySelector<HTMLButtonElement>('[data-action="duplicate"]')?.addEventListener('click', () => duplicateWidget(editor))

    const urlInput = editor.querySelector<HTMLTextAreaElement>('[data-field="url"]')!
    const crudSection = editor.querySelector<HTMLElement>('[data-slideshow-crud]')

    const refreshSlideshowCrud = () => {
      if (!crudSection) return
      const urls = parseSlideshowUrls(urlInput.value).slice(0, 10)
      const countBadge = crudSection.querySelector<HTMLElement>('[data-slideshow-count]')
      if (countBadge) countBadge.textContent = `Bilder (${urls.length} / 10)`
      const list = crudSection.querySelector<HTMLElement>('[data-slideshow-list]')
      if (list) {
        list.innerHTML = renderSlideshowCrudList(urls)
        list.querySelectorAll<HTMLButtonElement>('[data-action="slide-up"]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index)
            if (idx > 0) {
              const temp = urls[idx]!
              urls[idx] = urls[idx - 1]!
              urls[idx - 1] = temp
              urlInput.value = urls.join('\n')
              refreshEditor(editor)
              markDirty()
              refreshSlideshowCrud()
            }
          })
        })
        list.querySelectorAll<HTMLButtonElement>('[data-action="slide-down"]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index)
            if (idx < urls.length - 1) {
              const temp = urls[idx]!
              urls[idx] = urls[idx + 1]!
              urls[idx + 1] = temp
              urlInput.value = urls.join('\n')
              refreshEditor(editor)
              markDirty()
              refreshSlideshowCrud()
            }
          })
        })
        list.querySelectorAll<HTMLButtonElement>('[data-action="slide-delete"]').forEach((btn) => {
          btn.addEventListener('click', () => {
            const idx = Number(btn.dataset.index)
            urls.splice(idx, 1)
            urlInput.value = urls.join('\n')
            refreshEditor(editor)
            markDirty()
            refreshSlideshowCrud()
          })
        })
      }
    }

    if (crudSection) {
      const addUrlInput = crudSection.querySelector<HTMLInputElement>('[data-slideshow-url-input]')
      const addUrlBtn = crudSection.querySelector<HTMLButtonElement>('[data-action="add-slideshow-url"]')
      const handleAddUrl = () => {
        if (!addUrlInput) return
        const val = addUrlInput.value.trim()
        if (!val) return
        const urls = parseSlideshowUrls(urlInput.value)
        if (urls.length >= 10) {
          if (uploadStatus) uploadStatus.textContent = 'Maximal 10 Bilder pro Diashow erreicht.'
          return
        }
        urls.push(val)
        urlInput.value = urls.slice(0, 10).join('\n')
        addUrlInput.value = ''
        refreshEditor(editor)
        markDirty()
        refreshSlideshowCrud()
      }
      addUrlBtn?.addEventListener('click', handleAddUrl)
      addUrlInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          handleAddUrl()
        }
      })
      refreshSlideshowCrud()
    }

    editor.querySelector<HTMLButtonElement>('[data-action="clear-image"]')?.addEventListener('click', () => {
      urlInput.value = ''
      editor.querySelector<HTMLElement>('[data-single-image-item]')?.remove()
      refreshEditor(editor)
      markDirty()
    })

    urlInput.addEventListener('input', () => {
      refreshSlideshowCrud()
    })

    const fileInput = editor.querySelector<HTMLInputElement>('[data-action="upload"]')
    const uploadStatus = editor.querySelector<HTMLElement>('[data-upload-status]')
    fileInput?.addEventListener('change', async () => {
      const files = fileInput.files
      if (!files || files.length === 0) return

      let currentPin = sessionStorage.getItem(pinKey) || (await requestPin())
      if (!currentPin) {
        if (uploadStatus) uploadStatus.textContent = 'Upload abgebrochen (PIN erforderlich).'
        fileInput.value = ''
        return
      }

      const currentType = editor.querySelector<HTMLSelectElement>('[data-field="type"]')?.value
      const existingUrls = currentType === 'slideshow' ? parseSlideshowUrls(urlInput.value) : []

      if (currentType === 'slideshow' && existingUrls.length >= 10) {
        if (uploadStatus) uploadStatus.textContent = 'Maximal 10 Bilder pro Diashow erreicht.'
        fileInput.value = ''
        return
      }

      let addedCount = 0
      for (let i = 0; i < files.length; i++) {
        if (currentType === 'slideshow' && existingUrls.length >= 10) {
          if (uploadStatus) uploadStatus.textContent = `Maximal 10 Bilder erreicht (${addedCount} hinzugefügt).`
          break
        }

        const file = files[i]!
        if (file.size > 5 * 1024 * 1024) {
          if (uploadStatus) uploadStatus.textContent = `„${file.name}“ ist größer als 5 MB.`
          continue
        }
        if (uploadStatus) {
          uploadStatus.innerHTML = `<span class="loading-spinner" aria-hidden="true"></span> <span>Lade „${escapeHtml(file.name)}“ hoch …</span>`
        }

        const formData = new FormData()
        formData.append('file', file)

        try {
          let res = await fetch('/api/upload', {
            method: 'POST',
            headers: { 'x-admin-pin': currentPin },
            body: formData,
          })
          if (res.status === 401) {
            sessionStorage.removeItem(pinKey)
            const retryPin = await requestPin()
            if (!retryPin) {
              if (uploadStatus) uploadStatus.textContent = 'PIN erforderlich.'
              break
            }
            currentPin = retryPin
            res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'x-admin-pin': currentPin },
              body: formData,
            })
          }

          const data = await res.json() as { url?: string; error?: string }
          if (!res.ok || !data.url) {
            throw new Error(data.error || 'Upload fehlgeschlagen.')
          }

          if (currentType === 'slideshow') {
            existingUrls.push(data.url)
            urlInput.value = existingUrls.slice(0, 10).join('\n')
            addedCount++
          } else {
            urlInput.value = data.url
          }
          refreshEditor(editor)
          markDirty()
          if (uploadStatus) {
            uploadStatus.innerHTML = `<span>✓</span> <span>${currentType === 'slideshow'
              ? `„${escapeHtml(file.name)}“ hinzugefügt (${existingUrls.length}/10)`
              : `„${escapeHtml(file.name)}“ hochgeladen!`}</span>`
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Fehler beim Upload.'
          if (uploadStatus) uploadStatus.textContent = msg
        }
      }
      fileInput.value = ''
      refreshSlideshowCrud()
    })

    const icsFileInput = editor.querySelector<HTMLInputElement>('[data-action="upload-ics"]')
    const icsUploadStatus = editor.querySelector<HTMLElement>('[data-upload-status]')
    icsFileInput?.addEventListener('change', () => {
      const file = icsFileInput.files?.[0]
      if (!file) return

      if (icsUploadStatus) {
        icsUploadStatus.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Lese Kalenderdatei …</span>'
      }

      const reader = new FileReader()
      reader.onload = () => {
        try {
          const content = String(reader.result || '')
          const events = parseCalendarFeed(content)
          const now = new Date()
          const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
          const upcoming = events
            .filter((event) => {
              const time = new Date(event.end || event.start).getTime()
              return time >= startOfToday
            })
            .slice(0, 30)

          if (!upcoming.length) {
            if (icsUploadStatus) icsUploadStatus.textContent = 'Keine anstehenden Termine in .ics gefunden.'
            return
          }

          const wasteTextarea = editor.querySelector<HTMLTextAreaElement>('[data-field="wasteItems"]')
          if (wasteTextarea) {
            wasteTextarea.value = upcoming.map((e) => `${e.summary.replace(/[:|]/g, ' - ')}: ${e.start.slice(0, 10)}`).join('\n')
          }
          if (icsUploadStatus) {
            icsUploadStatus.innerHTML = `<span>✓</span> <span>${upcoming.length} Termine importiert (${escapeHtml(file.name)})</span>`
          }
          refreshEditor(editor)
          markDirty()
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : 'Fehler beim Lesen der .ics-Datei.'
          if (icsUploadStatus) icsUploadStatus.textContent = msg
        }
      }
      reader.onerror = () => {
        if (icsUploadStatus) icsUploadStatus.textContent = 'Fehler beim Laden der Datei.'
      }
      reader.readAsText(file)
      icsFileInput.value = ''
    })

    const radioPresetSelect = editor.querySelector<HTMLSelectElement>('[data-action="radio-preset"]')
    const radioUrlInput = editor.querySelector<HTMLInputElement>('[data-field="url"]')
    const radioTitleInput = editor.querySelector<HTMLInputElement>('[data-field="mediaTitle"]')
    const radioArtistInput = editor.querySelector<HTMLInputElement>('[data-field="mediaArtist"]')
    const mainTitleInput = editor.querySelector<HTMLInputElement>('[data-field="title"]')
    const testRadioBtn = editor.querySelector<HTMLButtonElement>('[data-action="test-radio-stream"]')
    const testRadioStatus = editor.querySelector<HTMLElement>('[data-radio-test-status]')

    radioPresetSelect?.addEventListener('change', () => {
      const selected = radioPresetSelect.selectedOptions[0]
      if (!selected) return
      const url = selected.dataset.url ?? ''
      const name = selected.dataset.name ?? ''
      const slogan = selected.dataset.slogan ?? ''
      if (selected.value !== 'custom') {
        if (radioUrlInput) radioUrlInput.value = url
        if (radioTitleInput) radioTitleInput.value = name
        if (radioArtistInput) radioArtistInput.value = slogan
        if (mainTitleInput && (!mainTitleInput.value || mainTitleInput.value === 'Radio' || mainTitleInput.value === '1LIVE' || mainTitleInput.value === 'Now Playing')) {
          mainTitleInput.value = name
        }
        refreshEditor(editor)
        markDirty()
      }
    })

    let testAudio: HTMLAudioElement | null = null
    const cleanupTestAudio = () => {
      if (testAudio) {
        testAudio.pause()
        testAudio.src = ''
        testAudio = null
        if (testRadioBtn) testRadioBtn.innerHTML = '<span class="preview-play-icon">▶</span> <span>Sender antesten</span>'
        if (testRadioStatus) testRadioStatus.textContent = ''
      }
    }

    testRadioBtn?.addEventListener('click', () => {
      const streamUrl = radioUrlInput?.value.trim()
      if (!streamUrl) {
        if (testRadioStatus) testRadioStatus.textContent = 'Keine Stream-URL angegeben'
        return
      }
      if (testAudio && !testAudio.paused) {
        cleanupTestAudio()
      } else {
        if (testRadioStatus) testRadioStatus.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Verbinde mit Stream …</span>'
        if (testRadioBtn) testRadioBtn.innerHTML = '<span class="preview-play-icon">⏸</span> <span>Stoppen</span>'
        testAudio = new Audio(streamUrl)
        testAudio.volume = 0.8
        testAudio.play().then(() => {
          if (testRadioStatus) testRadioStatus.textContent = '🔊 Live-Audio aktiv'
        }).catch((err) => {
          console.error(err)
          if (testRadioStatus) testRadioStatus.textContent = 'Stream konnte nicht geladen werden'
          if (testRadioBtn) testRadioBtn.innerHTML = '<span class="preview-play-icon">▶</span> <span>Sender antesten</span>'
          testAudio = null
        })
      }
    })

    const openDialog = () => {
      if (!dialog) return
      if (typeof dialog.showModal === 'function') {
        dialog.showModal()
      } else {
        dialog.setAttribute('open', '')
      }
      toggleButton?.setAttribute('aria-expanded', 'true')
      toggleButton?.classList.add('is-active')
    }

    const closeDialog = () => {
      cleanupTestAudio()
      if (!dialog) return
      if (typeof dialog.close === 'function') {
        dialog.close()
      } else {
        dialog.removeAttribute('open')
      }
      toggleButton?.setAttribute('aria-expanded', 'false')
      toggleButton?.classList.remove('is-active')
      refreshEditor(editor)
    }

    toggleButton?.addEventListener('click', (event) => {
      event.stopPropagation()
      openDialog()
    })

    editor.querySelectorAll<HTMLButtonElement>('[data-action="close-dialog"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        closeDialog()
      })
    })

    editor.querySelectorAll<HTMLButtonElement>('[data-action="save-dialog"]').forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation()
        closeDialog()
        markDirty()
      })
    })

    dialog?.addEventListener('cancel', () => {
      toggleButton?.setAttribute('aria-expanded', 'false')
      toggleButton?.classList.remove('is-active')
      refreshEditor(editor)
    })

    dialog?.addEventListener('click', (event) => {
      if (event.target === dialog) {
        closeDialog()
      }
    })

    editor.querySelector<HTMLInputElement>('[data-field="title"]')!.addEventListener('input', () => {
      refreshEditor(editor, false)
      markDirty()
    })
    editor.querySelectorAll<HTMLInputElement>('input[data-field="columns"], input[data-field="rows"]').forEach((control) => {
      control.addEventListener('input', () => {
        refreshEditor(editor, false)
        markDirty()
      })
    })
    const breakInput = editor.querySelector<HTMLInputElement>('[data-field="breakBefore"]')
    breakInput?.addEventListener('change', () => {
      if (breakInput.checked) editor.dataset.breakBefore = 'true'
      else delete editor.dataset.breakBefore
      refreshEditor(editor, false)
      updateEditorIndexes()
      markDirty()
    })
    editor.querySelector<HTMLSelectElement>('[data-field="type"]')!.addEventListener('change', () => {
      const widget = readWidget(editor)
      const index = [...editorList.children].indexOf(editor)
      editor.outerHTML = renderWidgetEditor(widget, index)
      const newEditor = editorList.children[index] as HTMLElement
      bindEditor(newEditor)
      bindWidgetFrames(newEditor)
      markDirty()
      const newDialog = newEditor.querySelector<HTMLDialogElement>('[data-widget-dialog]')
      if (newDialog && typeof newDialog.showModal === 'function') {
        newDialog.showModal()
        newEditor.querySelector<HTMLButtonElement>('[data-action="toggle"]')?.classList.add('is-active')
      }
    })
    editor.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]').forEach((control) => {
      control.addEventListener('change', () => {
        refreshEditor(editor)
        markDirty()
      })
    })
    const resizeHandle = editor.querySelector<HTMLButtonElement>('[data-resize-handle]')!
    const applyResize = (deltaColumns: number, deltaRows: number, startColumns = readWidget(editor).columns, startRows = readWidget(editor).rows, markAsDirty = true) => {
      const type = editor.querySelector<HTMLSelectElement>('[data-field="type"]')!.value as WidgetType
      const current = readWidget(editor)
      const resized = resizeWidgetDimensions(type, startColumns, startRows, deltaColumns, deltaRows, current.columns, current.rows)
      if (!resized.changed) return false
      editor.querySelector<HTMLInputElement>('[data-field="columns"]')!.value = String(resized.columns)
      editor.querySelector<HTMLInputElement>('[data-field="rows"]')!.value = String(resized.rows)
      editor.style.gridColumn = `span ${Math.min(GRID_COLUMNS, resized.columns)}`
      editor.style.gridRow = `span ${resized.rows}`
      refreshEditor(editor, false)
      if (markAsDirty) markDirty()
      return true
    }
    resizeHandle.addEventListener('keydown', (event) => {
      const direction = resizeKeyboardDelta(event.key, event.shiftKey)
      if (!direction) return
      event.preventDefault()
      applyResize(direction[0], direction[1])
    })
    let activeResizePointer: number | null = null
    resizeHandle.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || activeResizePointer !== null) return
      event.preventDefault()
      event.stopPropagation()
      activeResizePointer = event.pointerId
      const start = readWidget(editor)
      const startX = event.clientX
      const startY = event.clientY
      const containerRect = editorList.getBoundingClientRect()
      const gap = 10
      const columnWidth = Math.max(16, (containerRect.width + gap) / GRID_COLUMNS)
      const rowHeight = Math.max(24, (window.innerHeight - 100 - (GRID_ROWS - 1) * gap) / GRID_ROWS)
      let intentionallyReleasing = false
      editor.classList.add('is-resizing')
      document.body.style.cursor = 'nwse-resize'
      resizeHandle.setPointerCapture(event.pointerId)

      const move = (moveEvent: PointerEvent) => {
        if (moveEvent.pointerId !== activeResizePointer) return
        const [deltaColumns, deltaRows] = resizePointerDelta(moveEvent.clientX - startX, moveEvent.clientY - startY, columnWidth, rowHeight)
        applyResize(
          deltaColumns,
          deltaRows,
          start.columns,
          start.rows,
          false,
        )
      }
      const cleanup = () => {
        if (activeResizePointer !== event.pointerId) return
        resizeHandle.removeEventListener('pointermove', move)
        resizeHandle.removeEventListener('pointerup', finish)
        resizeHandle.removeEventListener('pointercancel', cancelPointer)
        resizeHandle.removeEventListener('lostpointercapture', lostCapture)
        window.removeEventListener('keydown', cancelWithEscape)
        editor.classList.remove('is-resizing')
        document.body.style.cursor = ''
        activeResizePointer = null
      }
      const finish = (finishEvent: PointerEvent) => {
        if (finishEvent.pointerId !== activeResizePointer) return
        const current = readWidget(editor)
        if (resizeChangedFromStart(start.columns, start.rows, current.columns, current.rows)) markDirty()
        intentionallyReleasing = true
        if (resizeHandle.hasPointerCapture(finishEvent.pointerId)) resizeHandle.releasePointerCapture(finishEvent.pointerId)
        cleanup()
      }
      const cancelResize = () => {
        applyResize(0, 0, start.columns, start.rows, false)
        intentionallyReleasing = true
        if (resizeHandle.hasPointerCapture(event.pointerId)) resizeHandle.releasePointerCapture(event.pointerId)
        cleanup()
        resizeHandle.focus()
      }
      const cancelPointer = (cancelEvent: PointerEvent) => {
        if (cancelEvent.pointerId === activeResizePointer) cancelResize()
      }
      const cancelWithEscape = (keyEvent: KeyboardEvent) => {
        if (keyEvent.key !== 'Escape' || activeResizePointer !== event.pointerId) return
        keyEvent.preventDefault()
        cancelResize()
      }
      const lostCapture = (lostEvent: PointerEvent) => {
        if (lostEvent.pointerId !== activeResizePointer) return
        if (lostPointerCaptureAction(intentionallyReleasing) === 'cancel') cancelResize()
        else cleanup()
      }
      resizeHandle.addEventListener('pointermove', move)
      resizeHandle.addEventListener('pointerup', finish)
      resizeHandle.addEventListener('pointercancel', cancelPointer)
      resizeHandle.addEventListener('lostpointercapture', lostCapture)
      window.addEventListener('keydown', cancelWithEscape)
    })
    const dragHandle = editor.querySelector<HTMLElement>('.drag-handle')!
    dragHandle.addEventListener('dragstart', (event) => {
      editor.classList.add('is-dragging')
      event.dataTransfer?.setData('text/plain', editor.dataset.widgetId || '')
      if (event.dataTransfer) {
        event.dataTransfer.effectAllowed = 'move'
      }
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
      if (source && source !== editor) {
        editorList.insertBefore(source, editor)
        updateEditorIndexes()
        markDirty()
      }
    })
  }

  function requestPin() {
    if (pinRequest) return pinRequest
    pinRequest = new Promise<string | null>((resolve) => {
      let active = true
      pinError.textContent = ''
      pinInput.value = ''
      syncCompactField(pinInput)
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
        pinForm.removeEventListener('submit', submit)
      }

      pinDialog.addEventListener('cancel', close, { once: true })
      pinClose.addEventListener('click', close, { once: true })
      pinCancel.addEventListener('click', close, { once: true })
      pinForm.addEventListener('submit', submit)
    })
    return pinRequest
  }

  async function saveWithPin(nextSettings: typeof defaultSettings) {
    let pin = sessionStorage.getItem(pinKey) || ''
    if (loaded.source === 'server' && !pin) {
      const requestedPin = await requestPin()
      if (!requestedPin) return null
      pin = requestedPin
    }
    try {
      return await store.save(nextSettings, pin)
    } catch (error) {
      if (!(error instanceof UnauthorizedError)) throw error
      sessionStorage.removeItem(pinKey)
      const requestedPin = await requestPin()
      if (!requestedPin) return null
      return store.save(nextSettings, requestedPin)
    }
  }

  bindCompactFields(app)
  editorList.querySelectorAll<HTMLElement>('.widget-editor').forEach(bindEditor)
  window.addEventListener('resize', () => {
    editorList.querySelectorAll<HTMLElement>('.widget-editor').forEach((editor) => {
      const widget = readWidget(editor)
      editor.style.setProperty('--widget-preview-aspect', String(widgetPreviewAspectRatio(widget.type, widget.columns, widget.rows, window.innerWidth, window.innerHeight, widget.url)))
    })
  })
  bindWidgetFrames(editorList)
  updateEditorIndexes()

  app.querySelectorAll<HTMLButtonElement>('[data-add-type]').forEach((button) => button.addEventListener('click', () => addWidget(button.dataset.addType as WidgetType)))
  app.querySelectorAll<HTMLInputElement>('.admin-global-fields input').forEach((input) => input.addEventListener('input', markDirty))

  const closeChangePinDialog = () => {
    if (changePinDialog.open) changePinDialog.close()
  }
  changePinButton.addEventListener('click', () => {
    changePinForm.reset()
    bindCompactFields(changePinForm)
    changePinError.textContent = ''
    changePinSubmit.disabled = false
    changePinSubmit.textContent = 'PIN speichern'
    changePinDialog.showModal()
    currentPinInput.focus()
  })
  changePinClose.addEventListener('click', closeChangePinDialog)
  changePinCancel.addEventListener('click', closeChangePinDialog)
  changePinForm.addEventListener('submit', async (event) => {
    event.preventDefault()
    const currentPin = currentPinInput.value.trim()
    const newPin = newPinInput.value.trim()
    const validationError = validatePinChange(newPin, confirmPinInput.value.trim())
    if (validationError) {
      changePinError.textContent = validationError
      newPinInput.focus()
      return
    }

    changePinError.textContent = ''
    changePinSubmit.disabled = true
    changePinSubmit.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Speichert …</span>'
    try {
      await store.changePin(currentPin, newPin)
      sessionStorage.setItem(pinKey, newPin)
      closeChangePinDialog()
      showMessage('Die Admin-PIN wurde geändert.')
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        changePinError.textContent = 'Die aktuelle PIN ist nicht korrekt.'
        currentPinInput.select()
      } else if (error instanceof SettingsServerError && error.status === 422) {
        changePinError.textContent = 'Die neue PIN muss aus 4 bis 64 Ziffern bestehen.'
      } else {
        changePinError.textContent = adminErrorMessage(error, 'Die PIN konnte nicht geändert werden. Prüfe die Serververbindung.')
      }
    } finally {
      changePinSubmit.disabled = false
      changePinSubmit.textContent = 'PIN speichern'
    }
  })

  const updateResolutionDisplay = () => {
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

  const openSystemSettings = () => {
    updateResolutionDisplay()
    refreshTelemetry()
    systemSettingsDialog.showModal()
  }
  const closeSystemSettings = () => {
    if (systemSettingsDialog.open) systemSettingsDialog.close()
  }
  displaySettingsButton.addEventListener('click', openSystemSettings)
  systemStatusPill.addEventListener('click', openSystemSettings)
  systemSettingsClose.addEventListener('click', closeSystemSettings)
  systemSettingsCancel.addEventListener('click', closeSystemSettings)
  systemSettingsApply.addEventListener('click', () => {
    markDirty()
    closeSystemSettings()
    showMessage('Display-Einstellungen übernommen. Klicke auf "Speichern", um sie dauerhaft zu sichern.')
  })
  telemetryRefreshBtn.addEventListener('click', async () => {
    telemetryRefreshBtn.disabled = true
    telemetryRefreshBtn.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Lade …</span>'
    try {
      await refreshTelemetry()
    } finally {
      telemetryRefreshBtn.disabled = false
      telemetryRefreshBtn.textContent = 'Aktualisieren'
    }
  })
  refreshTelemetry()
  window.setInterval(refreshTelemetry, 30000)

  app.querySelector<HTMLFormElement>('#admin-form')!.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!validateLayout()) {
      layoutWarning.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const nextSettings = normalizeSettings({
      version: SETTINGS_VERSION,
      location: app.querySelector<HTMLInputElement>('#admin-location')!.value.trim() || defaultSettings.location,
      weatherCity: app.querySelector<HTMLInputElement>('#admin-weather-city')!.value.trim(),
      timezone: timezoneSelect.value,
      locale: localeSelect.value,
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
      widgets: readWidgets(),
    })
    saveButton.disabled = true
    saveButton.innerHTML = '<span class="loading-spinner" aria-hidden="true"></span> <span>Speichert …</span>'
    try {
      const saved = await saveWithPin(nextSettings)
      if (!saved) return
      markSaved()
      updateConnectionStatus(saved.source)
      showMessage(saved.source === 'server' ? 'Gespeichert. Alle Anzeigen übernehmen die neue Konfiguration.' : 'Server nicht erreichbar. Änderungen wurden nur in diesem Browser gespeichert.')
    } catch (error) {
      showMessage(adminErrorMessage(error, 'Die Einstellungen konnten nicht gespeichert werden.'), true)
    } finally {
      saveButton.disabled = !layoutFits(readWidgets())
      saveButton.textContent = 'Änderungen speichern'
    }
  })

  app.querySelector<HTMLButtonElement>('#reset-button')!.addEventListener('click', async () => {
    const confirmed = await showConfirm({
      kicker: 'Werkseinstellungen',
      title: 'Board zurücksetzen?',
      message: 'Achtung: Möchtest du wirklich alle Widgets löschen und das Board auf die Werkseinstellungen (Standard) zurücksetzen?',
      confirmText: 'Zurücksetzen',
      isDanger: true,
    })
    if (!confirmed) return
    try {
      const saved = await saveWithPin(defaultSettings)
      if (!saved) return
      displayScaleSelect.value = String(defaultSettings.displayScale || 100)
      hideCursorCheckbox.checked = defaultSettings.hideCursor !== false
      localeSelect.value = defaultSettings.locale || 'de-DE'
      timezoneSelect.value = defaultSettings.timezone || 'auto'
      showSecondsCheckbox.checked = Boolean(defaultSettings.showSeconds)
      nightModeEnabledCheckbox.checked = Boolean(defaultSettings.nightModeEnabled)
      nightModeStartInput.value = defaultSettings.nightModeStart || '22:00'
      nightModeEndInput.value = defaultSettings.nightModeEnd || '06:00'
      nightModeStyleSelect.value = defaultSettings.nightModeStyle || 'dim'
      pixelShiftCheckbox.checked = defaultSettings.pixelShiftEnabled !== false
      notificationSoundEnabledCheckbox.checked = defaultSettings.notificationSoundEnabled !== false
      notificationSoundVolumeInput.value = String(defaultSettings.notificationSoundVolume ?? 0.8)
      markSaved()
      window.location.reload()
    } catch (error) {
      showMessage(adminErrorMessage(error, 'Die Einstellungen konnten nicht zurückgesetzt werden.'), true)
    }
  })

  window.addEventListener('beforeunload', (event) => {
    if (!dirty) return
    event.preventDefault()
  })
}