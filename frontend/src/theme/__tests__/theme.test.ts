import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  COMMIT_KEY,
  CUSTOM_PREFIX,
  STAGE_PREFIX,
  THEME_KEY,
  ThemeStorage,
  platformSelection,
  stagingDigest,
} from '../../storage/theme'
import { applyTheme } from '../apply'
import { PlatformProvider } from '../environment'
import { normalizeEnvironment, platforms } from '../platform'
import { resolveTheme } from '../resolve'
import { resourceManifest, resourceURL, validateResource } from '../resources'
import { serializeToken, validateTheme } from '../tokenRegistry'
import type { ThemeDefinition } from '../types'

class MemoryStorage implements Storage {
  values = new Map<string, string>()
  failWhen: ((key: string) => boolean) | null = null
  get length() {
    return this.values.size
  }
  clear() {
    this.values.clear()
  }
  getItem(key: string) {
    return this.values.get(key) ?? null
  }
  key(index: number) {
    return [...this.values.keys()][index] ?? null
  }
  removeItem(key: string) {
    this.values.delete(key)
  }
  setItem(key: string, value: string) {
    if (this.failWhen?.(key)) throw new Error('quota')
    this.values.set(key, value)
  }
}
const definition = (id = 'midnight'): ThemeDefinition => ({
  version: 1,
  id,
  name: 'Midnight',
  base: 'platform',
  tokens: { 'color.canvas': '#101624', 'layout.radius.md': '11px' },
})
const bundle = (...themes: unknown[]) => JSON.stringify({ kind: 'wailf-theme-bundle', version: 1, themes })

describe('theme schema and cascade', () => {
  it('keeps Windows material capability through custom default-base and resource fallback', () => {
    const custom = { ...definition(), base: 'default' as const }
    applyTheme(resolveTheme(platforms.windows, { version: 1, mode: 'custom', customId: custom.id }, custom, false))
    expect(document.documentElement.dataset.material).toBe('acrylic')
    expect(document.documentElement.dataset.rootBackground).toBe('transparent')
    expect(document.documentElement.style.getPropertyValue('--wailf-titlebar-height')).toBe('0px')
    applyTheme(resolveTheme(platforms.web, platformSelection(), null))
    expect(document.documentElement.dataset.material).toBe('none')
    expect(document.documentElement.dataset.rootBackground).toBe('opaque')
  })
  it('accepts partial tokens, preserves hooks with default base, and applies base/platform/user in order', () => {
    const custom = definition()
    const selection = { version: 1 as const, mode: 'custom' as const, customId: custom.id }
    const result = resolveTheme(platforms.darwin, selection, custom)
    expect(result.tokens['layout.radius.sm']).toBe('6px')
    expect(result.tokens['layout.radius.md']).toBe('11px')
    expect(result.tokens['color.text.primary']).toBe('#20242b')
    expect(resolveTheme(platforms.darwin, selection, { ...custom, base: 'default' }).hooks).toEqual(
      platforms.darwin.hooks,
    )
    expect(
      resolveTheme(platforms.darwin, selection, { ...custom, base: 'default' }).tokens['layout.radius.sm'],
    ).toBe('5px')
    expect(resolveTheme(platforms.windows, platformSelection(), null, false).base).toBe('default')
  })
  it.each([
    { tokens: { 'color.canvas': 'url(https://evil.test)' } },
    { tokens: { 'unknown-token': '#ffffff' } },
    { tokens: JSON.parse('{"__proto__":{"polluted":true}}') },
    { tokens: { 'layout.density': 10 } },
    { tokens: { 'layout.radius.md': '12px;display:none' } },
    { tokens: { 'effect.gradient.primary': 'linear-gradient(red, blue)' } },
    { tokens: { 'color.canvas': '#fff/*' } },
    { id: '../theme' },
    { id: 'Theme' },
    { id: 'constructor' },
    { name: '<script>bad</script>' },
    { name: 'x'.repeat(65) },
    { name: 'e\u0301' },
    { version: 2 },
  ])('rejects unsafe or unsupported definition %j', (override) => {
    expect(validateTheme({ ...definition(), ...override })).toBeNull()
  })
  it('validates structured gradients and strips unknown top-level properties', () => {
    const gradient = {
      kind: 'linear' as const,
      angle: 90,
      stops: [
        { color: '#fff', position: 0 },
        { color: '#000', position: 1 },
      ],
    }
    expect(serializeToken('effect.gradient.primary', gradient)).toBe(
      'linear-gradient(90deg, #fff 0%, #000 100%)',
    )
    expect(
      serializeToken('effect.gradient.primary', {
        ...gradient,
        stops: [
          { color: '#fff', position: 1 },
          { color: '#000', position: 0 },
        ],
      }),
    ).toBeNull()
    expect(validateTheme({ ...definition(), ignored: 'value' })).not.toHaveProperty('ignored')
  })
  it('rejects deeply nested or cyclic caller values without throwing', () => {
    let nested: Record<string, unknown> = {}
    for (let index = 0; index < 10000; index++) nested = { child: nested }
    expect(() => validateTheme({ ...definition(), extra: nested })).not.toThrow()
    const cyclic: Record<string, unknown> = {}
    cyclic.self = cyclic
    expect(validateTheme({ ...definition(), extra: cyclic })).toBeNull()
  })
  it('cleans old user tokens and keeps hooks when switching back to platform', () => {
    applyTheme(
      resolveTheme(
        platforms.darwin,
        { version: 1, mode: 'custom', customId: 'midnight' },
        definition(),
        false,
      ),
    )
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('#101624')
    expect(document.documentElement.style.getPropertyValue('--wailf-titlebar-height')).toBe('50px')
    expect(document.documentElement.dataset.themeBase).toBe('default')
    applyTheme(resolveTheme(platforms.darwin, platformSelection(), null, false))
    expect(document.documentElement.style.getPropertyValue('--wailf-color-canvas')).toBe('')
    expect(document.documentElement.style.getPropertyValue('--wailf-titlebar-height')).toBe('50px')
  })
})

