import assert from 'node:assert/strict'
import { scrypt as scryptCallback } from 'node:crypto'
import { mkdtemp, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { promisify } from 'node:util'

import { createHomePiBoardServer, getSystemInfo, getSystemNetwork, parentDirectoriesToSync } from '../server.mjs'

const scrypt = promisify(scryptCallback)

async function startServer({
  dataDirectory,
  adminPin = '2468',
  scryptFunction,
  calendarFetch,
  lookupFunction,
} = {}) {
  dataDirectory ||= await mkdtemp(path.join(tmpdir(), 'homepiboard-'))
  const server = createHomePiBoardServer({ dataDirectory, adminPin, scryptFunction, calendarFetch, lookupFunction })
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
    body: JSON.stringify({ version: 3, location: 'Flur', widgets: [{ title: 'Info', columns: 99, rows: 0 }] }),
  })

  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.location, 'Flur')
  assert.equal(saved.widgets[0].columns, 99)
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

test('staged authentication requests cannot exceed the expensive verification limit', async (context) => {
  let derivations = 0
  const running = await startServer({
    scryptFunction: (...arguments_) => {
      derivations += 1
      return scrypt(...arguments_)
    },
  })
  context.after(() => running.server.close())
  const bootstrapDerivations = derivations

  const responses = await Promise.all(Array.from({ length: 40 }, () => fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: 'wrong' }),
  })))

  assert.equal(responses.filter((response) => response.status === 401).length, 5)
  assert.equal(responses.filter((response) => response.status === 429).length, 35)
  assert.equal(derivations - bootstrapDerivations, 5)
})

test('new persistence directories sync each parent that received a directory entry', () => {
  assert.deepEqual(
    parentDirectoriesToSync('/srv/homepiboard', '/srv/homepiboard/data/auth'),
    ['/srv/homepiboard', '/srv/homepiboard/data'],
  )
})

test('settings API accepts layouts that extend beyond one screen', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({
      version: 3,
      widgets: Array.from({ length: 5 }, (_, index) => ({ id: `wide-${index}`, type: 'web', columns: 12, rows: 7 })),
    }),
  })

  assert.equal(response.status, 200)
  const saved = await response.json()
  assert.equal(saved.widgets.length, 5)
})

test('calendar API fetches and parses the saved iCalendar feed', async (context) => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'homepiboard-calendar-'))
  await writeFile(path.join(dataDirectory, 'settings.json'), JSON.stringify({
    version: 3,
    widgets: [{ id: 'school', type: 'calendar', title: 'Schule', url: 'https://calendar.example/feed.ics', columns: 8, rows: 5 }],
  }))
  let requestedUrl = ''
  const running = await startServer({
    dataDirectory,
    lookupFunction: async () => [{ address: '93.184.216.34', family: 4 }],
    calendarFetch: async (url) => {
      requestedUrl = String(url)
      return new Response('BEGIN:VCALENDAR\nBEGIN:VEVENT\nDTSTART:20260928T081500Z\nSUMMARY:Elternabend\nEND:VEVENT\nEND:VCALENDAR', { headers: { 'content-type': 'text/calendar' } })
    },
  })
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/calendar/school`)
  assert.equal(response.status, 200)
  assert.equal(requestedUrl, 'https://calendar.example/feed.ics')
  const body = await response.json()
  assert.equal(body.events[0].summary, 'Elternabend')
})

test('calendar API refuses feeds resolving to private network addresses', async (context) => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'homepiboard-calendar-private-'))
  await writeFile(path.join(dataDirectory, 'settings.json'), JSON.stringify({
    version: 3,
    widgets: [{ id: 'private', type: 'calendar', title: 'Intern', url: 'https://calendar.internal/feed.ics', columns: 8, rows: 5 }],
  }))
  let fetched = false
  const running = await startServer({
    dataDirectory,
    lookupFunction: async () => [{ address: '192.168.1.20', family: 4 }],
    calendarFetch: async () => {
      fetched = true
      return new Response('')
    },
  })
  context.after(() => running.server.close())

  const response = await fetch(`${running.url}/api/calendar/private`)
  assert.equal(response.status, 422)
  assert.equal(fetched, false)
})

test('concurrent settings writes all complete without temporary-file collisions', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const responses = await Promise.all(Array.from({ length: 30 }, (_, index) => fetch(`${running.url}/api/settings`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ version: 3, location: `Ort ${index}`, widgets: [] }),
  })))

  assert.deepEqual(responses.map((response) => response.status), Array(30).fill(200))
  const stored = JSON.parse(await readFile(path.join(running.dataDirectory, 'settings.json'), 'utf8'))
  assert.match(stored.location, /^Ort \d+$/)
})

test('admin PIN can be changed and remains active after a server restart', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const changed = await fetch(`${running.url}/api/admin-pin`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ pin: '1357' }),
  })
  assert.equal(changed.status, 204)

  const oldPin = await fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '2468' }),
  })
  const newPin = await fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1357' }),
  })
  assert.equal(oldPin.status, 401)
  assert.equal(newPin.status, 204)

  const authFile = await readFile(path.join(running.dataDirectory, 'auth.json'), 'utf8')
  assert.doesNotMatch(authFile, /1357|2468/)
  const storedAuth = JSON.parse(authFile)
  assert.equal(storedAuth.algorithm, 'scrypt')
  assert.ok(storedAuth.salt)
  assert.ok(storedAuth.hash)
  assert.equal((await stat(path.join(running.dataDirectory, 'auth.json'))).mode & 0o777, 0o600)

  await new Promise((resolve) => running.server.close(resolve))
  const restarted = await startServer({ dataDirectory: running.dataDirectory, adminPin: '2468' })
  context.after(() => restarted.server.close())
  const persistedPin = await fetch(`${restarted.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '1357' }),
  })
  assert.equal(persistedPin.status, 204)
})

