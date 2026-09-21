import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { defaultLayout, features } from '../features/registry'
import zh from '../i18n/zh-CN/zh-CN.json'
import en from '../i18n/en-US/en-US.json'
import { useLayoutStore } from '../stores/layout'
import { usePreferenceStore } from '../stores/preferences'
import { ACTIVE_LAYOUT_KEY, LAYOUT_PREFIX, cloneLayout, loadLayouts, validateLayout } from './layout'
import { readJson, transactStorage } from './browser'

class MemoryStorage implements Storage {
  private values = new Map<string, string>()
  failOnKey: string | null = null
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
    if (this.failOnKey === key) throw new Error('QuotaExceededError')
    this.values.set(key, String(value))
  }
}

let storage: MemoryStorage
beforeEach(() => {
  storage = new MemoryStorage()
  vi.stubGlobal('window', { localStorage: storage })
  setActivePinia(createPinia())
})

describe('feature registry and layout schema', () => {
  it('matches the accepted 12 groups and 52 unique routes without metadata grouping', () => {
    expect(defaultLayout.groups).toHaveLength(12)
    expect(features).toHaveLength(52)
    expect(new Set(features.map((feature) => feature.id)).size).toBe(52)
    expect(new Set(features.map((feature) => feature.route)).size).toBe(52)
    expect(features.every((feature) => !('group' in feature))).toBe(true)
    expect(defaultLayout.groups.flatMap((group) => group.items).sort()).toEqual(
      features.map((feature) => feature.id).sort(),
    )
    expect(validateLayout(defaultLayout)).toEqual({ ok: true, layout: defaultLayout })
  })

  it('has matching Chinese and English feature keys and descriptive planned pages', () => {
    expect(Object.keys(zh.nav.group).sort()).toEqual(Object.keys(en.nav.group).sort())
    expect(Object.keys(zh.screen).sort()).toEqual(Object.keys(en.screen).sort())
    for (const feature of features) {
      const chinese = zh.screen[feature.id as keyof typeof zh.screen]
      const english = en.screen[feature.id as keyof typeof en.screen]
      expect(chinese.title.length).toBeGreaterThan(0)
      expect(english.title.length).toBeGreaterThan(0)
      expect(chinese.description.length).toBeGreaterThan(0)
      expect(english.description.length).toBeGreaterThan(0)
    }
  })

  it('retains unknown and omitted features under unassigned, including hidden unknowns', () => {
    const layout = cloneLayout(defaultLayout)
    layout.groups[0].items.push('future-scanner')
    layout.groups[0].items = layout.groups[0].items.filter((item) => item !== 'portscan')
    layout.hidden = ['future-hidden']
    const result = validateLayout(layout)
    expect(result.ok).toBe(true)
    if (!result.ok) return
    expect(result.layout.groups.find((group) => group.id === 'unassigned')?.items).toEqual([
      'future-scanner',
      'portscan',
      'future-hidden',
    ])
    expect(result.layout.hidden).toEqual(['future-hidden'])
    expect(validateLayout(JSON.stringify(result.layout))).toEqual(result)
  })

  it('rejects duplicate groups, repeated feature placements and duplicate hidden ids', () => {
    const groups = cloneLayout(defaultLayout)
    groups.groups.push(cloneLayout(defaultLayout).groups[0])
    expect(validateLayout(groups)).toEqual({ ok: false, error: 'duplicate' })
    const repeated = cloneLayout(defaultLayout)
    repeated.groups[1].items.push('portscan')
    expect(validateLayout(repeated)).toEqual({ ok: false, error: 'duplicate' })
    repeated.groups[1].items.pop()
    repeated.hidden = ['portscan', 'portscan']
    expect(validateLayout(repeated)).toEqual({ ok: false, error: 'duplicate' })
  })

  it('rejects future and undocumented legacy versions without guessing a migration', () => {
    expect(validateLayout({ ...defaultLayout, version: 2 })).toEqual({ ok: false, error: 'version' })
    expect(validateLayout({ ...defaultLayout, version: 0 })).toEqual({ ok: false, error: 'version' })
    expect(validateLayout('{bad json')).toEqual({ ok: false, error: 'invalid' })
    expect(validateLayout({ ...defaultLayout, layoutId: 'active' })).toEqual({ ok: false, error: 'invalid' })
  })

  it('accepts the documentation v1 example with no hidden field', () => {
    const { hidden: _, ...example } = defaultLayout
    const result = validateLayout(example)
    expect(result.ok && result.layout.hidden).toEqual([])
  })
})

