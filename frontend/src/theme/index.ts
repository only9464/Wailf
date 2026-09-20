import { reactive } from 'vue'
import { ThemeStorage, platformSelection } from '../storage/theme'
import { applyTheme } from './apply'
import { PlatformProvider } from './environment'
import { platforms } from './platform'
import { loadPlatformResource } from './resources'
import { resolveTheme } from './resolve'
import type { PlatformDescriptor, ThemeDefinition, ThemeInitResult, ThemeSelection } from './types'

export type * from './types'
export const themeState = reactive<{
  selection: ThemeSelection
  platform: string
  customThemes: ThemeDefinition[]
  diagnostics: string[]
}>({ selection: platformSelection(), platform: 'unknown', customThemes: [], diagnostics: [] })

export class ThemeService {
  private revision = 0
  private platform: PlatformDescriptor = platforms.unknown
  private platformAvailable = false
  private init: Promise<ThemeInitResult> | null = null
  private environmentFallback = false
  constructor(
    private storage = new ThemeStorage(),
    private provider = new PlatformProvider(),
  ) {}
  private report(codes: readonly string[]) {
    themeState.diagnostics = [...new Set([...themeState.diagnostics, ...codes, ...this.storage.diagnostics])]
  }
  private apply() {
    const selection = themeState.selection
    const custom = selection.customId ? this.storage.loadCustom(selection.customId) : null
    applyTheme(resolveTheme(this.platform, selection, custom, this.platformAvailable))
    themeState.platform = this.platform.id
  }
  private result(extraFallback = false): ThemeInitResult {
    const usedFallback =
      this.environmentFallback ||
      extraFallback ||
      this.storage.diagnostics.some((code) => !code.endsWith('.migrated'))
    return {
      platform: this.platform,
      usedFallback,
      diagnostics: [...themeState.diagnostics],
      source: usedFallback ? 'fallback' : themeState.selection.mode,
    }
  }
  initialize(): Promise<ThemeInitResult> {
    if (this.init) return this.init
    if (typeof document !== 'undefined') {
      document.documentElement.dataset.themeBase = 'default'
      document.documentElement.dataset.platform = 'unknown'
    }
    themeState.selection = this.storage.loadSelection()
    themeState.customThemes = this.storage.listCustom()
    this.report([])
    this.apply()
    this.init = this.provider
      .detect()
      .then(async (detection) => {
        this.platform = detection.platform
        this.environmentFallback = detection.usedFallback
        this.report(detection.diagnostics)
        // Re-resolve the current selection instead of replaying startup preferences.
        // Native chrome/safe-area hooks remain essential even if the user selected a theme during probing.
        this.apply()
        const revision = this.revision
        const resource = this.platform.resourceIds[0]
        if (resource) {
          const loaded = await loadPlatformResource(resource, () => revision === this.revision)
          if (revision !== this.revision) return this.result(true)
          this.platformAvailable = loaded.ok
          this.report(loaded.diagnostics)
        }
        this.apply()
        return this.result(!!resource && !this.platformAvailable)
      })
      .catch(() => {
        this.report(['theme.initialize.failed'])
        this.apply()
        return this.result(true)
      })
    return this.init
  }
  async applySelection(selection: ThemeSelection): Promise<ThemeInitResult> {
    if (!this.storage.saveSelection(selection)) {
      this.report(['theme.selection.failed'])
      return this.result(true)
    }
    const revision = ++this.revision
    themeState.selection = { ...selection }
    this.apply()
    const resource = this.platform.resourceIds[0]
    if (resource && !this.platformAvailable) {
      const loaded = await loadPlatformResource(resource, () => revision === this.revision)
      if (revision !== this.revision) return this.result(true)
      this.platformAvailable = loaded.ok
      this.report(loaded.diagnostics)
      this.apply()
    }
    return this.result(!!resource && !this.platformAvailable)
  }
  async select(customId: string | null): Promise<boolean> {
    const next: ThemeSelection =
      customId === null ? platformSelection() : { version: 1, mode: 'custom', customId }
    const previousRevision = this.revision
    await this.applySelection(next)
    return (
      this.revision > previousRevision &&
      themeState.selection.mode === next.mode &&
      themeState.selection.customId === next.customId
    )
  }
  async import(payload: string) {
    const result = this.storage.importThemes(payload)
    this.report(result.diagnostics)
    if (result.committed) themeState.customThemes = this.storage.listCustom()
    return result
  }
  export(): string | null {
    const result = this.storage.exportThemes()
    this.report(result.diagnostics)
    return result.payload
  }
  async remove(id: string): Promise<boolean> {
    const active = themeState.selection.customId === id
    const removed = this.storage.removeCustom(id)
    this.report([])
    if (removed) {
      if (active) {
        ++this.revision
        themeState.selection = platformSelection()
        this.apply()
      }
      themeState.customThemes = this.storage.listCustom()
    }
    return removed
  }
}

const service = new ThemeService()
export const initializeTheme = async (): Promise<void> => {
  await service.initialize()
}
export const selectTheme = (customId: string | null) => service.select(customId)
export const importThemes = (payload: string) => service.import(payload)
export const exportThemes = () => service.export()
export const removeTheme = (id: string) => service.remove(id)