test('admin PIN change validates the current and replacement PINs', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const wrongCurrent = await fetch(`${running.url}/api/admin-pin`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '0000' },
    body: JSON.stringify({ pin: '135790' }),
  })
  const invalidReplacement = await fetch(`${running.url}/api/admin-pin`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ pin: '12ab' }),
  })

  assert.equal(wrongCurrent.status, 401)
  assert.equal(invalidReplacement.status, 422)
})

test('concurrent PIN changes allow only one replacement to succeed', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const responses = await Promise.all(['135790', '246802'].map((pin) => fetch(`${running.url}/api/admin-pin`, {
    method: 'PUT',
    headers: { 'content-type': 'application/json', 'x-admin-pin': '2468' },
    body: JSON.stringify({ pin }),
  })))
  assert.deepEqual(responses.map((response) => response.status).sort(), [204, 401])

  const checks = await Promise.all(['135790', '246802'].map((pin) => fetch(`${running.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin }),
  })))
  assert.deepEqual(checks.map((response) => response.status).sort(), [204, 401])
})

test('malformed persisted credentials fail closed until the documented recovery is used', async (context) => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'homepiboard-'))
  await writeFile(path.join(dataDirectory, 'auth.json'), JSON.stringify({ version: 1, algorithm: 'scrypt', salt: 'bad', hash: 'bad' }))
  const running = await startServer({ dataDirectory })
  context.after(() => running.server.close())

  const originalConsoleError = console.error
  console.error = () => {}
  let response
  try {
    response = await fetch(`${running.url}/api/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: '2468' }),
    })
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(response.status, 500)

  await new Promise((resolve) => running.server.close(resolve))
  await unlink(path.join(dataDirectory, 'auth.json'))
  const recovered = await startServer({ dataDirectory, adminPin: '975310' })
  context.after(() => recovered.server.close())
  const recoveredResponse = await fetch(`${recovered.url}/api/auth`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ pin: '975310' }),
  })
  assert.equal(recoveredResponse.status, 204)
})

test('invalid JSON syntax in persisted credentials is a server error', async (context) => {
  const dataDirectory = await mkdtemp(path.join(tmpdir(), 'homepiboard-'))
  await writeFile(path.join(dataDirectory, 'auth.json'), '{bad')
  const running = await startServer({ dataDirectory })
  context.after(() => running.server.close())

  const originalConsoleError = console.error
  console.error = () => {}
  let response
  try {
    response = await fetch(`${running.url}/api/auth`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ pin: '2468' }),
    })
  } finally {
    console.error = originalConsoleError
  }

  assert.equal(response.status, 500)
})

test('upload API saves images up to 5MB and serves them via /uploads/', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const formData = new FormData()
  formData.append('file', new File(['fake-png-data'], 'test-image.png', { type: 'image/png' }))

  const uploadRes = await fetch(`${running.url}/api/upload`, {
    method: 'POST',
    headers: { 'x-admin-pin': '2468' },
    body: formData,
  })

  assert.equal(uploadRes.status, 200)
  const body = await uploadRes.json()
  assert.match(body.url, /^\/uploads\/\d+-[a-f0-9]+\.png$/)

  const getRes = await fetch(`${running.url}${body.url}`)
  assert.equal(getRes.status, 200)
  assert.equal(getRes.headers.get('content-type'), 'image/png')
  assert.equal(await getRes.text(), 'fake-png-data')
})

test('upload API rejects unauthenticated requests or files exceeding 5MB', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const formData = new FormData()
  formData.append('file', new File(['hello'], 'test.png', { type: 'image/png' }))

  const unauthRes = await fetch(`${running.url}/api/upload`, {
    method: 'POST',
    headers: { 'x-admin-pin': 'wrong' },
    body: formData,
  })
  assert.equal(unauthRes.status, 401)

  const bigFile = new File([new Uint8Array(5 * 1024 * 1024 + 1)], 'big.png', { type: 'image/png' })
  const bigFormData = new FormData()
  bigFormData.append('file', bigFile)

  const tooBigRes = await fetch(`${running.url}/api/upload`, {
    method: 'POST',
    headers: { 'x-admin-pin': '2468' },
    body: bigFormData,
  })
  assert.equal(tooBigRes.status, 413)
})

