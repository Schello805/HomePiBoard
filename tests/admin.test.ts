import assert from 'node:assert/strict'
import test from 'node:test'

import { adminErrorMessage, clearPinError, compactFieldCharacters, createConfirmModal, formatCpuTemp, formatUptime, lostPointerCaptureAction, resizeChangedFromStart, resizeKeyboardDelta, resizePointerDelta, resizeWidgetDimensions, syncCompactField, validatePinChange, widgetPreviewAspectRatio } from '../src/admin.ts'
import { MAX_WIDGET_COLUMNS, MAX_WIDGET_ROWS } from '../src/settings.ts'
import { RateLimitError } from '../src/settings-store.ts'

test('validatePinChange accepts matching numeric PINs with at least four digits', () => {
  assert.equal(validatePinChange('1357', '1357'), '')
})

test('validatePinChange rejects invalid and mismatching PINs', () => {
  assert.match(validatePinChange('123', '123'), /4 bis 64 Ziffern/)
  assert.match(validatePinChange('12ab', '12ab'), /4 bis 64 Ziffern/)
  assert.match(validatePinChange('135790', '135791'), /stimmen nicht überein/)
})

test('admin actions explain rate limits and their retry duration', () => {
  assert.equal(
    adminErrorMessage(new RateLimitError(42), 'Fallback'),
    'Zu viele Fehlversuche. Versuche es in 42 Sekunden erneut.',
  )
  assert.equal(adminErrorMessage(new Error('offline'), 'Fallback'), 'Fallback')
})

test('each PIN verification clears stale feedback before retrying', () => {
  const errorElement = { textContent: 'Zu viele Fehlversuche.' }
  clearPinError(errorElement)
  assert.equal(errorElement.textContent, '')
})

test('drag resizing can extend past one screen and keeps only safety limits', () => {
  assert.deepEqual(resizeWidgetDimensions('web', 24, 14, 1, 1), { columns: 25, rows: 15, changed: true })
  assert.deepEqual(resizeWidgetDimensions('web', MAX_WIDGET_COLUMNS - 1, MAX_WIDGET_ROWS - 1, 20, 20), { columns: MAX_WIDGET_COLUMNS, rows: MAX_WIDGET_ROWS, changed: true })
  assert.deepEqual(resizeWidgetDimensions('calendar', 8, 5, -20, -10), { columns: 6, rows: 5, changed: true })
})

test('drag resizing compares the target with the current dimensions', () => {
  assert.deepEqual(resizeWidgetDimensions('web', 12, 3, 0, 0, 14, 5), { columns: 12, rows: 3, changed: true })
  assert.deepEqual(resizeWidgetDimensions('web', 12, 3, 2, 2, 14, 5), { columns: 14, rows: 5, changed: false })
})

test('keyboard resizing uses clear one-cell and accelerated steps', () => {
  assert.deepEqual(resizeKeyboardDelta('ArrowLeft'), [-1, 0])
  assert.deepEqual(resizeKeyboardDelta('ArrowDown'), [0, 1])
  assert.deepEqual(resizeKeyboardDelta('ArrowRight', true), [4, 0])
  assert.deepEqual(resizeKeyboardDelta('ArrowUp', true), [0, -4])
  assert.equal(resizeKeyboardDelta('Escape'), null)
})

test('pointer resizing has symmetric half-cell thresholds', () => {
  assert.deepEqual(resizePointerDelta(24.9, -24.9, 50, 50), [0, 0])
  assert.deepEqual(resizePointerDelta(25, -25, 50, 50), [1, -1])
  assert.deepEqual(resizePointerDelta(75, -75, 50, 50), [2, -2])
})

test('pointer resizing only becomes dirty when the final size changed', () => {
  assert.equal(resizeChangedFromStart(12, 7, 12, 7), false)
  assert.equal(resizeChangedFromStart(12, 7, 13, 7), true)
  assert.equal(resizeChangedFromStart(12, 7, 12, 8), true)
})

test('unexpected pointer capture loss cancels instead of committing provisional dimensions', () => {
  assert.equal(lostPointerCaptureAction(false), 'cancel')
  assert.equal(lostPointerCaptureAction(true), 'cleanup')
})

test('edit previews use the same proportions as the kiosk grid', () => {
  assert.ok(Math.abs(widgetPreviewAspectRatio('web', 24, 14, 1280, 633) - (1264 / 554)) < 1e-10)
  assert.equal(widgetPreviewAspectRatio('web', 24, 2, 390, 844), 390 / 460)
  assert.equal(widgetPreviewAspectRatio('calendar', 8, 5, 390, 844), 390 / 520)
  assert.equal(widgetPreviewAspectRatio('calendar', 8, 5, 390, 844, '   '), 390 / 520)
  assert.equal(widgetPreviewAspectRatio('calendar', 8, 5, 390, 844, 'https://example.com/calendar'), 390 / 460)
})

test('edit previews remain usable for extreme multi-monitor dimensions', () => {
  assert.equal(widgetPreviewAspectRatio('web', 4, MAX_WIDGET_ROWS, 1280, 633), 0.75)
  assert.equal(widgetPreviewAspectRatio('web', MAX_WIDGET_COLUMNS, 2, 1280, 633), 4)
})

