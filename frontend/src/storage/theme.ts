import { getStorage } from './browser'
import { byteLength, darkTokens, isRecord, lightTokens, validId, validateTheme } from '../theme/tokenRegistry'
import type { ThemeDefinition, ThemeExportResult, ThemeImportResult, ThemeSelection } from '../theme/types'

export const THEME_KEY = 'wailf.ui.theme'
export const CUSTOM_PREFIX = `${THEME_KEY}.custom.`
export const STAGE_PREFIX = `${THEME_KEY}.stage.`
export const COMMIT_KEY = `${THEME_KEY}.commit`
export const platformSelection = (): ThemeSelection => ({ version: 1, mode: 'platform', customId: null })
interface CommitMarker {
  version: 1
  nonce: string
  ids: string[]
  digests: Record<string, string>
}
// Integrity checksum detects an incomplete or altered local staging record, not an authenticity signature.
export function stagingDigest(value: string): string {
  let hash = 2166136261
  for (const byte of new TextEncoder().encode(value)) {
    hash ^= byte
    hash = Math.imul(hash, 16777619)
  }
  return (hash >>> 0).toString(16).padStart(8, '0')
}
function keys(storage: Storage, prefix: string): string[] {
  const result: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith(prefix)) result.push(key)
  }
  return result
}
function parse(value: string | null): unknown {
  try {
    return value === null ? null : JSON.parse(value)
  } catch {
    return null
  }
}
function validMarker(input: unknown): input is CommitMarker {
  return (
    isRecord(input) &&
    input.version === 1 &&
    typeof input.nonce === 'string' &&
    /^[a-z0-9-]{1,64}$/.test(input.nonce) &&
    Array.isArray(input.ids) &&
    input.ids.length <= 32 &&
    input.ids.every(validId) &&
    new Set(input.ids).size === input.ids.length &&
    isRecord(input.digests) &&
    input.ids.every((id) => /^[0-9a-f]{8}$/.test(String((input.digests as Record<string, unknown>)[id])))
  )
}
const emptyImport = (): ThemeImportResult => ({
  acceptedIds: [],
  rejectedIds: [],
  conflictIds: [],
  committed: false,
  usedFallback: false,
  diagnostics: [],
})