test('getSystemNetwork identifies external IPv4 addresses', () => {
  const fakeInterfaces = {
    lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
    eth0: [
      { address: 'fe80::1', family: 'IPv6', internal: false },
      { address: '192.168.1.50', family: 'IPv4', internal: false, netmask: '255.255.255.0' },
    ],
    wlan0: [
      { address: '10.0.0.22', family: 'IPv4', internal: false, netmask: '255.255.0.0' },
    ],
  }

  const result = getSystemNetwork(fakeInterfaces)
  assert.equal(result.primaryIp, '192.168.1.50')
  assert.equal(result.addresses.length, 2)
  assert.equal(result.addresses[0]?.name, 'eth0')
  assert.equal(result.addresses[1]?.name, 'wlan0')
})

test('getSystemInfo reads hardware metrics and thermal file when present', async () => {
  const tempDir = await mkdtemp(path.join(tmpdir(), 'thermal-test-'))
  const fakeThermal = path.join(tempDir, 'temp')
  await writeFile(fakeThermal, '48250\n', 'utf8')

  const info = await getSystemInfo({ thermalPath: fakeThermal })
  assert.equal(info.cpuTemp, 48.3)
  assert.ok(info.memory.totalMb > 0)
  assert.ok(typeof info.hostname === 'string')
  assert.ok(Array.isArray(info.loadAvg))
  assert.ok(typeof info.uptimeSeconds === 'number')

  // When thermal file is absent, cpuTemp gracefully falls back to null
  const missingThermal = await getSystemInfo({ thermalPath: path.join(tempDir, 'nonexistent') })
  assert.equal(missingThermal.cpuTemp, null)

  await unlink(fakeThermal)
})

test('system API returns hardware, network and system telemetry', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const res = await fetch(`${running.url}/api/system`)
  assert.equal(res.status, 200)
  const data = await res.json()

  assert.ok(typeof data.hostname === 'string')
  assert.ok(typeof data.platform === 'string')
  assert.ok(typeof data.arch === 'string')
  assert.ok(typeof data.nodeVersion === 'string')
  assert.ok(typeof data.uptimeSeconds === 'number')
  assert.ok(Array.isArray(data.loadAvg))
  assert.ok(data.memory && typeof data.memory.totalMb === 'number')
  assert.ok(data.memory.percent >= 0 && data.memory.percent <= 100)
  assert.ok(data.network && typeof data.network.primaryIp === 'string')
})

test('notify API creates, reads active and clears notifications', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  // Initially active is null
  const emptyRes = await fetch(`${running.url}/api/notify/active`)
  assert.equal(emptyRes.status, 200)
  assert.equal((await emptyRes.json()).notification, null)

  // Send a notification
  const postRes = await fetch(`${running.url}/api/notify`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Türklingel',
      message: 'Jemand steht an der Haustür',
      sound: 'doorbell',
      durationSeconds: 10,
    }),
  })
  assert.equal(postRes.status, 200)
  const postData = await postRes.json()
  assert.equal(postData.success, true)
  assert.equal(postData.notification.title, 'Türklingel')
  assert.equal(postData.notification.sound, 'doorbell')

  // Check active
  const activeRes = await fetch(`${running.url}/api/notify/active`)
  assert.equal(activeRes.status, 200)
  const activeData = await activeRes.json()
  assert.equal(activeData.notification.title, 'Türklingel')

  // Clear notification
  const clearRes = await fetch(`${running.url}/api/notify/clear`, { method: 'POST' })
  assert.equal(clearRes.status, 200)
  const afterClear = await (await fetch(`${running.url}/api/notify/active`)).json()
  assert.equal(afterClear.notification, null)
})

test('media API stores and returns playback state', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const postRes = await fetch(`${running.url}/api/media`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      title: 'Hotel California',
      artist: 'Eagles',
      album: 'Hotel California',
      playing: true,
    }),
  })
  assert.equal(postRes.status, 200)

  const getRes = await fetch(`${running.url}/api/media`)
  assert.equal(getRes.status, 200)
  const data = await getRes.json()
  assert.equal(data.title, 'Hotel California')
  assert.equal(data.artist, 'Eagles')
  assert.equal(data.playing, true)
})

test('energy API stores and returns power metrics', async (context) => {
  const running = await startServer()
  context.after(() => running.server.close())

  const postRes = await fetch(`${running.url}/api/energy`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      solarWatts: 820,
      houseWatts: 390,
      gridWatts: -430,
      batteryWatts: 0,
      batteryPercent: 92,
    }),
  })
  assert.equal(postRes.status, 200)

  const getRes = await fetch(`${running.url}/api/energy`)
  assert.equal(getRes.status, 200)
  const data = await getRes.json()
  assert.equal(data.solarWatts, 820)
  assert.equal(data.houseWatts, 390)
  assert.equal(data.gridWatts, -430)
  assert.equal(data.batteryPercent, 92)
})


