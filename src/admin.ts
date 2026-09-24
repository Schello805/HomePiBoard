import { escapeHtml } from './dashboard-utils.ts'
import { createWidget, defaultSettings, layoutFits, normalizeSettings, widgetConstraints, type DashboardWidget, type WidgetType } from './settings.ts'
import { createSettingsStore, RateLimitError, SettingsServerError, UnauthorizedError } from './settings-store.ts'
import { bindWidgetFrames, renderWidget, renderWidgetContent, widgetTypeLabel } from './widgets.ts'

const pinKey = 'homepiboard-admin-pin'

export function validatePinChange(newPin: string, confirmation: string) {
  if (!/^\d{6,64}$/.test(newPin)) return 'Die neue PIN muss aus 6 bis 64 Ziffern bestehen.'
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

function renderWidgetEditor(widget: DashboardWidget, index: number) {
  return renderWidget(widget, true, index)
}

export async function renderAdminPage(app: HTMLElement) {
  const store = createSettingsStore()
  const loaded = await store.load()
  const settings = loaded.settings

  app.innerHTML = `<main class="admin-shell">
    <header class="admin-header">
      <a class="brand-mark" href="/" aria-label="HomePiBoard Anzeige"><img class="brand-logo" src="/homepiboard-logo.svg" alt="" /></a>
      <div class="admin-header-actions"><span class="connection-status ${loaded.source === 'server' ? 'is-online' : ''}">${loaded.source === 'server' ? 'SERVER' : 'LOKAL'}</span><span class="save-state" id="save-state">GESPEICHERT</span><a class="back-link" href="/">Anzeige öffnen <span aria-hidden="true">↗</span></a></div>
    </header>
    <section class="admin-content" aria-labelledby="admin-title">
      <div class="admin-intro"><span class="widget-kicker">Konfiguration</span><h1 id="admin-title">HomePiBoard <em>EDIT MODE</em></h1><p>Widgets anlegen, bearbeiten, sortieren und sicher im 24 × 8 Raster platzieren.</p></div>
      <form class="admin-form" id="admin-form">
        <section class="settings-section" aria-labelledby="general-title"><div class="section-heading"><div><span class="widget-kicker">Anzeige</span><h2 id="general-title">Allgemeine Einstellungen</h2></div></div><div class="admin-global-fields"><label for="admin-location">Bezeichnung<span>Text im Header</span><input id="admin-location" maxlength="24" value="${escapeHtml(settings.location)}" /></label><label for="admin-weather-city">Wetterort<span>Optional, zum Beispiel Berlin</span><input id="admin-weather-city" maxlength="40" value="${escapeHtml(settings.weatherCity)}" placeholder="Berlin" /></label></div></section>
        <section class="settings-section" aria-labelledby="security-title"><div class="section-heading"><div><span class="widget-kicker">Sicherheit</span><h2 id="security-title">Admin-PIN</h2></div></div><div class="security-setting"><div><strong>PIN-Schutz</strong><p>Ändere die PIN für Einstellungen und Zurücksetzen direkt auf diesem Gerät.</p></div><button class="secondary-button" id="change-pin-button" type="button">PIN ändern</button></div></section>
        <section class="settings-section" aria-labelledby="widgets-title"><div class="section-heading"><div><span class="widget-kicker">Inhalte</span><h2 id="widgets-title">Widgets</h2></div><span class="widget-count" id="widget-count"></span></div><div class="widget-editors" id="widget-editors">${settings.widgets.map(renderWidgetEditor).join('')}</div><div class="empty-editor-state" id="empty-editor-state"><strong>Noch keine Widgets</strong><span>Wähle unten einen Typ aus, um zu beginnen.</span></div><div class="add-widget-menu" aria-label="Widget hinzufügen"><span>Widget hinzufügen</span><button type="button" data-add-type="web">↗ Webseite</button><button type="button" data-add-type="calendar">▦ Kalender</button><button type="button" data-add-type="text">T Text</button><button type="button" data-add-type="image">▧ Bild</button></div><p class="layout-warning" id="layout-warning" role="alert"></p></section>
        <div class="admin-actions"><button class="secondary-button" id="reset-button" type="button">Alles zurücksetzen</button><button class="save-button" id="save-button" type="submit">Änderungen speichern</button></div>
        <p class="save-message" id="save-message" role="status"></p>
      </form>
    </section>
  </main>
  <dialog class="pin-dialog" id="pin-dialog"><form method="dialog" id="pin-form"><div class="dialog-heading"><div><span class="widget-kicker">Admin-Bereich</span><h2>PIN eingeben</h2></div><button class="close-button" id="pin-close" type="button" aria-label="Schließen">×</button></div><label for="admin-pin">Admin-PIN<input id="admin-pin" type="password" inputmode="numeric" autocomplete="current-password" required /></label><p class="pin-error" id="pin-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="pin-cancel" type="button">Abbrechen</button><button class="save-button" id="pin-submit" value="default">Entsperren</button></div></form></dialog>
  <dialog class="pin-dialog" id="change-pin-dialog"><form id="change-pin-form"><div class="dialog-heading"><div><span class="widget-kicker">Sicherheit</span><h2>Admin-PIN ändern</h2></div><button class="close-button" id="change-pin-close" type="button" aria-label="Schließen">×</button></div><label for="current-admin-pin">Aktuelle PIN<input id="current-admin-pin" type="password" inputmode="numeric" autocomplete="current-password" required /></label><label for="new-admin-pin">Neue PIN<span>6 bis 64 Ziffern</span><input id="new-admin-pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,64}" minlength="6" maxlength="64" required /></label><label for="confirm-admin-pin">Neue PIN wiederholen<input id="confirm-admin-pin" type="password" inputmode="numeric" autocomplete="new-password" pattern="[0-9]{6,64}" minlength="6" maxlength="64" required /></label><p class="pin-error" id="change-pin-error" role="alert"></p><div class="dialog-actions"><button class="secondary-button" id="change-pin-cancel" type="button">Abbrechen</button><button class="save-button" id="change-pin-submit" type="submit">PIN speichern</button></div></form></dialog>`

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
  let dirty = false
  let pinRequest: Promise<string | null> | null = null

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
    return {
      id: editor.dataset.widgetId!,
      type,
      title: editor.querySelector<HTMLInputElement>('[data-field="title"]')!.value.trim() || widgetTypeLabel(type),
      url: editor.querySelector<HTMLTextAreaElement>('[data-field="url"]')!.value.trim(),
      columns: Math.max(constraints.minColumns, Math.min(24, Math.round(Number(editor.querySelector<HTMLInputElement>('[data-field="columns"]')!.value) || constraints.defaultColumns))),
      rows: Math.max(constraints.minRows, Math.min(8, Math.round(Number(editor.querySelector<HTMLInputElement>('[data-field="rows"]')!.value) || constraints.defaultRows))),
    }
  }

  function readWidgets() {
    return [...editorList.querySelectorAll<HTMLElement>('.widget-editor')].map(readWidget)
  }

  function updateEditorIndexes() {
    const editors = [...editorList.querySelectorAll<HTMLElement>('.widget-editor')]
    editors.forEach((editor, index) => {
      editor.querySelector<HTMLElement>('.widget-number')!.textContent = `Widget ${index + 1}`
      const up = editor.querySelector<HTMLButtonElement>('[data-action="move-up"]')!
      const down = editor.querySelector<HTMLButtonElement>('[data-action="move-down"]')!
      up.disabled = index === 0
      down.disabled = index === editors.length - 1
    })
    widgetCount.textContent = `${editors.length} ${editors.length === 1 ? 'Widget' : 'Widgets'}`
    emptyState.hidden = editors.length > 0
    validateLayout()
  }

  function validateLayout() {
    const widgets = readWidgets()
    const valid = layoutFits(widgets)
    layoutWarning.textContent = valid ? '' : 'Das aktuelle Layout passt nicht vollständig in das 24 × 8 Raster. Verkleinere Widgets oder entferne eines.'
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
    editor.dataset.columns = String(widget.columns)
    editor.dataset.rows = String(widget.rows)
    editor.querySelector<HTMLElement>('[data-editor-title]')!.textContent = widget.title
    editor.querySelector<HTMLElement>('[data-type-badge]')!.textContent = widgetTypeLabel(widget.type)
    editor.querySelector<HTMLElement>('[data-dimension-label]')!.textContent = `${widget.columns} × ${widget.rows}`
    const content = editor.querySelector<HTMLTextAreaElement>('[data-field="url"]')!
    content.placeholder = widget.type === 'text' ? 'Text eingeben' : 'https://example.com'
    if (refreshPreview) {
      const preview = editor.querySelector<HTMLElement>('[data-widget-preview]')!
      preview.setAttribute('aria-label', `Vorschau ${widget.title}`)
      preview.innerHTML = `<div class="iframe-placeholder">${renderWidgetContent(widget)}</div>`
      bindWidgetFrames(preview)
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
    editor.querySelector<HTMLInputElement>('[data-field="title"]')?.focus()
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

  function moveEditor(editor: HTMLElement, direction: -1 | 1) {
    const sibling = direction < 0 ? editor.previousElementSibling : editor.nextElementSibling
    if (!sibling) return
    if (direction < 0) editorList.insertBefore(editor, sibling)
    else editorList.insertBefore(sibling, editor)
    updateEditorIndexes()
    markDirty()
    editor.querySelector<HTMLButtonElement>(direction < 0 ? '[data-action="move-up"]' : '[data-action="move-down"]')?.focus()
  }

  function bindEditor(editor: HTMLElement) {
    if (editor.dataset.interactionsBound === 'true') return
    editor.dataset.interactionsBound = 'true'

    editor.querySelectorAll<HTMLElement>('input, button, select, textarea').forEach((control) => control.addEventListener('pointerdown', (event) => event.stopPropagation()))
    editor.querySelector<HTMLButtonElement>('[data-action="move-up"]')!.addEventListener('click', () => moveEditor(editor, -1))
    editor.querySelector<HTMLButtonElement>('[data-action="move-down"]')!.addEventListener('click', () => moveEditor(editor, 1))
    editor.querySelector<HTMLButtonElement>('[data-action="duplicate"]')!.addEventListener('click', () => duplicateWidget(editor))
    editor.querySelector<HTMLButtonElement>('[data-action="remove"]')!.addEventListener('click', () => {
      const title = readWidget(editor).title
      if (!window.confirm(`„${title}“ wirklich entfernen?`)) return
      editor.remove()
      updateEditorIndexes()
      markDirty()
    })
    editor.querySelector<HTMLButtonElement>('[data-action="toggle"]')!.addEventListener('click', (event) => {
      const button = event.currentTarget as HTMLButtonElement
      const collapsed = editor.classList.toggle('is-collapsed')
      button.setAttribute('aria-expanded', String(!collapsed))
      button.textContent = collapsed ? '⌄' : '⌃'
    })
    editor.querySelector<HTMLInputElement>('[data-field="title"]')!.addEventListener('input', () => {
      refreshEditor(editor, false)
      markDirty()
    })
    editor.querySelectorAll<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>('[data-field]').forEach((control) => {
      control.addEventListener('change', () => {
        refreshEditor(editor)
        markDirty()
      })
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
        pinSubmit.textContent = 'Prüfe …'
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

  editorList.querySelectorAll<HTMLElement>('.widget-editor').forEach(bindEditor)
  bindWidgetFrames(editorList)
  updateEditorIndexes()

  app.querySelectorAll<HTMLButtonElement>('[data-add-type]').forEach((button) => button.addEventListener('click', () => addWidget(button.dataset.addType as WidgetType)))
  app.querySelectorAll<HTMLInputElement>('.admin-global-fields input').forEach((input) => input.addEventListener('input', markDirty))

  const closeChangePinDialog = () => {
    if (changePinDialog.open) changePinDialog.close()
  }
  changePinButton.addEventListener('click', () => {
    changePinForm.reset()
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
    changePinSubmit.textContent = 'Speichert …'
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
        changePinError.textContent = 'Die neue PIN muss aus 6 bis 64 Ziffern bestehen.'
      } else {
        changePinError.textContent = adminErrorMessage(error, 'Die PIN konnte nicht geändert werden. Prüfe die Serververbindung.')
      }
    } finally {
      changePinSubmit.disabled = false
      changePinSubmit.textContent = 'PIN speichern'
    }
  })

  app.querySelector<HTMLFormElement>('#admin-form')!.addEventListener('submit', async (event) => {
    event.preventDefault()
    if (!validateLayout()) {
      layoutWarning.scrollIntoView({ behavior: 'smooth', block: 'center' })
      return
    }
    const nextSettings = normalizeSettings({
      version: 2,
      location: app.querySelector<HTMLInputElement>('#admin-location')!.value.trim() || defaultSettings.location,
      weatherCity: app.querySelector<HTMLInputElement>('#admin-weather-city')!.value.trim(),
      widgets: readWidgets(),
    })
    saveButton.disabled = true
    saveButton.textContent = 'Speichert …'
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
    if (!window.confirm('Alle Widgets und Einstellungen wirklich zurücksetzen?')) return
    try {
      const saved = await saveWithPin(defaultSettings)
      if (!saved) return
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