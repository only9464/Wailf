import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ThemeStorage, platformSelection } from '../../storage/theme'
import { PlatformProvider } from '../environment'
import { ThemeService, themeState } from '../index'
import { loadPlatformResource } from '../resources'
import type { ThemeDefinition } from '../types'

vi.mock('../resources', () => ({ loadPlatformResource: vi.fn(async () => ({ ok: true, diagnostics: [] })) }))

const custom: ThemeDefinition = {
  version: 1,
  id: 'custom',
  name: 'Custom',
  base: 'default',
  tokens: { 'color.canvas': '#102030' },
}
let memory: Storage
beforeEach(() => {
  const records = new Map<string, string>()
  memory = {
    get length() {
      return records.size
    },
    clear: () => records.clear(),
    getItem: (key) => records.get(key) ?? null,
    key: (index) => [...records.keys()][index] ?? null,
    removeItem: (key) => {
      records.delete(key)
    },
    setItem: (key, value) => {
      records.set(key, value)
    },
  }
  themeState.selection = platformSelection()
  themeState.customThemes = []
  themeState.diagnostics = []
  themeState.platform = 'unknown'
  document.documentElement.removeAttribute('style')
  vi.mocked(loadPlatformResource).mockResolvedValue({ ok: true, diagnostics: [] })
})
afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

describe('theme service startup and selection', () => {
  it('establishes a usable neutral root immediately, then applies a detected platform once', async () => {
    let done!: (value: unknown) => void
    const read = vi.fn(
      () =>
        new Promise((resolve) => {
          done = resolve
        }),
    )
    const service = new ThemeService(
      new ThemeStorage(() => memory),
      new PlatformProvider({ isRuntime: () => true, readEnvironment: read }),
    )
    const started = service.initialize()
    expect(document.documentElement.dataset.platform).toBe('unknown')
    expect(document.documentElement.dataset.themeBase).toBe('default')
    await Promise.resolve()
    done({ OS: 'windows' })
    expect((await started).source).toBe('platform')
    expect(document.documentElement.dataset.platform).toBe('windows')
    expect(document.documentElement.dataset.themeBase).toBe('platform')
    expect(service.initialize()).toBe(started)
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('never overwrites an explicit selection with a late startup probe', async () => {
    let done!: (value: unknown) => void
    const storage = new ThemeStorage(() => memory)
    storage.saveCustom(custom)
    const service = new ThemeService(
      storage,
      new PlatformProvider({
        isRuntime: () => true,
        readEnvironment: () =>
          new Promise((resolve) => {
            done = resolve
          }),
      }),
    )
    const initialized = service.initialize()
    await Promise.resolve()
    expect(await service.select(custom.id)).toBe(true)
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#102030')
    done({ OS: 'darwin' })
    await initialized
    expect(themeState.selection.customId).toBe(custom.id)
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#102030')
    expect(document.documentElement.dataset.platform).toBe('darwin')
    expect(themeState.platform).toBe('darwin')
    expect(document.documentElement.style.getPropertyValue('--wailf-titlebar-height')).toBe('50px')
  })
  it('retains custom tokens and platform hooks when the platform resource fails', async () => {
    const storage = new ThemeStorage(() => memory)
    storage.saveCustom(custom)
    storage.saveSelection({ version: 1, mode: 'custom', customId: custom.id })
    vi.mocked(loadPlatformResource).mockResolvedValue({ ok: false, diagnostics: ['theme.resource.failed'] })
    const result = await new ThemeService(
      storage,
      new PlatformProvider({ isRuntime: () => true, readEnvironment: async () => ({ OS: 'darwin' }) }),
    ).initialize()
    expect(result.source).toBe('fallback')
    expect(document.documentElement.dataset.platform).toBe('darwin')
    expect(document.documentElement.dataset.themeBase).toBe('default')
    expect(document.documentElement.style.getPropertyValue('--wailf-titlebar-height')).toBe('50px')
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#102030')
  })
  it('keeps the previous valid selection and reports failure when persistence is disabled', async () => {
    const storage = new ThemeStorage(() => memory)
    storage.saveCustom(custom)
    const service = new ThemeService(storage, new PlatformProvider({ hasDOM: () => false }))
    await service.initialize()
    await service.select(custom.id)
    vi.spyOn(memory, 'setItem').mockImplementation(() => {
      throw new Error('quota')
    })
    expect(await service.select(null)).toBe(false)
    expect(themeState.selection.customId).toBe(custom.id)
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#102030')
  })
  it('imports without switching and resets an active theme before removing its definition', async () => {
    const storage = new ThemeStorage(() => memory)
    const service = new ThemeService(storage, new PlatformProvider({ hasDOM: () => false }))
    await service.initialize()
    expect(
      (await service.import(JSON.stringify({ kind: 'wailf-theme-bundle', version: 1, themes: [custom] })))
        .committed,
    ).toBe(true)
    expect(themeState.selection.mode).toBe('platform')
    await service.select(custom.id)
    expect(await service.remove(custom.id)).toBe(true)
    expect(themeState.selection.mode).toBe('platform')
    expect(storage.loadCustom(custom.id)).toBeNull()
    expect(themeState.customThemes).toEqual([])
  })
  it('imports without touching browser globals during SSR', async () => {
    vi.stubGlobal('window', undefined)
    vi.stubGlobal('document', undefined)
    const module = await import('../index')
    expect(module.ThemeService).toBeDefined()
    const result = await new ThemeService(new ThemeStorage(() => null), new PlatformProvider()).initialize()
    expect(result.platform.id).toBe('unknown')
    expect(result.usedFallback).toBe(true)
  })
  it('restores the active pointer and retains its rendered theme when deletion fails', async () => {
    const storage = new ThemeStorage(() => memory)
    storage.saveCustom(custom)
    const service = new ThemeService(storage, new PlatformProvider({ hasDOM: () => false }))
    await service.initialize()
    await service.select(custom.id)
    const remove = memory.removeItem.bind(memory)
    vi.spyOn(memory, 'removeItem').mockImplementation(function (key: string) {
      if (key === 'wailf.ui.theme.custom.custom') throw new Error('denied')
      remove(key)
    })
    expect(await service.remove(custom.id)).toBe(false)
    expect(themeState.selection.customId).toBe(custom.id)
    expect(storage.loadSelection().customId).toBe(custom.id)
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#102030')
  })
})