describe('theme storage and atomic bundles', () => {
  let memory: MemoryStorage
  let storage: ThemeStorage
  beforeEach(() => {
    memory = new MemoryStorage()
    storage = new ThemeStorage(() => memory)
  })
  it('imports without changing selection and exports sorted definitions only', () => {
    memory.setItem(THEME_KEY, JSON.stringify(platformSelection()))
    expect(storage.importThemes(bundle(definition('z'), definition('a'))).committed).toBe(true)
    expect(storage.loadSelection()).toEqual(platformSelection())
    const exported = JSON.parse(storage.exportThemes().payload!)
    expect(exported.themes.map((theme: ThemeDefinition) => theme.id)).toEqual(['a', 'z'])
    expect(Object.keys(exported)).toEqual(['kind', 'version', 'themes'])
    expect([...memory.values.keys()].some((key) => key.startsWith(STAGE_PREFIX) || key === COMMIT_KEY)).toBe(
      false,
    )
    expect(
      new ThemeStorage(() => new MemoryStorage()).importThemes(storage.exportThemes().payload!).committed,
    ).toBe(true)
  })
  it('rejects duplicates, existing conflicts and mixed invalid batches before any new key is written', () => {
    storage.importThemes(bundle(definition('old')))
    const before = [...memory.values]
    expect(storage.importThemes(bundle(definition('old'), definition('new'))).conflictIds).toEqual(['old'])
    expect(storage.importThemes(bundle(definition('a'), definition('a'))).conflictIds).toEqual(['a'])
    expect(
      storage.importThemes(bundle(definition('new'), { ...definition('broken'), tokens: { x: 'red' } }))
        .rejectedIds,
    ).toEqual(['broken'])
    expect([...memory.values]).toEqual(before)
  })
  it('rejects oversized/unknown bundles while treating an empty v1 array as a no-op', () => {
    expect(storage.importThemes(bundle()).committed).toBe(true)
    expect(
      storage.importThemes(JSON.stringify({ kind: 'wailf-theme-bundle', version: 2, themes: [] }))
        .diagnostics,
    ).toContain('theme.bundle.unsupported')
    expect(
      storage.importThemes(bundle(...Array.from({ length: 33 }, (_, i) => definition(`t${i}`)))).committed,
    ).toBe(false)
    expect(storage.importThemes(' '.repeat(2097153)).committed).toBe(false)
  })
  it('rolls back all new formal keys on a mid-promotion write failure and retains previous selection', () => {
    storage.importThemes(bundle(definition('old')))
    storage.saveSelection({ version: 1, mode: 'custom', customId: 'old' })
    const before = [...memory.values]
    memory.failWhen = (key) => key === `${CUSTOM_PREFIX}second`
    const result = storage.importThemes(bundle(definition('first'), definition('second')))
    expect(result.committed).toBe(false)
    expect(result.usedFallback).toBe(true)
    expect([...memory.values]).toEqual(before)
    expect(storage.loadSelection().customId).toBe('old')
  })
  it('recovers a marker after a partial promotion; discards abandoned pre-commit staging', () => {
    const first = JSON.stringify(definition('first'))
    const second = JSON.stringify(definition('second'))
    memory.setItem(`${STAGE_PREFIX}batch.first`, first)
    memory.setItem(`${STAGE_PREFIX}batch.second`, second)
    memory.setItem(
      COMMIT_KEY,
      JSON.stringify({
        version: 1,
        nonce: 'batch',
        ids: ['first', 'second'],
        digests: { first: stagingDigest(first), second: stagingDigest(second) },
      }),
    )
    memory.setItem(`${CUSTOM_PREFIX}first`, first)
    expect(storage.recover()).toBe(true)
    expect(storage.listCustom()).toHaveLength(2)
    expect(memory.getItem(COMMIT_KEY)).toBeNull()
    memory.setItem(`${STAGE_PREFIX}abandoned.third`, JSON.stringify(definition('third')))
    expect(storage.recover()).toBe(true)
    expect(storage.loadCustom('third')).toBeNull()
    expect(memory.getItem(`${STAGE_PREFIX}abandoned.third`)).toBeNull()
  })
  it('cleans an invalid staged batch and its own promoted keys without touching older definitions', () => {
    storage.importThemes(bundle(definition('old')))
    const first = JSON.stringify(definition('first'))
    memory.setItem(`${STAGE_PREFIX}batch.first`, first)
    memory.setItem(`${CUSTOM_PREFIX}first`, first)
    memory.setItem(`${STAGE_PREFIX}batch.second`, 'corrupted')
    memory.setItem(
      COMMIT_KEY,
      JSON.stringify({
        version: 1,
        nonce: 'batch',
        ids: ['first', 'second'],
        digests: { first: stagingDigest(first), second: '00000000' },
      }),
    )
    expect(storage.recover()).toBe(false)
    expect(storage.listCustom().map((theme) => theme.id)).toEqual(['old'])
  })
  it.each(['light', 'dark'])('migrates legacy %s once and handles missing definitions', (mode) => {
    memory.setItem(THEME_KEY, mode)
    expect(storage.loadSelection().customId).toBe(`legacy-${mode}`)
    expect(storage.loadCustom(`legacy-${mode}`)?.tokens['accessibility.color-scheme']).toBe(mode)
    const count = memory.length
    expect(storage.loadSelection().customId).toBe(`legacy-${mode}`)
    expect(memory.length).toBe(count)
    memory.setItem(THEME_KEY, JSON.stringify({ version: 1, mode: 'custom', customId: 'missing' }))
    expect(storage.loadSelection()).toEqual(platformSelection())
  })
  it('survives damaged JSON, unavailable storage and writes failing after a valid selection', () => {
    memory.setItem(THEME_KEY, '{broken')
    expect(storage.loadSelection()).toEqual(platformSelection())
    expect(new ThemeStorage(() => null).loadSelection()).toEqual(platformSelection())
    expect(
      new ThemeStorage(() => {
        throw new Error('privacy')
      }).exportThemes().payload,
    ).toBeNull()
    storage.importThemes(bundle(definition()))
    storage.saveSelection({ version: 1, mode: 'custom', customId: 'midnight' })
    memory.failWhen = (key) => key === THEME_KEY
    expect(storage.saveSelection(platformSelection())).toBe(false)
    expect(storage.loadSelection().customId).toBe('midnight')
  })
})

