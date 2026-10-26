export const ADMIN_SESSION_KEY = 'homepiboard-admin-session'
export const LEGACY_PIN_KEY = 'homepiboard-admin-pin'
export const DEFAULT_SESSION_DURATION_MS = 60 * 60 * 1000 // 60 Minuten

export interface AdminSessionData {
  pin: string
  expiresAt: number
}

export type SessionStorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

export function getStoredAdminPin(
  storage: SessionStorageAdapter = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
  touch = false,
  now = Date.now(),
): string | null {
  try {
    const raw = storage.getItem(ADMIN_SESSION_KEY)
    if (!raw) {
      if (typeof sessionStorage !== 'undefined') {
        const legacy = sessionStorage.getItem(LEGACY_PIN_KEY)
        if (legacy) {
          setStoredAdminPin(legacy, DEFAULT_SESSION_DURATION_MS, storage, now)
          return legacy
        }
      }
      return null
    }

    const data: AdminSessionData = JSON.parse(raw)
    if (typeof data.pin !== 'string' || typeof data.expiresAt !== 'number') {
      storage.removeItem(ADMIN_SESSION_KEY)
      return null
    }

    if (now > data.expiresAt) {
      storage.removeItem(ADMIN_SESSION_KEY)
      return null
    }

    if (touch) {
      data.expiresAt = now + DEFAULT_SESSION_DURATION_MS
      storage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data))
    }

    return data.pin
  } catch {
    try {
      storage.removeItem(ADMIN_SESSION_KEY)
    } catch {}
    return null
  }
}

export function setStoredAdminPin(
  pin: string,
  durationMs = DEFAULT_SESSION_DURATION_MS,
  storage: SessionStorageAdapter = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
  now = Date.now(),
): void {
  const data: AdminSessionData = {
    pin,
    expiresAt: now + durationMs,
  }
  try {
    storage.setItem(ADMIN_SESSION_KEY, JSON.stringify(data))
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.setItem(LEGACY_PIN_KEY, pin)
    }
  } catch {}
}

export function clearStoredAdminPin(
  storage: SessionStorageAdapter = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
): void {
  try {
    storage.removeItem(ADMIN_SESSION_KEY)
    if (typeof sessionStorage !== 'undefined') {
      sessionStorage.removeItem(LEGACY_PIN_KEY)
    }
  } catch {}
}

export function getSessionRemainingMinutes(
  storage: SessionStorageAdapter = typeof localStorage !== 'undefined' ? localStorage : ({} as Storage),
  now = Date.now(),
): number {
  try {
    const raw = storage.getItem(ADMIN_SESSION_KEY)
    if (!raw) return 0
    const data: AdminSessionData = JSON.parse(raw)
    const remainingMs = data.expiresAt - now
    return remainingMs > 0 ? Math.ceil(remainingMs / (60 * 1000)) : 0
  } catch {
    return 0
  }
}
