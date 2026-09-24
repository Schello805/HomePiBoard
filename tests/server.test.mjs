import assert from 'node:assert/strict'
import { mkdtemp, readFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'

import { createHomePiBoardServer } from '../server.mjs'

async function startServer() {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'homepiboard-'))
  const server = createHomePiBoardServer({ dataDirectory, adminPin: '2468' })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Server did not start')
  return {
    dataDirectory,
    server,
    url: `http://127.0.0.1:${address.port}`,
  }
}

test('settings API persists normalized settings', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ version: 2, location: 'Flur', widgets: [{ title: 'Info', columns: 99, rows: 0 }] }),
  })

  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.location, 'Flur')
  assert.equal(saved.widgets[0].columns, 24)
  assert.equal(saved.widgets[0].rows, 3)

  const stored = JSON.parse(await readFile(path.join(running.dataDirectory, 'settings.json'), 'utf8'))
  assert.deepEqual(stored, saved)
})

test('settings API rejects a missing or invalid admin PIN', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': 'wrong' },
    body: '{}',
  })

  assert.equal(response.status, 401)
})

test('auth endpoint validates the configured PIN', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const accepted = await fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468' }),
  })
  const rejected = await fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '0000' }),
  })

  assert.equal(accepted.status, 204)
  assert.equal(rejected.status, 401)
})

test('server requires an explicitly configured admin PIN', () => {
  assert.throws(() => createHomePiBoardServer({ adminPin: '' }), /HOMEPIBOARD_PIN/)
})

test('authentication failures are rate limited', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const statuses = []
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await fetch(`${running.url}/api/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: 'wrong' }),
    })
    statuses.push(response.status)
  }

  assert.deepEqual(statuses, [401, 401, 401, 401, 401, 429])
})

test('settings API rejects layouts that do not fit the kiosk grid', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({
      version: 2,
      widgets: Array.from({ length: 5 }, (_, index) => ({ id: `wide-${index}`, type: 'web', columns: 12, rows: 4 })),
    }),
  })

  assert.equal(response.status, 422)
})

test('concurrent settings writes all complete without temporary-file collisions', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const responses = await Promise.all(Array.from({ length: 30 }, (_, index) => fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ version: 2, location: `Ort ${index}`, widgets: [] }),
  })))

  assert.deepEqual(responses.map((response) => response.status), Array(30).fill(200))
  const stored = JSON.parse(await readFile(path.join(running.dataDirectory, 'settings.json'), 'utf8'))
  assert.match(stored.location, /^Ort \d+$/)
})