describe('platform provider', () => {
  afterEach(() => vi.useRealTimers())
  it.each(['windows', 'darwin', 'linux', 'android', 'ios'] as const)(
    'maps %s with complete descriptors',
    (id) => {
      expect(normalizeEnvironment({ OS: id }).id).toBe(id)
      expect(normalizeEnvironment({ OSInfo: { ID: id } }).tokenSetId).toBe(`platform.${id}`)
      expect(normalizeEnvironment({ OS: id }).resourceIds).toHaveLength(1)
    },
  )
  it('maps server hosts to web, unknown OS to neutral, and strips control characters from raw diagnostics', () => {
    expect(normalizeEnvironment({ OS: 'windows', PlatformInfo: { mode: 'server' } }).runtimeMode).toBe(
      'server',
    )
    expect(normalizeEnvironment({ OS: 'alien' }).id).toBe('unknown')
    expect(normalizeEnvironment({ OS: '\u0000' + 'a'.repeat(50) }).rawOS).toHaveLength(32)
  })
  it('calls a native environment probe once despite a readiness event, and ignores late resolution after timeout', async () => {
    vi.useFakeTimers()
    let resolve!: (value: unknown) => void
    const read = vi.fn(
      () =>
        new Promise((done) => {
          resolve = done
        }),
    )
    const provider = new PlatformProvider({ isRuntime: () => true, readEnvironment: read })
    const result = provider.detect()
    expect(provider.detect()).toBe(result)
    window.dispatchEvent(new Event('wails:runtime-config-ready'))
    await vi.advanceTimersByTimeAsync(500)
    expect((await result).diagnostics).toContain('theme.environment.timeout')
    resolve({ OS: 'windows' })
    expect((await provider.detect()).platform.id).toBe('unknown')
    expect(read).toHaveBeenCalledTimes(1)
  })
  it('uses a readiness event to start one unready probe and handles bridge rejection', async () => {
    vi.useFakeTimers()
    let ready = false
    const read = vi.fn(async () => ({ OS: 'windows' }))
    const provider = new PlatformProvider({ isRuntime: () => ready, readEnvironment: read })
    const result = provider.detect()
    ready = true
    window.dispatchEvent(new Event('wails:runtime-config-ready'))
    expect((await result).platform.id).toBe('windows')
    expect(read).toHaveBeenCalledTimes(1)
    expect(
      (
        await new PlatformProvider({
          isRuntime: () => true,
          readEnvironment: async () => {
            throw new Error('bridge')
          },
        }).detect()
      ).usedFallback,
    ).toBe(true)
  })
  it('never invokes runtime in browser or SSR mode', async () => {
    vi.useFakeTimers()
    const read = vi.fn()
    const browser = new PlatformProvider({ isRuntime: () => false, readEnvironment: read }).detect()
    await vi.advanceTimersByTimeAsync(500)
    expect((await browser).platform.id).toBe('web')
    expect(
      (await new PlatformProvider({ hasDOM: () => false, readEnvironment: read }).detect()).platform.id,
    ).toBe('unknown')
    expect(read).not.toHaveBeenCalled()
  })
})

