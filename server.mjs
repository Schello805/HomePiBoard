import { createServer } from 'node:http'
import { randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { mkdir, open, readFile, realpath, rename, unlink } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { promisify } from 'node:util'

import { defaultSettings, layoutFits, normalizeSettings } from './src/settings.ts'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const scrypt = promisify(scryptCallback)
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

class RequestBodyError extends Error {
  constructor() {
    super('invalid-request-body')
    this.name = 'RequestBodyError'
  }
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
    await temporaryHandle.writeFile(content, 'utf8')
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
  const requestedPath = pathname === '/' || pathname === '/admin' || pathname === '/admin/'
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
} = {}) {
  if (typeof adminPin !== 'string' || adminPin.length === 0) {
    throw new Error('HOMEPIBOARD_PIN muss explizit gesetzt sein.')
  }

  const settingsFile = path.join(dataDirectory, 'settings.json')
  const authFile = path.join(dataDirectory, 'auth.json')
  const authenticationFailures = new Map()
  const bootstrapCredential = createPinCredential(adminPin, scryptFunction)
  let settingsWriteQueue = Promise.resolve()
  let authenticationWorkQueue = Promise.resolve()

  function persistSettings(settings) {
    const operation = settingsWriteQueue.then(async () => {
      await durableAtomicWrite(settingsFile, `${JSON.stringify(settings, null, 2)}\n`)
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
          if (!layoutFits(settings.widgets)) return { settings, validationError: 'Das Widget-Layout passt nicht in das 24 × 8 Raster.' }
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
