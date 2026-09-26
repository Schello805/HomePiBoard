import { execFile as execFileCallback } from 'node:child_process'
import { createServer } from 'node:http'
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { lookup as dnsLookup } from 'node:dns/promises'
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import { isIP } from 'node:net'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { defaultSettings, GRID_COLUMNS, GRID_ROWS, layoutFits, normalizeSettings } from './src/settings.ts'
import { parseCalendarFeed } from './src/calendar-feed.ts'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const scrypt = promisify(scryptCallback)
const execFile = promisify(execFileCallback)
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.gif', 'image/gif'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

class RequestBodyError extends Error {
  constructor() {
    super('invalid-request-body')
    this.name = 'RequestBodyError'
  }
}

class CalendarFeedError extends Error {
  constructor(status, message) {
    super(message)
    this.name = 'CalendarFeedError'
    this.status = status
  }
}

function isPrivateNetworkAddress(address) {
  const normalized = address.toLowerCase().replace(/^\[|\]$/g, '')
  if (normalized === '::' || normalized === '::1') return true
  if (/^(fc|fd|fe[89ab])/.test(normalized)) return true
  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)?.[1]
  const ipv4 = mapped || (isIP(normalized) === 4 ? normalized : '')
  if (!ipv4) return false
  const [first, second] = ipv4.split('.').map(Number)
  return first === 0
    || first === 10
    || first === 127
    || (first === 169 && second === 254)
    || (first === 172 && second >= 16 && second <= 31)
    || (first === 192 && second === 168)
    || (first === 100 && second >= 64 && second <= 127)
    || (first === 198 && (second === 18 || second === 19))
    || first >= 224
}

async function validateCalendarFeedUrl(value, lookupFunction) {
  let url
  try {
    const normalized = String(value || '').trim().replace(/^webcal:\/\//i, 'https://')
    url = new URL(normalized)
  } catch {
    throw new CalendarFeedError(422, 'Die Kalender-URL ist ungültig.')
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new CalendarFeedError(422, 'Kalender-Feeds müssen eine öffentliche HTTPS-Adresse verwenden.')
  }
  let addresses
  try {
    addresses = isIP(url.hostname)
      ? [{ address: url.hostname }]
      : await lookupFunction(url.hostname, { all: true, verbatim: true })
  } catch {
    throw new CalendarFeedError(502, 'Die Kalender-Adresse konnte nicht aufgelöst werden.')
  }
  if (!addresses.length || addresses.some(({ address }) => isPrivateNetworkAddress(address))) {
    throw new CalendarFeedError(422, 'Private Netzwerkadressen sind für Kalender-Feeds nicht erlaubt.')
  }
  return url
}

async function downloadCalendarFeed(value, calendarFetch, lookupFunction) {
  let url = await validateCalendarFeedUrl(value, lookupFunction)
  for (let redirects = 0; redirects <= 3; redirects += 1) {
    let response
    try {
      response = await calendarFetch(url, { redirect: 'manual', signal: AbortSignal.timeout(10_000) })
    } catch {
      throw new CalendarFeedError(502, 'Der Kalender-Feed ist nicht erreichbar.')
    }
    const location = response.headers.get('location')
    if (response.status >= 300 && response.status < 400 && location) {
      if (redirects === 3) throw new CalendarFeedError(502, 'Der Kalender-Feed hat zu viele Weiterleitungen.')
      url = await validateCalendarFeedUrl(new URL(location, url).href, lookupFunction)
      continue
    }
    if (!response.ok) throw new CalendarFeedError(502, `Der Kalender-Feed antwortet mit Status ${response.status}.`)
    const declaredLength = Number(response.headers.get('content-length'))
    if (Number.isFinite(declaredLength) && declaredLength > 1_000_000) throw new CalendarFeedError(502, 'Der Kalender-Feed ist zu groß.')
    const content = await response.text()
    if (Buffer.byteLength(content, 'utf8') > 1_000_000) throw new CalendarFeedError(502, 'Der Kalender-Feed ist zu groß.')
    return parseCalendarFeed(content)
  }
  throw new CalendarFeedError(502, 'Der Kalender-Feed konnte nicht geladen werden.')
}

function json(response, status, body) {
  response.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  response.end(JSON.stringify(body))
}

async function readJsonBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_000_000) throw new Error('request-too-large')
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
  } catch (error) {
    if (error instanceof SyntaxError) throw new RequestBodyError()
    throw error
  }
}