describe('bundled platform resources', () => {
  afterEach(() => vi.useRealTimers())
  it('resolves only allowlisted resources on the same origin', () => {
    for (const id of Object.keys(resourceManifest))
      expect(resourceURL(id as keyof typeof resourceManifest, 'http://localhost:5173/app/')).not.toBeNull()
    expect(resourceURL('../windows.css' as never, 'http://localhost:5173/')).toBeNull()
    expect(resourceURL('https://remote.test/a.css' as never, 'http://localhost:5173/')).toBeNull()
  })
  it('accepts valid bundled CSS and rejects response, MIME, size, redirects and CSS imports', async () => {
    const fetcher = (body: string, init: ResponseInit = { headers: { 'content-type': 'text/css' } }) =>
      vi.fn(async () => new Response(body, init)) as unknown as typeof fetch
    expect(
      (
        await validateResource(
          'platform.windows',
          fetcher('html[data-theme-base="platform"] { --wailf-layout-density: 1; }'),
          'http://localhost/',
        )
      ).ok,
    ).toBe(true)
    for (const fake of [
      fetcher('', { status: 404 }),
      fetcher('<html>', { headers: { 'content-type': 'text/html' } }),
      fetcher('x'.repeat(8193)),
      fetcher('@import "https://evil.test/theme.css";'),
    ]) {
      expect((await validateResource('platform.windows', fake, 'http://localhost/')).ok).toBe(false)
    }
    const redirected = new Response('', { headers: { 'content-type': 'text/css' } })
    Object.defineProperty(redirected, 'url', { value: 'https://evil.test/windows.css' })
    expect(
      (
        await validateResource(
          'platform.windows',
          vi.fn(async () => redirected) as typeof fetch,
          'http://localhost/',
        )
      ).ok,
    ).toBe(false)
  })
  it('bounds network hangs with an independent timeout', async () => {
    vi.useFakeTimers()
    const result = validateResource(
      'platform.windows',
      vi.fn(() => new Promise(() => {})) as typeof fetch,
      'http://localhost/',
    )
    await vi.advanceTimersByTimeAsync(500)
    expect((await result).diagnostics).toEqual(['theme.resource.timeout'])
  })
})
