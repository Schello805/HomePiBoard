import assert from 'node:assert/strict'
import test from 'node:test'
import {
  clearStoredAdminPin,
  DEFAULT_SESSION_DURATION_MS,
  getSessionRemainingMinutes,
  getStoredAdminPin,
  setStoredAdminPin,
} from '../src/auth-session.ts'

function createMockStorage() {
  const store = new Map<string, string>()
  return {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, val: string) => store.set(key, val),
    removeItem: (key: string) => store.delete(key),
  }
}

test('auth-session stores PIN with expiry and retrieves it while valid', () => {
  const storage = createMockStorage()
  const now = 1000000

  assert.equal(getStoredAdminPin(storage, false, now), null)

  setStoredAdminPin('1234', 60 * 60 * 1000, storage, now)
  assert.equal(getStoredAdminPin(storage, false, now), '1234')
  assert.equal(getStoredAdminPin(storage, false, now + 30 * 60 * 1000), '1234')

  // Remaining minutes
  assert.equal(getSessionRemainingMinutes(storage, now), 60)
  assert.equal(getSessionRemainingMinutes(storage, now + 15 * 60 * 1000), 45)
})

test('auth-session expires after configured duration and cleans up', () => {
  const storage = createMockStorage()
  const now = 1000000

  setStoredAdminPin('5678', 60 * 60 * 1000, storage, now)

  // Expired by 1ms
  assert.equal(getStoredAdminPin(storage, false, now + 60 * 60 * 1000 + 1), null)
  assert.equal(getSessionRemainingMinutes(storage, now + 60 * 60 * 1000 + 1), 0)
  // Cleaned up
  assert.equal(storage.getItem('homepiboard-admin-session'), null)
})

test('auth-session touch refreshes session duration', () => {
  const storage = createMockStorage()
  const now = 1000000

  setStoredAdminPin('9999', 60 * 60 * 1000, storage, now)

  // After 40 minutes, touch=true refreshes another 60 minutes
  const touchedPin = getStoredAdminPin(storage, true, now + 40 * 60 * 1000)
  assert.equal(touchedPin, '9999')

  // After 70 minutes from start (which is 30 min from touch), still valid!
  assert.equal(getStoredAdminPin(storage, false, now + 70 * 60 * 1000), '9999')
})

test('clearStoredAdminPin wipes session', () => {
  const storage = createMockStorage()
  setStoredAdminPin('1111', 60 * 60 * 1000, storage, 1000)
  assert.equal(getStoredAdminPin(storage, false, 1000), '1111')

  clearStoredAdminPin(storage)
  assert.equal(getStoredAdminPin(storage, false, 1000), null)
})