async function loadSettings(settingsFile) {
  try {
    return normalizeSettings(JSON.parse(await readFile(settingsFile, 'utf8')))
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      return normalizeSettings(defaultSettings)
    }
    return normalizeSettings(defaultSettings)
  }
}

async function createPinCredential(pin, scryptFunction = scrypt) {
  const salt = randomBytes(16)
  const hash = Buffer.from(await scryptFunction(pin, salt, 64))
  return {
    version: 1,
    algorithm: 'scrypt',
    salt: salt.toString('base64'),
    hash: hash.toString('base64'),
  }
}

async function verifyPinCredential(pin, credential, scryptFunction = scrypt) {
  if (!credential || credential.version !== 1 || credential.algorithm !== 'scrypt' || typeof credential.salt !== 'string' || typeof credential.hash !== 'string') {
    throw new Error('invalid-auth-file')
  }
  const salt = Buffer.from(credential.salt, 'base64')
  const expected = Buffer.from(credential.hash, 'base64')
  if (salt.length !== 16 || expected.length !== 64 || salt.toString('base64') !== credential.salt || expected.toString('base64') !== credential.hash) {
    throw new Error('invalid-auth-file')
  }
  const actual = Buffer.from(await scryptFunction(pin, salt, expected.length))
  return expected.length === actual.length && timingSafeEqual(expected, actual)
}

export function getSystemNetwork(networkInterfaces = os.networkInterfaces()) {
  const addresses = []
  for (const [name, list] of Object.entries(networkInterfaces || {})) {
    if (!list) continue
    for (const iface of list) {
      if (!iface.internal && iface.family === 'IPv4') {
        addresses.push({ name, address: iface.address, netmask: iface.netmask })
      }
    }
  }
  return {
    primaryIp: addresses[0]?.address || '127.0.0.1',
    addresses,
  }
}

export async function getSystemInfo({ thermalPath = '/sys/class/thermal/thermal_zone0/temp', networkInterfaces } = {}) {
  const total = os.totalmem()
  const free = os.freemem()
  const used = Math.max(0, total - free)
  let cpuTemp = null
  try {
    const raw = await readFile(thermalPath, 'utf8')
    const milli = Number(raw.trim())
    if (Number.isFinite(milli) && milli > 0) {
      cpuTemp = Math.round(milli / 100) / 10
    }
  } catch {
    // Thermal zone file not present or unreadable
  }

  return {
    hostname: os.hostname(),
    platform: process.platform,
    arch: process.arch,
    nodeVersion: process.version,
    uptimeSeconds: Math.round(os.uptime()),
    loadAvg: os.loadavg().map((val) => Math.round(val * 100) / 100),
    cpuTemp,
    memory: {
      totalMb: Math.round(total / (1024 * 1024)),
      freeMb: Math.round(free / (1024 * 1024)),
      usedMb: Math.round(used / (1024 * 1024)),
      percent: total > 0 ? Math.round((used / total) * 100) : 0,
    },
    network: getSystemNetwork(networkInterfaces),
  }
}

