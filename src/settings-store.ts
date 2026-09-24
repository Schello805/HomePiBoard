import { defaultSettings, normalizeSettings, type DisplaySettings } from './settings.ts'

const settingsKey = 'homeboard-settings'
const dirtyKey = 'homeboard-settings-dirty'

type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>
type Fetcher = (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>

export class UnauthorizedError extends Error {
  constructor() {
    super('Ungültige PIN.')
    this.name = 'UnauthorizedError'
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
        return response.ok
      } catch {
        return false
      }
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
      if (!response.ok) throw new SettingsServerError(response.status)

      const savedSettings = normalizeSettings(await response.json())
      storage.setItem(settingsKey, JSON.stringify(savedSettings))
      storage.removeItem(dirtyKey)
      return { settings: savedSettings, source: 'server' }
    },
  }
}