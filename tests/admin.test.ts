import assert from 'node:assert/strict'
import test from 'node:test'

import { adminErrorMessage, clearPinError, validatePinChange } from '../src/admin.ts'
import { RateLimitError } from '../src/settings-store.ts'

test('validatePinChange accepts matching numeric PINs with at least six digits', () => {
  assert.equal(validatePinChange('135790', '135790'), '')
})

test('validatePinChange rejects invalid and mismatching PINs', () => {
  assert.match(validatePinChange('1234', '1234'), /6 bis 64 Ziffern/)
  assert.match(validatePinChange('12ab56', '12ab56'), /6 bis 64 Ziffern/)
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