export async function getSystemUpdateStatus({ cwd = rootDirectory, fetchRemote = false, exec = execFile } = {}) {
  try {
    const { stdout: currentCommit } = await exec('git', ['rev-parse', '--short', 'HEAD'], { cwd })
    const { stdout: currentCommitMsg } = await exec('git', ['log', '-1', '--pretty=format:%s'], { cwd })
    const { stdout: branch } = await exec('git', ['rev-parse', '--abbrev-ref', 'HEAD'], { cwd })

    let remoteCommit = ''
    let updateAvailable = false
    let pendingCommits = []

    if (fetchRemote) {
      try {
        await exec('git', ['fetch', 'origin', branch.trim()], { cwd, timeout: 10000 })
      } catch {
        // remote unreachable / offline
      }
    }

    try {
      const { stdout: remoteShort } = await exec('git', ['rev-parse', '--short', `origin/${branch.trim()}`], { cwd })
      remoteCommit = remoteShort.trim()
      const { stdout: diff } = await exec('git', ['log', `HEAD..origin/${branch.trim()}`, '--pretty=format:%h %s'], { cwd })
      pendingCommits = diff.trim() ? diff.trim().split('\n').filter(Boolean) : []
      updateAvailable = pendingCommits.length > 0
    } catch {
      // no upstream tracked or git fetch failed
    }

    return {
      success: true,
      branch: branch.trim(),
      currentCommit: currentCommit.trim(),
      currentCommitMsg: currentCommitMsg.trim(),
      remoteCommit: remoteCommit || currentCommit.trim(),
      updateAvailable,
      pendingCommits,
    }
  } catch (error) {
    return {
      success: false,
      error: error.message,
      branch: 'main',
      currentCommit: 'unbekannt',
      currentCommitMsg: '',
      remoteCommit: '',
      updateAvailable: false,
      pendingCommits: [],
    }
  }
}

export async function performSystemUpdate({ cwd = rootDirectory, restartProcess = true, exec = execFile } = {}) {
  const log = []
  const env = {
    ...process.env,
    PATH: `${process.env.PATH || ''}:/usr/local/bin:/usr/bin:/bin:/usr/local/sbin:/usr/sbin:/sbin`,
  }

  log.push('1/4: Hole neuesten Code von GitHub (git pull)...')
  try {
    const { stdout: gitOut, stderr: gitErr } = await exec('git', ['pull'], { cwd, env, timeout: 45000 })
    if (gitOut.trim()) log.push(gitOut.trim())
    else if (gitErr.trim()) log.push(gitErr.trim())
  } catch (err) {
    log.push(`git pull: ${err.message}`)
  }

  log.push('2/4: Prüfe npm Abhängigkeiten...')
  try {
    const { stdout: npmOut } = await exec('npm', ['install', '--no-audit', '--no-fund'], { cwd, env, timeout: 120000 })
    if (npmOut.trim()) log.push(npmOut.trim().split('\n').slice(-3).join('\n'))
  } catch (err) {
    log.push(`npm install: ${err.message}`)
  }

  log.push('3/4: Kompiliere Frontend (Vite & TypeScript)...')
  try {
    const { stdout: buildOut } = await exec('npm', ['run', 'build'], { cwd, env, timeout: 120000 })
    if (buildOut.trim()) log.push(buildOut.trim().split('\n').slice(-3).join('\n'))
    log.push('✓ Frontend erfolgreich gebaut!')
  } catch (err) {
    log.push(`Build-Warnung: ${err.message}`)
  }

  log.push('4/4: Aktualisiere HDMI Monitor & Audio...')
  try {
    await exec('bash', ['./scripts/disable-sleep.sh'], { cwd, env, timeout: 20000 })
  } catch {
    // ignore
  }
  try {
    await exec('bash', ['./scripts/set-audio-output.sh', 'hdmi'], { cwd, env, timeout: 20000 })
  } catch {
    // ignore
  }
  try {
    await exec('bash', ['./scripts/setup-hdmi-audio.sh'], { cwd, env, timeout: 20000 })
  } catch {
    // ignore
  }
  try {
    await exec('pkill', ['-f', 'chromium|chrome'], { env, timeout: 3000 })
    log.push('✓ Kiosk-Browser auf HDMI neu geladen.')
  } catch {
    log.push('ℹ Kiosk-Browser nicht aktiv oder bereits aktuell.')
  }

  let newCommit = 'aktuell'
  try {
    const { stdout: commitOut } = await exec('git', ['rev-parse', '--short', 'HEAD'], { cwd, env })
    newCommit = commitOut.trim()
  } catch {
    // ignore
  }

  if (restartProcess) {
    setTimeout(() => {
      process.exit(0)
    }, 1500)
  }

  return {
    success: true,
    newCommit,
    log: log.join('\n'),
    restarting: restartProcess,
  }
}

