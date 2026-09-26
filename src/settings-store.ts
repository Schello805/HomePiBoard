import { defaultSettings, normalizeSettings, type DisplayPreset, type DisplaySettings } from './settings.ts'

const settingsKey = 'homeboard-settings'
const dirtyKey = 'homeboard-settings-dirty'
const presetsKey = 'homeboard-presets'

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class UnauthorizedError extends Error {
  constructor() {
    super('Ungültige PIN.')
    this.name = 'UnauthorizedError'
  }
}

export class RateLimitError extends Error {
  retryAfterSeconds: number

  constructor(retryAfterSeconds: number) {
    super(`Zu viele Fehlversuche. Erneut versuchen in ${retryAfterSeconds} Sekunden.`)
    this.name = 'RateLimitError'
    this.retryAfterSeconds = retryAfterSeconds
  }
}

export class SettingsServerError extends Error {
  status: number

  constructor(status: number) {
    super(`Einstellungen konnten nicht gespeichert werden (${status}).`)
    this.name = 'SettingsServerError'
    this.status = status
  }
}

function rateLimitError(response: Response) {
  const retryAfter = Number(response.headers.get('retry-after'))
  return new RateLimitError(Number.isFinite(retryAfter) && retryAfter > 0 ? Math.ceil(retryAfter) : 60)
}

function loadCachedSettings(storage: StorageAdapter) {
  const storedSettings = storage.getItem(settingsKey)
  if (!storedSettings) return normalizeSettings(defaultSettings)

  try {
    return normalizeSettings(JSON.parse(storedSettings))
  } catch {
    storage.removeItem(settingsKey)
    storage.removeItem(dirtyKey)
    return normalizeSettings(defaultSettings)
  }
}

function loadCachedPresets(storage: StorageAdapter): DisplayPreset[] {
  const stored = storage.getItem(presetsKey)
  if (!stored) return []
  try {
    const parsed = JSON.parse(stored)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function createSettingsStore({
  fetcher = fetch,
  storage = localStorage,
}: {
  fetcher?: Fetcher
  storage?: StorageAdapter
} = {}) {
  return {
    async verifyPin(pin: string) {
      try {
        const response = await fetcher('/api/auth', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ pin }),
        })
        if (response.status === 429) throw rateLimitError(response)
        if (response.status === 401) return false
        if (!response.ok) throw new SettingsServerError(response.status)
        return true
      } catch (error) {
        if (error instanceof RateLimitError || error instanceof SettingsServerError) throw error
        return false
      }
    },

    async changePin(currentPin: string, newPin: string) {
      const response = await fetcher('/api/admin-pin', {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-admin-pin': currentPin,
        },
        body: JSON.stringify({ pin: newPin }),
      })
      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok) throw new SettingsServerError(response.status)
    },

    async load(): Promise<{ settings: DisplaySettings; source: 'server' | 'local' }> {
      if (storage.getItem(dirtyKey) === 'true') return { settings: loadCachedSettings(storage), source: 'local' }

      try {
        const response = await fetcher('/api/settings', { headers: { accept: 'application/json' } })
        if (!response.ok) throw new SettingsServerError(response.status)
        const settings = normalizeSettings(await response.json())
        storage.setItem(settingsKey, JSON.stringify(settings))
        storage.removeItem(dirtyKey)
        return { settings, source: 'server' }
      } catch {
        return { settings: loadCachedSettings(storage), source: 'local' }
      }
    },

    async save(settingsValue: DisplaySettings, pin: string): Promise<{ settings: DisplaySettings; source: 'server' | 'local' }> {
      const settings = normalizeSettings(settingsValue)
      let response: Response

      try {
        response = await fetcher('/api/settings', {
          method: 'PUT',
          headers: {
            'content-type': 'application/json',
            'x-admin-pin': pin,
          },
          body: JSON.stringify(settings),
        })
      } catch {
        storage.setItem(settingsKey, JSON.stringify(settings))
        storage.setItem(dirtyKey, 'true')
        return { settings, source: 'local' }
      }

      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok) throw new SettingsServerError(response.status)

      const savedSettings = normalizeSettings(await response.json())
      storage.setItem(settingsKey, JSON.stringify(savedSettings))
      storage.removeItem(dirtyKey)
      return { settings: savedSettings, source: 'server' }
    },

    async listPresets(): Promise<DisplayPreset[]> {
      try {
        const response = await fetcher('/api/presets', { headers: { accept: 'application/json' } })
        if (response.ok) {
          const list = await response.json()
          if (Array.isArray(list)) {
            storage.setItem(presetsKey, JSON.stringify(list))
            return list
          }
        }
      } catch {
        // fallback
      }
      return loadCachedPresets(storage)
    },

    async savePreset(name: string, settingsValue: DisplaySettings, pin: string): Promise<DisplayPreset> {
      const settings = normalizeSettings(settingsValue)
      const response = await fetcher('/api/presets', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-admin-pin': pin,
        },
        body: JSON.stringify({ name, settings }),
      })
      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok) throw new SettingsServerError(response.status)
      const created = await response.json()
      const cached = loadCachedPresets(storage).filter((p) => p.id !== created.id)
      cached.unshift(created)
      storage.setItem(presetsKey, JSON.stringify(cached))
      return created
    },

    async updatePreset(id: string, updates: { name?: string; settings?: DisplaySettings }, pin: string): Promise<DisplayPreset> {
      const payload: Record<string, unknown> = {}
      if (updates.name !== undefined) payload.name = updates.name
      if (updates.settings !== undefined) payload.settings = normalizeSettings(updates.settings)

      const response = await fetcher(`/api/presets/${encodeURIComponent(id)}`, {
        method: 'PUT',
        headers: {
          'content-type': 'application/json',
          'x-admin-pin': pin,
        },
        body: JSON.stringify(payload),
      })
      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok) throw new SettingsServerError(response.status)
      const updated = await response.json()
      const cached = loadCachedPresets(storage).map((p) => (p.id === id ? updated : p))
      storage.setItem(presetsKey, JSON.stringify(cached))
      return updated
    },

    async deletePreset(id: string, pin: string): Promise<void> {
      const response = await fetcher(`/api/presets/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { 'x-admin-pin': pin },
      })
      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok && response.status !== 204 && response.status !== 404) throw new SettingsServerError(response.status)
      const cached = loadCachedPresets(storage).filter((p) => p.id !== id)
      storage.setItem(presetsKey, JSON.stringify(cached))
    },

    async activatePreset(id: string, pin: string): Promise<DisplaySettings> {
      const response = await fetcher(`/api/presets/${encodeURIComponent(id)}/activate`, {
        method: 'POST',
        headers: { 'x-admin-pin': pin },
      })
      if (response.status === 401) throw new UnauthorizedError()
      if (response.status === 429) throw rateLimitError(response)
      if (!response.ok) throw new SettingsServerError(response.status)
      const activatedSettings = normalizeSettings(await response.json())
      storage.setItem(settingsKey, JSON.stringify(activatedSettings))
      storage.removeItem(dirtyKey)
      return activatedSettings
    },
  }
}