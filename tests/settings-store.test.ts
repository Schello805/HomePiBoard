import assert from 'node:assert/strict'
import test from 'node:test'

import { createSettingsStore, SettingsServerError, UnauthorizedError } from '../src/settings-store.ts'

function memoryStorage(initial: Record<string, string> = {}) {
  const values = new Map<string, string>(Object.entries(initial))
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value) },
    removeItem: (key: string) => { values.delete(key) },
  }
}

test('load uses server settings and refreshes the local cache', async () => {
  const storage = memoryStorage()
  const store = createSettingsStore({
    storage,
    fetcher: async () => new Response(JSON.stringify({ version: 2, location: 'Server', widgets: [] }), { status: 200 }),
  })

  const result = await store.load()

  assert.equal(result.source, 'server')
  assert.equal(result.settings.location, 'Server')
  assert.equal(JSON.parse(storage.getItem('homeboard-settings')!).location, 'Server')
})

test('load falls back to locally cached settings while offline', async () => {
  const storage = memoryStorage({
    'homeboard-settings': JSON.stringify({ version: 2, location: 'Offline', widgets: [] }),
  })
  const store = createSettingsStore({
    storage,
    fetcher: async () => { throw new Error('offline') },
  })

  const result = await store.load()

  assert.equal(result.source, 'local')
  assert.equal(result.settings.location, 'Offline')
})

test('save reports an invalid admin PIN', async () => {
  const store = createSettingsStore({
    storage: memoryStorage(),
    fetcher: async () => new Response(JSON.stringify({ error: 'Ungültige PIN.' }), { status: 401 }),
  })

  await assert.rejects(() => store.save({ version: 2, location: 'Test', weatherCity: '', widgets: [] }, '0000'), UnauthorizedError)
})

test('verifyPin accepts only a successful authentication response', async () => {
  const accepted = createSettingsStore({
    storage: memoryStorage(),
    fetcher: async () => new Response(null, { status: 204 }),
  })
  const rejected = createSettingsStore({
    storage: memoryStorage(),
    fetcher: async () => new Response(null, { status: 401 }),
  })

  assert.equal(await accepted.verifyPin('2468'), true)
  assert.equal(await rejected.verifyPin('0000'), false)
})

test('save does not disguise an HTTP server error as an offline save', async () => {
  const storage = memoryStorage()
  const store = createSettingsStore({
    storage,
    fetcher: async () => new Response(JSON.stringify({ error: 'Kaputt' }), { status: 500 }),
  })

  await assert.rejects(() => store.save({ version: 2, location: 'Test', weatherCity: '', widgets: [] }, '2468'), SettingsServerError)
  assert.equal(storage.getItem('homeboard-settings-dirty'), null)
})

test('offline edits remain authoritative until they are synchronized', async () => {
  const storage = memoryStorage()
  const offline = createSettingsStore({
    storage,
    fetcher: async () => { throw new TypeError('offline') },
  })
  await offline.save({ version: 2, location: 'Offline geändert', weatherCity: '', widgets: [] }, '')

  const online = createSettingsStore({
    storage,
    fetcher: async () => new Response(JSON.stringify({ version: 2, location: 'Server', widgets: [] }), { status: 200 }),
  })
  const loaded = await online.load()

  assert.equal(loaded.source, 'local')
  assert.equal(loaded.settings.location, 'Offline geändert')
  assert.equal(storage.getItem('homeboard-settings-dirty'), 'true')
})