export async function applySystemAudioOutput(audioOutput = 'hdmi', { cwd = rootDirectory, exec = execFile } = {}) {
  const scriptPath = path.join(cwd, 'scripts', 'set-audio-output.sh')
  const target = audioOutput === 'jack' ? 'jack' : 'hdmi'
  try {
    const { stdout, stderr } = await exec('bash', [scriptPath, target], { cwd, timeout: 15000 })
    return { success: true, target, output: (stdout || stderr || '').trim() }
  } catch (error) {
    return { success: false, target, error: error instanceof Error ? error.message : String(error) }
  }
}

export function parentDirectoriesToSync(existingAncestor, targetDirectory) {
  const relative = path.relative(existingAncestor, targetDirectory)
  if (!relative) return []
  if (relative.startsWith('..') || path.isAbsolute(relative)) throw new Error('invalid-directory-ancestor')
  const directories = []
  let current = existingAncestor
  for (const segment of relative.split(path.sep)) {
    directories.push(current)
    current = path.join(current, segment)
  }
  return directories
}

async function syncDirectory(directory) {
  const handle = await open(directory, 'r')
  try {
    await handle.sync()
  } finally {
    await handle.close()
  }
}

async function ensureDirectoryDurable(directory) {
  let existingAncestor = directory
  while (true) {
    try {
      const handle = await open(existingAncestor, 'r')
      await handle.close()
      break
    } catch (error) {
      if (!error || typeof error !== 'object' || !('code' in error) || error.code !== 'ENOENT') throw error
      const parent = path.dirname(existingAncestor)
      if (parent === existingAncestor) throw error
      existingAncestor = parent
    }
  }

  await mkdir(directory, { recursive: true })
  for (const parentDirectory of parentDirectoriesToSync(existingAncestor, directory)) {
    await syncDirectory(parentDirectory)
  }
}

async function durableAtomicWrite(targetFile, content, mode = 0o600) {
  await ensureDirectoryDurable(path.dirname(targetFile))
  const temporaryFile = `${targetFile}.tmp-${process.pid}-${randomUUID()}`
  let temporaryHandle
  try {
    temporaryHandle = await open(temporaryFile, 'wx', mode)
    if (typeof content === 'string') {
      await temporaryHandle.writeFile(content, 'utf8')
    } else {
      await temporaryHandle.writeFile(content)
    }
    await temporaryHandle.sync()
    await temporaryHandle.close()
    temporaryHandle = undefined
    await rename(temporaryFile, targetFile)

    await syncDirectory(path.dirname(targetFile))
  } catch (error) {
    await temporaryHandle?.close().catch(() => {})
    await unlink(temporaryFile).catch(() => {})
    throw error
  }
}

async function serveStatic(response, pathname, publicDirectory) {
  const requestedPath = pathname === '/' || pathname === '/admin' || pathname === '/admin/' || pathname === '/settings' || pathname === '/settings/'
    ? 'index.html'
    : pathname.replace(/^\/+/, '')
  const resolvedPath = path.resolve(publicDirectory, requestedPath)
  const relativePath = path.relative(publicDirectory, resolvedPath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403)
    response.end('Forbidden')
    return
  }

  try {
    const [realPublicDirectory, realResolvedPath] = await Promise.all([
      realpath(publicDirectory),
      realpath(resolvedPath),
    ])
    const realRelativePath = path.relative(realPublicDirectory, realResolvedPath)
    if (realRelativePath.startsWith('..') || path.isAbsolute(realRelativePath)) {
      response.writeHead(403)
      response.end('Forbidden')
      return
    }
    const content = await readFile(resolvedPath)
    response.writeHead(200, {
      'content-type': mimeTypes.get(path.extname(resolvedPath)) || 'application/octet-stream',
      'cache-control': requestedPath === 'index.html' ? 'no-cache' : 'public, max-age=31536000, immutable',
    })
    response.end(content)
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      response.writeHead(404)
      response.end('Not found')
      return
    }
    throw error
  }
}

