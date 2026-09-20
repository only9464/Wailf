// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { mount, flushPromises, type VueWrapper } from '@vue/test-utils'
import { createPinia } from 'pinia'
import { createMemoryHistory, createRouter } from 'vue-router'
import { createI18n } from 'vue-i18n'
import { ElSelect } from 'element-plus'
import zh from '../i18n/zh-CN/zh-CN.json'
import { useLayoutStore } from '../stores/layout'
import { usePreferenceStore } from '../stores/preferences'
import { defaultLayout } from '../features/registry'
import { cloneLayout } from '../storage/layout'
import * as browserStorage from '../storage/browser'
import { selectTheme, themeState } from '../theme'
import SettingsView from './SettingsView.vue'

vi.mock('../theme', async () => {
  const { reactive } = await import('vue')
  return {
    themeState: reactive({
      selection: { version: 1, mode: 'platform', customId: null },
      platform: 'windows',
      customThemes: [],
      diagnostics: [],
    }),
    selectTheme: vi.fn(async () => true),
    importThemes: vi.fn(async () => ({ committed: true })),
    exportThemes: vi.fn(() => '{}'),
    removeTheme: vi.fn(async () => true),
  }
})

const wrappers: VueWrapper[] = []
beforeEach(() => {
  localStorage.clear()
  vi.clearAllMocks()
  themeState.customThemes = []
  themeState.selection = { version: 1, mode: 'platform', customId: null }
})
afterEach(() => {
  wrappers.splice(0).forEach((wrapper) => wrapper.unmount())
  vi.restoreAllMocks()
})

async function setup(tab = 'general') {
  const pinia = createPinia()
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/settings', component: SettingsView }],
  })
  await router.push(`/settings?tab=${tab}`)
  await router.isReady()
  const i18n = createI18n({ legacy: false, locale: 'zh-CN', messages: { 'zh-CN': zh } })
  const wrapper = mount(SettingsView, { attachTo: document.body, global: { plugins: [pinia, router, i18n] } })
  wrappers.push(wrapper)
  return { wrapper, router, layouts: useLayoutStore(pinia), preferences: usePreferenceStore(pinia) }
}

describe('settings interactions', () => {
  it('reads and follows the route tab, then updates the route from navigation', async () => {
    const { wrapper, router } = await setup('layout')
    expect(wrapper.find('#active-layout').exists()).toBe(true)
    expect(wrapper.findAll('.layout-item')).toHaveLength(52)
    await router.replace('/settings?tab=general')
    await flushPromises()
    expect(wrapper.find('#interface-language').exists()).toBe(true)
    await wrapper.findAll('.tabs button')[1].trigger('click')
    await flushPromises()
    expect(router.currentRoute.value.query.tab).toBe('appearance')
    expect(wrapper.find('.appearance-preview').exists()).toBe(true)
  })

  it('edits group names inline, hides features and preserves removed group items', async () => {
    const { wrapper, layouts } = await setup('layout')
    const firstGroup = wrapper.findAll('.layout-group-header')[0]
    await firstGroup
      .findAll('button')
      .find((button) => button.text() === '重命名')!
      .trigger('click')
    await flushPromises()
    const input = wrapper.find('#group-name-recon')
    expect(document.activeElement).toBe(input.element)
    await input.setValue('Daily checks')
    await wrapper.find('.inline-edit').trigger('submit')
    expect(layouts.active.customNames?.recon).toBe('Daily checks')
    const firstFeature = wrapper.find('.layout-item input[type="checkbox"]')
    await firstFeature.setValue(false)
    expect(layouts.active.hidden).toContain('portscan')
    await wrapper.findAll('.layout-group-header')[0].find('button.danger').trigger('click')
    expect(layouts.active.groups.some((group) => group.id === 'recon')).toBe(true)
    await wrapper.find('.confirm-box button.danger').trigger('click')
    expect(layouts.unassigned).toContain('portscan')
    expect(layouts.active.groups.some((group) => group.id === 'recon')).toBe(false)
    expect(wrapper.find('[role="status"]').text()).toContain('导航布局已更新')
  })

  it('reports failed preference saves and restores the visible selection', async () => {
    const { wrapper, preferences } = await setup()
    vi.spyOn(browserStorage, 'writeJson').mockReturnValue(false)
    const input = wrapper.findComponent(ElSelect)
    await input.vm.$emit('update:modelValue', 'en-US')
    await flushPromises()
    expect(preferences.language).toBe('zh-CN')
    expect(input.props('modelValue')).toBe('zh-CN')
    expect(wrapper.find('[role="alert"]').text()).toContain('偏好无法保存')
  })

  it('imports unknown features without overwriting the current layout', async () => {
    const { wrapper, layouts } = await setup('layout')
    const data = cloneLayout(defaultLayout)
    data.groups[0].items.push('upcoming-feature')
    const file = new File([JSON.stringify(data)], 'layout.json', { type: 'application/json' })
    const input = wrapper.find('input[type="file"]')
    Object.defineProperty(input.element, 'files', { configurable: true, value: [file] })
    await input.trigger('change')
    await flushPromises()
    expect(layouts.layouts).toHaveLength(2)
    expect(layouts.unassigned).toContain('upcoming-feature')
    expect(wrapper.text()).toContain('未知功能：upcoming-feature')
    expect(wrapper.find('[role="status"]').text()).toContain('导航布局已导入')
  })

  it('reports a rejected theme selection without success feedback', async () => {
    themeState.customThemes = [{ version: 1, id: 'custom', name: 'Custom', base: 'platform', tokens: {} }]
    vi.mocked(selectTheme).mockResolvedValue(false)
    const { wrapper } = await setup('appearance')
    await wrapper.findAll('.theme-choice')[1].trigger('click')
    await flushPromises()
    expect(selectTheme).toHaveBeenCalledWith('custom')
    expect(wrapper.find('[role="alert"]').text()).toContain('无法保存主题')
    expect(themeState.selection.mode).toBe('platform')
  })
})