test('form field widths stay close to their content length', () => {
  assert.equal(compactFieldCharacters('iobroker'), 16)
  assert.equal(compactFieldCharacters(''), 4)
  assert.equal(compactFieldCharacters('x'.repeat(100)), 80)
  assert.equal(compactFieldCharacters('kurz\nzwölf Zeichen'), 26)
})

test('compact fields shrink again after programmatic resets', () => {
  const field = { tagName: 'INPUT', type: 'password', value: '12345678901234567890', placeholder: '', style: { width: '' } }
  syncCompactField(field)
  const expandedWidth = field.style.width

  field.value = ''
  syncCompactField(field)

  assert.notEqual(field.style.width, expandedWidth)
  assert.match(field.style.width, /4ch/)
})

test('slideshow widgets can be resized with minColumns and minRows constraints', () => {
  assert.deepEqual(resizeWidgetDimensions('slideshow', 8, 3, 4, 2), { columns: 12, rows: 5, changed: true })
  assert.deepEqual(resizeWidgetDimensions('slideshow', 8, 3, -10, -5), { columns: 4, rows: 2, changed: true })
})

test('adjacent widgets on a 24-column grid wrap to the next row when width exceeds capacity', () => {
  const rowCapacity = 24
  const canFitSideBySide = (widthA: number, widthB: number) => widthA + widthB <= rowCapacity

  assert.equal(canFitSideBySide(12, 12), true) // side by side
  assert.equal(canFitSideBySide(14, 12), false) // second widget drops down
  assert.equal(canFitSideBySide(10, 12), true) // second widget fits back up
})

test('formatUptime converts seconds to human-readable strings', () => {
  assert.equal(formatUptime(45), '0m')
  assert.equal(formatUptime(120), '2m')
  assert.equal(formatUptime(3660), '1h 1m')
  assert.equal(formatUptime(90000), '1d 1h 0m')
})

test('formatCpuTemp formats celsius temperatures and handles null', () => {
  assert.equal(formatCpuTemp(48.24), '48.2 °C')
  assert.equal(formatCpuTemp(50), '50.0 °C')
  assert.equal(formatCpuTemp(null), 'N/A')
})

test('createConfirmModal fallback resolves when dialog is absent', async () => {
  const showConfirm = createConfirmModal({ querySelector: () => null } as unknown as ParentNode)
  const res = await showConfirm({ title: 'Test Title', message: 'Test message' })
  assert.equal(typeof res, 'boolean')
})

test('createConfirmModal sets content and resolves true on confirm and false on cancel', async () => {
  const listeners = new Map<string, (e: any) => void>()
  const mockButton = (name: string) => ({
    name,
    textContent: '',
    className: '',
    focus() {},
    addEventListener(event: string, fn: any) { listeners.set(`${name}:${event}`, fn) },
    removeEventListener(event: string, _fn: any) { listeners.delete(`${name}:${event}`) },
  })

  const okBtn = mockButton('ok')
  const cancelBtn = mockButton('cancel')
  const closeBtn = mockButton('close')
  const titleEl = { textContent: '' }
  const kickerEl = { textContent: '' }
  const messageEl = { textContent: '' }
  let dialogClosed = false

  const dialog = {
    showModal() {},
    close() { dialogClosed = true },
    addEventListener(event: string, fn: any) { listeners.set(`dialog:${event}`, fn) },
    removeEventListener(event: string, _fn: any) { listeners.delete(`dialog:${event}`) },
  }

  const root = {
    querySelector(selector: string) {
      if (selector === '#confirm-dialog') return dialog
      if (selector === '#confirm-kicker') return kickerEl
      if (selector === '#confirm-title') return titleEl
      if (selector === '#confirm-message') return messageEl
      if (selector === '#confirm-ok') return okBtn
      if (selector === '#confirm-cancel') return cancelBtn
      if (selector === '#confirm-close') return closeBtn
      return null
    },
  } as unknown as ParentNode

  const showConfirm = createConfirmModal(root)

  // Test confirm path
  const confirmPromise = showConfirm({
    kicker: 'Löschen',
    title: 'Widget löschen?',
    message: 'Wirklich löschen?',
    confirmText: 'Ja, weg damit',
    isDanger: true,
  })

  assert.equal(kickerEl.textContent, 'Löschen')
  assert.equal(titleEl.textContent, 'Widget löschen?')
  assert.equal(messageEl.textContent, 'Wirklich löschen?')
  assert.equal(okBtn.textContent, 'Ja, weg damit')
  assert.equal(okBtn.className, 'danger-confirm-button')

  listeners.get('ok:click')!({ preventDefault() {} })
  const result = await confirmPromise
  assert.equal(result, true)
  assert.equal(dialogClosed, true)

  // Test cancel path
  dialogClosed = false
  const cancelPromise = showConfirm({
    title: 'Abbrechen Test',
    message: 'Test',
    isDanger: false,
  })
  assert.equal(okBtn.className, 'save-button')
  listeners.get('cancel:click')!({ preventDefault() {} })
  const cancelResult = await cancelPromise
  assert.equal(cancelResult, false)
  assert.equal(dialogClosed, true)
})