export function createHomePiBoardServer({
  dataDirectory = path.join(rootDirectory, 'data'),
  publicDirectory = path.join(rootDirectory, 'dist'),
  adminPin = process.env.HOMEPIBOARD_PIN,
  scryptFunction = scrypt,
  calendarFetch = fetch,
  lookupFunction = dnsLookup,
  thermalPath = '/sys/class/thermal/thermal_zone0/temp',
  updateStatusHandler,
  updateExecuteHandler,
  audioOutputExecuteHandler = (output) => applySystemAudioOutput(output, { exec: execFile }),
} = {}) {
  if (typeof adminPin !== 'string' || adminPin.length === 0) {
    throw new Error('HOMEPIBOARD_PIN muss explizit gesetzt sein.')
  }

  const settingsFile = path.join(dataDirectory, 'settings.json')
  const presetsFile = path.join(dataDirectory, 'presets.json')
  const authFile = path.join(dataDirectory, 'auth.json')
  const authenticationFailures = new Map()
  const bootstrapCredential = createPinCredential(adminPin, scryptFunction)
  let settingsWriteQueue = Promise.resolve()
  let authenticationWorkQueue = Promise.resolve()

  let activeNotification = null
  const sseClients = new Set()
  let latestMedia = {
    title: 'Keine Wiedergabe',
    artist: 'Bereit',
    album: '',
    coverUrl: '',
    playing: false,
    updatedAt: Date.now(),
  }

  function broadcastNotification(notification) {
    const payload = `data: ${JSON.stringify(notification)}\n\n`
    for (const client of sseClients) {
      try {
        client.write(payload)
      } catch {
        sseClients.delete(client)
      }
    }
  }

  function persistSettings(settings) {
    const operation = settingsWriteQueue.then(async () => {
      await durableAtomicWrite(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
      if (settings.audioOutput && typeof audioOutputExecuteHandler === 'function') {
        audioOutputExecuteHandler(settings.audioOutput).catch(() => {})
      }
    })
    settingsWriteQueue = operation.catch(() => {})
    return operation
  }

  async function loadPresets() {
    try {
      const content = await readFile(presetsFile, 'utf8')
      const parsed = JSON.parse(content)
      return Array.isArray(parsed) ? parsed : []
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return []
      throw error
    }
  }

  function persistPresets(presets) {
    const operation = settingsWriteQueue.then(async () => {
      await durableAtomicWrite(presetsFile, `${JSON.stringify(presets, null, 2)}\n`)
    })
    settingsWriteQueue = operation.catch(() => {})
    return operation
  }

  async function loadPinCredential() {
    try {
      return JSON.parse(await readFile(authFile, 'utf8'))
    } catch (error) {
      if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') return bootstrapCredential
      throw error
    }
  }

  async function verifyPin(pin) {
    if (typeof pin !== 'string') return false
    return verifyPinCredential(pin, await loadPinCredential(), scryptFunction)
  }

  function queueAuthenticationWork(work) {
    const operation = authenticationWorkQueue.then(work)
    authenticationWorkQueue = operation.then(() => undefined, () => undefined)
    return operation
  }

  async function replacePin(newPin) {
    if (typeof newPin !== 'string' || !/^\d{4,64}$/.test(newPin)) {
      return 'Die neue PIN muss aus 4 bis 64 Ziffern bestehen.'
    }
    const credential = await createPinCredential(newPin, scryptFunction)
    await durableAtomicWrite(authFile, `${JSON.stringify(credential, null, 2)}\n`)
    return ''
  }

  function clientKey(request) {
    return request.socket.remoteAddress || 'unknown'
  }

  function rateLimitRetryAfter(request) {
    const entry = authenticationFailures.get(clientKey(request))
    if (!entry) return 0
    const elapsed = Date.now() - entry.since
    if (elapsed >= 60_000) {
      authenticationFailures.delete(clientKey(request))
      return 0
    }
    return entry.count >= 5 ? Math.max(1, Math.ceil((60_000 - elapsed) / 1000)) : 0
  }

  function recordAuthenticationFailure(request) {
    const key = clientKey(request)
    const entry = authenticationFailures.get(key)
    if (!entry || Date.now() - entry.since >= 60_000) {
      authenticationFailures.set(key, { count: 1, since: Date.now() })
      return
    }
    entry.count += 1
  }

  function rejectRateLimited(response, retryAfter) {
    response.writeHead(429, {
      'content-type': 'application/json; charset=utf-8',
      'retry-after': String(retryAfter),
    })
    response.end(JSON.stringify({ error: 'Zu viele Fehlversuche. Bitte später erneut versuchen.' }))
  }

  async function runAuthenticated(request, pin, onAuthenticated) {
    return queueAuthenticationWork(async () => {
      const retryAfter = rateLimitRetryAfter(request)
      if (retryAfter) return { status: 'rate-limited', retryAfter }
      if (!(await verifyPin(pin))) {
        recordAuthenticationFailure(request)
        return { status: 'unauthorized', retryAfter: 0 }
      }
      authenticationFailures.delete(clientKey(request))
      return { status: 'accepted', retryAfter: 0, value: await onAuthenticated() }
    })
  }

  function respondToAuthenticationFailure(result, response) {
    if (result.status === 'rate-limited') rejectRateLimited(response, result.retryAfter)
    else json(response, 401, { error: 'Ungültige PIN.' })
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost')

    try {
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        json(response, 200, await loadSettings(settingsFile))
        return
      }

      if (url.pathname === '/api/system' && request.method === 'GET') {
        const info = await getSystemInfo({ thermalPath })
        json(response, 200, info)
        return
      }

      if (url.pathname === '/api/system/update-status' && request.method === 'GET') {
        const fetchRemote = url.searchParams.get('check') === '1'
        const status = updateStatusHandler
          ? await updateStatusHandler(fetchRemote)
          : await getSystemUpdateStatus({ cwd: rootDirectory, fetchRemote })
        json(response, 200, status)
        return
      }

      if (url.pathname === '/api/system/update' && request.method === 'POST') {
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          return updateExecuteHandler
            ? await updateExecuteHandler(process.env.NODE_ENV !== 'test')
            : await performSystemUpdate({ cwd: rootDirectory, restartProcess: process.env.NODE_ENV !== 'test' })
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        json(response, 200, result.value)
        return
      }

      if (url.pathname === '/api/notify' && request.method === 'POST') {
        const body = await readJsonBody(request)
        const durationSeconds = Math.max(3, Math.min(120, Number(body.durationSeconds ?? body.duration) || 15))
        const imageUrl = String(body.imageUrl || body.image || '').slice(0, 500)
        const notification = {
          id: randomUUID(),
          title: String(body.title || 'Benachrichtigung').slice(0, 100),
          message: String(body.message || '').slice(0, 500),
          imageUrl,
          image: imageUrl,
          sound: ['chime', 'doorbell', 'alert', 'beep', 'none'].includes(body.sound) ? body.sound : 'doorbell',
          durationSeconds,
          duration: durationSeconds,
          priority: body.priority === 'urgent' ? 'urgent' : 'normal',
          timestamp: Date.now(),
        }
        activeNotification = notification
        broadcastNotification(notification)
        json(response, 200, { success: true, notification })
        return
      }

      if (url.pathname === '/api/notify/active' && request.method === 'GET') {
        const isExpired = !activeNotification || (Date.now() - activeNotification.timestamp >= activeNotification.durationSeconds * 1000)
        json(response, 200, { notification: isExpired ? null : activeNotification })
        return
      }

      if (url.pathname === '/api/notify/clear' && request.method === 'POST') {
        activeNotification = null
        broadcastNotification({ id: null, cleared: true })
        json(response, 200, { success: true })
        return
      }

      if (url.pathname === '/api/notify/stream' && request.method === 'GET') {
        response.writeHead(200, {
          'Content-Type': 'text/event-stream; charset=utf-8',
          'Cache-Control': 'no-cache, no-transform',
          'Connection': 'keep-alive',
        })
        response.write(': connected\n\n')
        sseClients.add(response)
        request.on('close', () => {
          sseClients.delete(response)
        })
        return
      }

      if (url.pathname === '/api/media' && request.method === 'POST') {
        const body = await readJsonBody(request)
        const isPlaying = Boolean(body.playing ?? body.isPlaying)
        latestMedia = {
          title: String(body.title || 'Keine Wiedergabe').slice(0, 150),
          artist: String(body.artist || '').slice(0, 150),
          album: String(body.album || '').slice(0, 150),
          coverUrl: body.coverUrl ? String(body.coverUrl).slice(0, 500) : '',
          playing: isPlaying,
          isPlaying,
          updatedAt: Date.now(),
        }
        json(response, 200, latestMedia)
        return
      }

      if (url.pathname === '/api/media' && request.method === 'GET') {
        json(response, 200, latestMedia)
        return
      }


      if (url.pathname.startsWith('/api/calendar/') && request.method === 'GET') {
        const widgetId = decodeURIComponent(url.pathname.slice('/api/calendar/'.length))
        const settings = await loadSettings(settingsFile)
        const widget = settings.widgets.find((candidate) => candidate.id === widgetId && (candidate.type === 'calendar' || candidate.type === 'waste') && candidate.url.trim())
        if (!widget) {
          json(response, 404, { error: 'Kalender-Widget nicht gefunden.' })
          return
        }
        try {
          const events = await downloadCalendarFeed(widget.url, calendarFetch, lookupFunction)
          json(response, 200, { events })
        } catch (error) {
          if (error instanceof CalendarFeedError) json(response, error.status, { error: error.message })
          else throw error
        }
        return
      }

      if (url.pathname === '/api/auth' && request.method === 'POST') {
        const body = await readJsonBody(request)
        const result = await runAuthenticated(request, body.pin, async () => undefined)
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        response.writeHead(204)
        response.end()
        return
      }

      if (url.pathname === '/api/settings' && request.method === 'PUT') {
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const settings = normalizeSettings(await readJsonBody(request))
          if (!layoutFits(settings.widgets)) return { settings, validationError: `Das Widget-Layout passt nicht in das ${GRID_COLUMNS} × ${GRID_ROWS} Raster.` }
          await persistSettings(settings)
          return { settings, validationError: '' }
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        if (result.value.validationError) {
          json(response, 422, { error: result.value.validationError })
          return
        }
        json(response, 200, result.value.settings)
        return
      }

      if (url.pathname === '/api/presets' && request.method === 'GET') {
        const presets = await loadPresets()
        json(response, 200, presets)
        return
      }

      if (url.pathname === '/api/presets' && request.method === 'POST') {
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const body = await readJsonBody(request)
          const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : 'Neues Display'
          const settings = normalizeSettings(body.settings || defaultSettings)
          const preset = {
            id: randomUUID(),
            name,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            settings,
          }
          const presets = await loadPresets()
          presets.unshift(preset)
          await persistPresets(presets)
          return preset
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        json(response, 201, result.value)
        return
      }

      if (url.pathname.startsWith('/api/presets/') && url.pathname.endsWith('/activate') && request.method === 'POST') {
        const presetId = url.pathname.slice('/api/presets/'.length, -'/activate'.length)
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const presets = await loadPresets()
          const preset = presets.find((p) => p.id === presetId)
          if (!preset) return { notFound: true }
          const settings = normalizeSettings(preset.settings)
          await persistSettings(settings)
          return { settings }
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        if (result.value.notFound) {
          json(response, 404, { error: 'Layout nicht gefunden.' })
          return
        }
        json(response, 200, result.value.settings)
        return
      }

      if (url.pathname.startsWith('/api/presets/') && request.method === 'PUT') {
        const presetId = url.pathname.slice('/api/presets/'.length)
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const body = await readJsonBody(request)
          const presets = await loadPresets()
          const index = presets.findIndex((p) => p.id === presetId)
          if (index === -1) return { notFound: true }
          const existing = presets[index]
          const name = typeof body.name === 'string' && body.name.trim() ? body.name.trim().slice(0, 80) : existing.name
          const settings = body.settings ? normalizeSettings(body.settings) : existing.settings
          const updated = {
            ...existing,
            name,
            settings,
            updatedAt: Date.now(),
          }
          presets[index] = updated
          await persistPresets(presets)
          return { updated }
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        if (result.value.notFound) {
          json(response, 404, { error: 'Layout nicht gefunden.' })
          return
        }
        json(response, 200, result.value.updated)
        return
      }

      if (url.pathname.startsWith('/api/presets/') && request.method === 'DELETE') {
        const presetId = url.pathname.slice('/api/presets/'.length)
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const presets = await loadPresets()
          const filtered = presets.filter((p) => p.id !== presetId)
          await persistPresets(filtered)
          return { ok: true }
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        response.writeHead(204)
        response.end()
        return
      }

      if (url.pathname === '/api/admin-pin' && request.method === 'PUT') {
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          const body = await readJsonBody(request)
          return replacePin(body.pin)
        })
        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        if (result.value) {
          json(response, 422, { error: result.value })
          return
        }
        response.writeHead(204)
        response.end()
        return
      }

      if (url.pathname.startsWith('/uploads/') && request.method === 'GET') {
        const filename = path.basename(url.pathname)
        const filePath = path.join(dataDirectory, 'uploads', filename)
        const ext = path.extname(filename).toLowerCase()
        const mime = mimeTypes.get(ext)
        if (!mime) {
          response.writeHead(403)
          response.end('Forbidden')
          return
        }
        try {
          const content = await readFile(filePath)
          response.writeHead(200, {
            'content-type': mime,
            'cache-control': 'public, max-age=31536000, immutable',
          })
          response.end(content)
        } catch (error) {
          if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
            response.writeHead(404)
            response.end('Not found')
            return
          }
          throw error
        }
        return
      }

      if (url.pathname === '/api/upload' && request.method === 'POST') {
        const result = await runAuthenticated(request, request.headers['x-admin-pin'], async () => {
          let formData
          try {
            const webReq = new Response(request, { headers: request.headers })
            formData = await webReq.formData()
          } catch {
            throw new RequestBodyError()
          }

          const file = formData.get('file')
          if (!file || typeof file !== 'object' || typeof file.arrayBuffer !== 'function') {
            return { status: 400, error: 'Keine Datei übertragen.' }
          }

          const maxSizeBytes = 5 * 1024 * 1024
          if (file.size > maxSizeBytes) {
            return { status: 413, error: 'Die Datei ist größer als 5 MB.' }
          }

          const name = file.name || 'image.png'
          const rawExt = path.extname(name).toLowerCase()
          const allowedExts = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'])
          const ext = allowedExts.has(rawExt) ? rawExt : '.png'

          const buffer = Buffer.from(await file.arrayBuffer())
          if (buffer.length > maxSizeBytes) {
            return { status: 413, error: 'Die Datei ist größer als 5 MB.' }
          }

          const uploadDir = path.join(dataDirectory, 'uploads')
          const safeName = `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`
          const targetFile = path.join(uploadDir, safeName)

          await durableAtomicWrite(targetFile, buffer, 0o644)
          return { status: 200, url: `/uploads/${safeName}` }
        })

        if (result.status !== 'accepted') {
          respondToAuthenticationFailure(result, response)
          return
        }
        if (result.value.error) {
          json(response, result.value.status, { error: result.value.error })
          return
        }
        json(response, 200, { url: result.value.url })
        return
      }

      if (url.pathname.startsWith('/api/')) {
        json(response, 404, { error: 'API-Endpunkt nicht gefunden.' })
        return
      }

      await serveStatic(response, url.pathname, publicDirectory)
    } catch (error) {
      const status = error instanceof RequestBodyError ? 400 : error instanceof Error && error.message === 'request-too-large' ? 413 : 500
      json(response, status, { error: status === 500 ? 'Interner Serverfehler.' : 'Ungültige Anfrage.' })
      if (status === 500) console.error(error)
    }
  })
}

if (process.argv[1] && pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url) {
  const port = Number(process.env.PORT) || 4173
  const host = process.env.HOST || '0.0.0.0'
  const server = createHomePiBoardServer()
  server.listen(port, host, () => {
    console.log(`HomePiBoard läuft auf http://${host}:${port}`)
    console.log('Admin-PIN ist über HOMEPIBOARD_PIN konfiguriert.')
  })
}
