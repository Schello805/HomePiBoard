import { createServer } from 'node:http'
import { randomUUID } from 'node:crypto'
import { mkdir, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { defaultSettings, layoutFits, normalizeSettings } from './src/settings.ts'

const rootDirectory = path.dirname(fileURLToPath(import.meta.url))
const mimeTypes = new Map([
  ['.css', 'text/css; charset=utf-8'],
  ['.html', 'text/html; charset=utf-8'],
  ['.js', 'text/javascript; charset=utf-8'],
  ['.json', 'application/json; charset=utf-8'],
  ['.png', 'image/png'],
  ['.svg', 'image/svg+xml'],
  ['.webp', 'image/webp'],
])

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
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
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
} = {}) {
  if (typeof adminPin !== 'string' || adminPin.length === 0) {
    throw new Error('HOMEPIBOARD_PIN muss explizit gesetzt sein.')
  }

  const settingsFile = path.join(dataDirectory, 'settings.json')
  const authenticationFailures = new Map()
  let settingsWriteQueue = Promise.resolve()

  function persistSettings(settings) {
    const operation = settingsWriteQueue.then(async () => {
      await mkdir(dataDirectory, { recursive: true })
      const temporarySettingsFile = `${settingsFile}.tmp-${process.pid}-${randomUUID()}`
      try {
        await writeFile(temporarySettingsFile, `${JSON.stringify(settings, null, 2)}\n`, 'utf8')
        await rename(temporarySettingsFile, settingsFile)
      } catch (error) {
        await unlink(temporarySettingsFile).catch(() => {})
        throw error
      }
    })
    settingsWriteQueue = operation.catch(() => {})
    return operation
  }

  function clientKey(request) {
    return request.socket.remoteAddress || 'unknown'
  }

  function isRateLimited(request) {
    const entry = authenticationFailures.get(clientKey(request))
    if (!entry) return false
    if (Date.now() - entry.since >= 60_000) {
      authenticationFailures.delete(clientKey(request))
      return false
    }
    return entry.count >= 5
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

  function rejectAuthentication(request, response) {
    if (isRateLimited(request)) {
      response.writeHead(429, {
        'content-type': 'application/json; charset=utf-8',
        'retry-after': '60',
      })
      response.end(JSON.stringify({ error: 'Zu viele Fehlversuche. Bitte später erneut versuchen.' }))
      return
    }
    recordAuthenticationFailure(request)
    json(response, 401, { error: 'Ungültige PIN.' })
  }

  return createServer(async (request, response) => {
    const url = new URL(request.url || '/', 'http://localhost')

    try {
      if (url.pathname === '/api/settings' && request.method === 'GET') {
        json(response, 200, await loadSettings(settingsFile))
        return
      }

      if (url.pathname === '/api/auth' && request.method === 'POST') {
        if (isRateLimited(request)) {
          rejectAuthentication(request, response)
          return
        }
        const body = await readJsonBody(request)
        if (body.pin !== adminPin) {
          rejectAuthentication(request, response)
          return
        }
        authenticationFailures.delete(clientKey(request))
        response.writeHead(204)
        response.end()
        return
      }

      if (url.pathname === '/api/settings' && request.method === 'PUT') {
        if (isRateLimited(request)) {
          rejectAuthentication(request, response)
          return
        }
        if (request.headers['x-admin-pin'] !== adminPin) {
          rejectAuthentication(request, response)
          return
        }
        authenticationFailures.delete(clientKey(request))
        const settings = normalizeSettings(await readJsonBody(request))
        if (!layoutFits(settings.widgets)) {
          json(response, 422, { error: 'Das Widget-Layout passt nicht in das 24 × 8 Raster.' })
          return
        }
        await persistSettings(settings)
        json(response, 200, settings)
        return
      }

      if (url.pathname.startsWith('/api/')) {
        json(response, 404, { error: 'API-Endpunkt nicht gefunden.' })
        return
      }

      await serveStatic(response, url.pathname, publicDirectory)
    } catch (error) {
      const status = error instanceof SyntaxError ? 400 : error instanceof Error && error.message === 'request-too-large' ? 413 : 500
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