describe('layout persistence and editing', () => {
  it('recovers from corrupt records and missing active layouts', () => {
    storage.setItem(`${LAYOUT_PREFIX}broken`, '{')
    storage.setItem(ACTIVE_LAYOUT_KEY, JSON.stringify('missing'))
    expect(loadLayouts()).toEqual({ layouts: [defaultLayout], activeId: 'default' })
    expect(storage.getItem(`${LAYOUT_PREFIX}broken`)).toBe('{')
  })

  it('supports groups, item movement, hiding, named layouts and restoration', () => {
    const store = useLayoutStore()
    expect(store.addGroup('My workflow')).toBe(true)
    const custom = store.active.groups.find((group) => group.name === 'nav.group.custom')!
    expect(store.moveItem('portscan', custom.id)).toBe(true)
    expect(store.setHidden('portscan', true)).toBe(true)
    expect(store.renameGroup(custom.id, 'Daily workflow')).toBe(true)
    expect(store.active.customNames?.[custom.id]).toBe('Daily workflow')
    expect(store.removeGroup(custom.id)).toBe(true)
    expect(store.unassigned).toContain('portscan')
    expect(store.createLayout('Alternate')).toBe(true)
    const alternateId = store.activeId
    expect(store.layouts).toHaveLength(2)
    expect(store.restoreDefault()).toBe(true)
    expect(store.active.groups).toEqual(defaultLayout.groups)
    expect(store.active.hidden).toEqual([])
    expect(store.active.customNames?.$layout).toBe('Alternate')
    expect(store.setActive('default')).toBe(true)
    expect(store.removeLayout(alternateId)).toBe(true)
    expect(store.removeLayout('default')).toBe(false)
    expect(store.lastError).toBe('lastLayout')
  })

  it('round-trips imported unknown ids and never overwrites an existing layout', () => {
    const store = useLayoutStore()
    const input = cloneLayout(defaultLayout)
    input.groups[0].items.push('future-tool')
    expect(store.importLayout(JSON.stringify(input))).toBe(true)
    expect(store.activeId).not.toBe('default')
    expect(store.layouts.find((layout) => layout.layoutId === 'default')).toEqual(defaultLayout)
    expect(store.unassigned).toContain('future-tool')
    expect(validateLayout(store.exportLayout())).toEqual({ ok: true, layout: store.active })
    const exported = store.exportLayout()
    expect(store.importLayout({ version: 3 })).toBe(false)
    expect(store.exportLayout()).toBe(exported)
  })

  it('retains previous memory and persisted values when an import commit fails midway', () => {
    const store = useLayoutStore()
    expect(store.renameLayout('default', 'Original')).toBe(true)
    const before = store.exportLayout()
    const beforeKeys = Array.from({ length: storage.length }, (_, index) => storage.key(index))
    storage.failOnKey = ACTIVE_LAYOUT_KEY
    expect(store.importLayout(defaultLayout)).toBe(false)
    expect(store.lastError).toBe('storage')
    expect(store.exportLayout()).toBe(before)
    expect(store.layouts).toHaveLength(1)
    expect(Array.from({ length: storage.length }, (_, index) => storage.key(index))).toEqual(beforeKeys)
  })

  it('keeps deleted default layouts deleted after reload', () => {
    const store = useLayoutStore()
    store.createLayout('Only layout')
    const activeId = store.activeId
    expect(store.removeLayout('default')).toBe(true)
    expect(loadLayouts().layouts.map((layout) => layout.layoutId)).toEqual([activeId])
  })

  it('reads defaults when storage access is unavailable', () => {
    vi.stubGlobal(
      'window',
      Object.defineProperty({}, 'localStorage', {
        get() {
          throw new Error('SecurityError')
        },
      }),
    )
    expect(readJson('preference', 'default')).toBe('default')
    expect(loadLayouts()).toEqual({ layouts: [defaultLayout], activeId: 'default' })
    const store = useLayoutStore()
    expect(store.addGroup('Blocked')).toBe(false)
    expect(store.active).toEqual(defaultLayout)
  })

  it('rolls back changed preferences after a later failed write', () => {
    storage.setItem('one', 'old')
    storage.failOnKey = 'two'
    expect(transactStorage({ one: 'new', two: 'value' })).toBe(false)
    expect(storage.getItem('one')).toBe('old')
    expect(storage.getItem('two')).toBe(null)
  })
})

describe('interface preferences', () => {
  it('validates saved values and keeps memory unchanged after failed saves', () => {
    storage.setItem('wailf.ui.language', JSON.stringify('unknown'))
    storage.setItem('wailf.ui.sidebarWidth', '99999')
    const store = usePreferenceStore()
    expect(store.language).toBe('zh-CN')
    expect(store.sidebarWidth).toBe(360)
    expect(store.setLanguage('en-US')).toBe(true)
    expect(store.setSidebarWidth(240)).toBe(true)
    storage.failOnKey = 'wailf.ui.language'
    expect(store.setLanguage('zh-CN')).toBe(false)
    expect(store.language).toBe('en-US')
    expect(store.setSidebarWidth(Number.NaN)).toBe(false)
  })
})
