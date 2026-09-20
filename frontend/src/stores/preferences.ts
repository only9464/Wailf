import { defineStore } from 'pinia'
import { ref } from 'vue'
import { readJson, writeJson } from '../storage/browser'

export type Language = 'zh-CN' | 'en-US'
export const usePreferenceStore = defineStore('preferences', () => {
  const storedLanguage = readJson<unknown>('wailf.ui.language', 'zh-CN')
  const language = ref<Language>(storedLanguage === 'en-US' ? 'en-US' : 'zh-CN')
  const storedWidth = readJson<unknown>('wailf.ui.sidebarWidth', 240)
  const sidebarWidth = ref(
    typeof storedWidth === 'number' && Number.isFinite(storedWidth)
      ? Math.min(360, Math.max(200, storedWidth))
      : 240,
  )
  const sidebarCollapsed = ref(readJson<unknown>('wailf.ui.sidebarCollapsed', false) === true)

  function setLanguage(value: Language): boolean {
    if (value !== 'zh-CN' && value !== 'en-US') return false
    if (!writeJson('wailf.ui.language', value)) return false
    language.value = value
    return true
  }
  function setSidebarWidth(value: number): boolean {
    if (!Number.isFinite(value)) return false
    const next = Math.round(Math.min(360, Math.max(200, value)))
    if (!writeJson('wailf.ui.sidebarWidth', next)) return false
    sidebarWidth.value = next
    return true
  }
  function setSidebarCollapsed(value: boolean): boolean {
    if (!writeJson('wailf.ui.sidebarCollapsed', value)) return false
    sidebarCollapsed.value = value
    return true
  }
  return { language, sidebarWidth, sidebarCollapsed, setLanguage, setSidebarWidth, setSidebarCollapsed }
})
