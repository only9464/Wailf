/** All browser preference persistence passes through this module. */
export function getStorage(): Storage | null {
  try {
    return typeof window === 'undefined' ? null : window.localStorage
  } catch {
    return null
  }
}

export function readJson<T>(key: string, fallback: T): T {
  try {
    const value = getStorage()?.getItem(key)
    return value === null || value === undefined ? fallback : (JSON.parse(value) as T)
  } catch {
    console.warn(`[storage] Unable to read ${key}; using defaults.`)
    return fallback
  }
}

export function listKeys(prefix: string): string[] {
  try {
    const storage = getStorage()
    if (!storage) return []
    return Array.from({ length: storage.length }, (_, index) => storage.key(index)).filter(
      (key): key is string => key !== null && key.startsWith(prefix),
    )
  } catch {
    console.warn('[storage] Unable to enumerate preferences.')
    return []
  }
}

/** Commit related preferences together, restoring their old values if a write fails. */
export function transactStorage(entries: Record<string, string | null>): boolean {
  const storage = getStorage()
  if (!storage) return false
  const previous: Record<string, string | null> = {}
  const changed: string[] = []
  try {
    for (const key of Object.keys(entries)) previous[key] = storage.getItem(key)
    for (const [key, value] of Object.entries(entries)) {
      if (value === null) storage.removeItem(key)
      else storage.setItem(key, value)
      changed.push(key)
    }
    return true
  } catch {
    for (const key of changed.reverse()) {
      try {
        const value = previous[key]
        if (value === null) storage.removeItem(key)
        else storage.setItem(key, value)
      } catch {
        console.warn(`[storage] Unable to restore ${key}.`)
      }
    }
    console.warn('[storage] Preference write failed; previous state retained.')
    return false
  }
}

export function writeJson(key: string, value: unknown): boolean {
  try {
    return transactStorage({ [key]: JSON.stringify(value) })
  } catch {
    return false
  }
}

export function removeStored(key: string): boolean {
  return transactStorage({ [key]: null })
}