/** All direct browser storage access for themes is contained in this GUI storage adapter. */
export class ThemeStorage {
  readonly diagnostics: string[] = []
  private selection = platformSelection()
  constructor(private provider: () => Storage | null = getStorage) {}
  private diagnostic(code: string) {
    if (!this.diagnostics.includes(code)) this.diagnostics.push(code)
  }
  private available(): Storage | null {
    try {
      const storage = this.provider()
      if (!storage) this.diagnostic('theme.storage.unavailable')
      return storage
    } catch {
      this.diagnostic('theme.storage.unavailable')
      return null
    }
  }
  private cleanup(storage: Storage) {
    keys(storage, STAGE_PREFIX).forEach((key) => storage.removeItem(key))
    if (storage.getItem(COMMIT_KEY) !== null) storage.removeItem(COMMIT_KEY)
  }
  private rollback(storage: Storage, marker: CommitMarker): boolean {
    try {
      for (const id of marker.ids) {
        const raw = storage.getItem(`${CUSTOM_PREFIX}${id}`)
        // Only remove a definition provably written by this import.
        if (raw !== null && stagingDigest(raw) === marker.digests[id])
          storage.removeItem(`${CUSTOM_PREFIX}${id}`)
      }
      this.cleanup(storage)
      return true
    } catch {
      this.diagnostic('theme.storage.recovery_failed')
      return false
    }
  }
  recover(): boolean {
    const storage = this.available()
    if (!storage) return false
    let marker: CommitMarker | null = null
    try {
      const markerRaw = storage.getItem(COMMIT_KEY)
      if (markerRaw === null) {
        this.cleanup(storage)
        return true
      }
      const input = parse(markerRaw)
      if (!validMarker(input)) {
        this.cleanup(storage)
        this.diagnostic('theme.storage.invalid_marker')
        return true
      }
      marker = input
      const records = marker.ids.map((id) => {
        const raw = storage.getItem(`${STAGE_PREFIX}${marker!.nonce}.${id}`)
        const definition = validateTheme(parse(raw))
        const existing = storage.getItem(`${CUSTOM_PREFIX}${id}`)
        if (
          !raw ||
          !definition ||
          definition.id !== id ||
          stagingDigest(raw) !== marker!.digests[id] ||
          (existing !== null && existing !== raw)
        )
          throw new Error('invalid staging')
        return { id, raw }
      })
      records.forEach(({ id, raw }) => storage.setItem(`${CUSTOM_PREFIX}${id}`, raw))
      this.cleanup(storage)
      return true
    } catch {
      this.diagnostic('theme.storage.recovery_failed')
      if (marker) this.rollback(storage, marker)
      return false
    }
  }
  loadCustom(id: string): ThemeDefinition | null {
    if (!validId(id)) return null
    const storage = this.available()
    if (!storage) return null
    try {
      const raw = storage.getItem(`${CUSTOM_PREFIX}${id}`)
      const theme = validateTheme(parse(raw))
      if (!theme || theme.id !== id) {
        if (raw !== null) this.diagnostic('theme.storage.invalid_definition')
        return null
      }
      return theme
    } catch {
      this.diagnostic('theme.storage.read_failed')
      return null
    }
  }
  listCustom(): ThemeDefinition[] {
    const storage = this.available()
    if (!storage) return []
    try {
      return keys(storage, CUSTOM_PREFIX)
        .sort()
        .map((key) => this.loadCustom(key.slice(CUSTOM_PREFIX.length)))
        .filter((theme): theme is ThemeDefinition => theme !== null)
    } catch {
      this.diagnostic('theme.storage.read_failed')
      return []
    }
  }
  loadSelection(): ThemeSelection {
    this.recover()
    const storage = this.available()
    if (!storage) return this.selection
    try {
      const raw = storage.getItem(THEME_KEY)
      const input = parse(raw)
      const legacy = typeof input === 'string' ? input : raw
      if (legacy === 'light' || legacy === 'dark') {
        const definition: ThemeDefinition = {
          version: 1,
          id: `legacy-${legacy}`,
          name: legacy === 'light' ? 'Light' : 'Dark',
          base: 'default',
          tokens: legacy === 'light' ? lightTokens : darkTokens,
        }
        if (storage.getItem(`${CUSTOM_PREFIX}${definition.id}`) === null)
          storage.setItem(`${CUSTOM_PREFIX}${definition.id}`, JSON.stringify(definition))
        const migrated: ThemeSelection = { version: 1, mode: 'custom', customId: definition.id }
        if (this.loadCustom(definition.id)) {
          storage.setItem(THEME_KEY, JSON.stringify(migrated))
          this.selection = migrated
          this.diagnostic('theme.storage.migrated')
        }
        return this.selection
      }
      if (isRecord(input) && input.version === 1 && input.mode === 'platform' && input.customId === null)
        this.selection = platformSelection()
      else if (
        isRecord(input) &&
        input.version === 1 &&
        input.mode === 'custom' &&
        validId(input.customId) &&
        this.loadCustom(input.customId)
      )
        this.selection = { version: 1, mode: 'custom', customId: input.customId }
      else if (raw !== null) {
        const fallback = platformSelection()
        this.diagnostic('theme.storage.invalid_selection')
        // A one-time migration for damaged/unsupported pointers; custom definitions are untouched.
        storage.setItem(THEME_KEY, JSON.stringify(fallback))
        this.selection = fallback
      }
      return this.selection
    } catch {
      this.diagnostic('theme.storage.read_failed')
      return this.selection
    }
  }
  saveSelection(selection: ThemeSelection): boolean {
    const valid =
      selection.version === 1 &&
      ((selection.mode === 'platform' && selection.customId === null) ||
        (selection.mode === 'custom' && selection.customId !== null && !!this.loadCustom(selection.customId)))
    if (!valid) return false
    const storage = this.available()
    if (!storage) return false
    try {
      storage.setItem(THEME_KEY, JSON.stringify(selection))
      this.selection = { ...selection }
      return true
    } catch {
      this.diagnostic('theme.storage.write_failed')
      return false
    }
  }
  saveCustom(theme: ThemeDefinition): boolean {
    const definition = validateTheme(theme)
    if (!definition) return false
    const storage = this.available()
    if (!storage) return false
    try {
      storage.setItem(`${CUSTOM_PREFIX}${definition.id}`, JSON.stringify(definition))
      return true
    } catch {
      this.diagnostic('theme.storage.write_failed')
      return false
    }
  }
  removeCustom(id: string): boolean {
    if (!validId(id)) return false
    const storage = this.available()
    if (!storage) return false
    const previous = { ...this.selection }
    const active = this.selection.customId === id
    if (active && !this.saveSelection(platformSelection())) return false
    try {
      storage.removeItem(`${CUSTOM_PREFIX}${id}`)
      return true
    } catch {
      if (active && !this.saveSelection(previous)) this.selection = previous
      this.diagnostic('theme.storage.write_failed')
      return false
    }
  }
  exportThemes(): ThemeExportResult {
    const storage = this.available()
    if (!storage || !this.recover())
      return { payload: null, usedFallback: true, diagnostics: ['theme.storage.read_failed'] }
    try {
      const themes: ThemeDefinition[] = []
      for (const key of keys(storage, CUSTOM_PREFIX).sort()) {
        const definition = validateTheme(parse(storage.getItem(key)))
        if (definition && definition.id === key.slice(CUSTOM_PREFIX.length)) themes.push(definition)
      }
      return {
        payload: JSON.stringify({ kind: 'wailf-theme-bundle', version: 1, themes }, null, 2),
        usedFallback: false,
        diagnostics: [],
      }
    } catch {
      return { payload: null, usedFallback: true, diagnostics: ['theme.storage.read_failed'] }
    }
  }
  importThemes(payload: string): ThemeImportResult {
    const result = emptyImport()
    if (byteLength(payload) > 2097152) {
      result.diagnostics.push('theme.bundle.too_large')
      return result
    }
    const input = parse(payload)
    if (!isRecord(input) || input.kind !== 'wailf-theme-bundle' || input.version !== 1) {
      result.diagnostics.push('theme.bundle.unsupported')
      return result
    }
    if (!Array.isArray(input.themes) || input.themes.length > 32) {
      result.diagnostics.push('theme.bundle.invalid_shape')
      return result
    }
    const definitions: ThemeDefinition[] = []
    const ids = new Set<string>()
    let tokenCount = 0
    for (const entry of input.themes) {
      const id = isRecord(entry) && validId(entry.id) ? entry.id : null
      if (id && ids.has(id)) result.conflictIds.push(id)
      if (id) ids.add(id)
      const theme = validateTheme(entry)
      if (!theme) {
        if (id) result.rejectedIds.push(id)
        result.diagnostics.push('theme.bundle.invalid_definition')
      } else {
        definitions.push(theme)
        tokenCount += Object.keys(theme.tokens).length
      }
    }
    if (tokenCount > 4096) result.diagnostics.push('theme.bundle.too_large')
    if (result.conflictIds.length) result.diagnostics.push('theme.bundle.conflict')
    if (result.diagnostics.length) return result
    if (!definitions.length) return { ...result, committed: true }
    const storage = this.available()
    if (!storage || !this.recover())
      return { ...result, usedFallback: true, diagnostics: ['theme.storage.unavailable'] }
    const marker: CommitMarker = {
      version: 1,
      nonce: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
      ids: definitions.map((theme) => theme.id),
      digests: {},
    }
    let committedMarker = false
    try {
      for (const id of marker.ids)
        if (storage.getItem(`${CUSTOM_PREFIX}${id}`) !== null) result.conflictIds.push(id)
      if (result.conflictIds.length) {
        result.diagnostics.push('theme.bundle.conflict')
        return result
      }
      for (const theme of definitions) {
        const raw = JSON.stringify(theme)
        marker.digests[theme.id] = stagingDigest(raw)
        storage.setItem(`${STAGE_PREFIX}${marker.nonce}.${theme.id}`, raw)
      }
      storage.setItem(COMMIT_KEY, JSON.stringify(marker))
      committedMarker = true
      for (const theme of definitions) storage.setItem(`${CUSTOM_PREFIX}${theme.id}`, JSON.stringify(theme))
      this.cleanup(storage)
      return { ...result, acceptedIds: marker.ids, committed: true }
    } catch {
      if (committedMarker) this.rollback(storage, marker)
      else {
        try {
          this.cleanup(storage)
        } catch {
          this.diagnostic('theme.storage.recovery_failed')
        }
      }
      return { ...result, usedFallback: true, diagnostics: ['theme.storage.write_failed'] }
    }
  }
}
