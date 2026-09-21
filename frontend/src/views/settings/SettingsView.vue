<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import {
  ElAlert,
  ElButton,
  ElCheckbox,
  ElInput,
  ElOption,
  ElSelect,
  ElSelectV2,
  ElSlider,
  ElSwitch,
} from 'element-plus'
import type { InputInstance } from 'element-plus'
import UiIcon from '../../components/UiIcon.vue'
import { featureById } from '../../features/registry'
import { useLayoutStore } from '../../stores/layout'
import { usePreferenceStore, type Language } from '../../stores/preferences'
import { useNotificationStore } from '../../stores/notifications'
import { UNASSIGNED_GROUP, type Layout, type LayoutGroup } from '../../storage/layout'
import { themeState, selectTheme, importThemes, exportThemes, removeTheme } from '../../theme'

const { t, te } = useI18n()
const route = useRoute()
const router = useRouter()
const layouts = useLayoutStore()
const preferences = usePreferenceStore()
const notifications = useNotificationStore()
const tabs = ['general', 'appearance', 'layout'] as const
type SettingsTab = (typeof tabs)[number]
const tab = ref<SettingsTab>('general')
const width = ref(preferences.sidebarWidth)
const busy = ref(false)
const fileBusy = ref(false)
const themeFile = ref<HTMLInputElement | null>(null)
const layoutFile = ref<HTMLInputElement | null>(null)
const nameInput = ref<InputInstance | null>(null)
const feedback = ref<{ key: string; error: boolean; sequence: number } | null>(null)
let sequence = 0
type EditorKind = 'newLayout' | 'renameLayout' | 'newGroup' | 'renameGroup'
const editor = ref<{ kind: EditorKind; id?: string; name: string } | null>(null)
const confirmation = ref<{ kind: 'layout' | 'group' | 'restore' | 'theme'; id?: string } | null>(null)
const hiddenCount = computed(() => layouts.active.hidden.length)
const groupOptions = computed(() =>
  layouts.active.groups.map((group) => ({ value: group.id, label: groupName(group) })),
)
const editingLabel = computed(() =>
  editor.value?.kind === 'newGroup' || editor.value?.kind === 'renameGroup'
    ? 'settings.groupName'
    : 'settings.layoutName',
)
const confirmationHint = computed(
  () =>
    ({
      layout: 'settings.deleteLayoutHint',
      group: 'settings.deleteGroupHint',
      restore: 'settings.restoreHint',
      theme: 'settings.deleteThemeHint',
    })[confirmation.value?.kind ?? 'restore'],
)

watch(
  () => route.query.tab,
  (value) => {
    tab.value =
      typeof value === 'string' && tabs.includes(value as SettingsTab) ? (value as SettingsTab) : 'general'
  },
  { immediate: true, deep: true },
)
watch(
  () => preferences.sidebarWidth,
  (value) => {
    width.value = value
  },
)

function chooseTab(next: SettingsTab) {
  void router.replace({ query: { ...route.query, tab: next } })
  editor.value = null
  confirmation.value = null
}
function announce(key: string, error = false) {
  feedback.value = { key, error, sequence: ++sequence }
  notifications.push(key, error ? 'error' : 'success')
}
function preferenceResult(result: boolean) {
  announce(result ? 'settings.preferenceSaved' : 'settings.preferenceFailed', !result)
}
function setLanguage(value: Language) {
  const result = preferences.setLanguage(value)
  preferenceResult(result)
}
function saveWidth(value: number | number[] = width.value) {
  width.value = Number(Array.isArray(value) ? value[0] : value)
  const result = preferences.setSidebarWidth(Number(width.value))
  width.value = preferences.sidebarWidth
  preferenceResult(result)
}
function setCollapsed(value: boolean | string | number) {
  const result = preferences.setSidebarCollapsed(value === true || value === 'true' || value === 1)
  preferenceResult(result)
}
function layoutName(layout: Layout) {
  return (
    layout.customNames?.$layout ??
    (layout.layoutId === 'default' ? t('settings.defaultLayout') : layout.layoutId)
  )
}
function groupName(group: LayoutGroup) {
  return layouts.active.customNames?.[group.id] ?? (te(group.name) ? t(group.name) : group.name)
}
function featureName(id: string) {
  const feature = featureById.get(id)
  return feature ? t(feature.nameKey) : t('settings.unknownFeature', { id })
}
function layoutResult(result: boolean, success = 'settings.layoutSaved') {
  const failed =
    layouts.lastError === 'lastLayout'
      ? 'settings.layoutDeleteLast'
      : layouts.lastError === 'storage'
        ? 'settings.layoutWriteFailed'
        : 'settings.layoutImportFailed'
  announce(result ? success : failed, !result)
  return result
}
function selectLayout(value: string) {
  if (!layoutResult(layouts.setActive(value))) return
  editor.value = null
  confirmation.value = null
}
function captureNameInput(element: unknown) {
  nameInput.value = element as InputInstance | null
}
async function beginEdit(kind: EditorKind, group?: LayoutGroup) {
  confirmation.value = null
  editor.value = {
    kind,
    id: group?.id,
    name:
      kind === 'newLayout'
        ? t('settings.layoutNewDefault')
        : kind === 'newGroup'
          ? t('settings.groupNewDefault')
          : group
            ? groupName(group)
            : layoutName(layouts.active),
  }
  await nextTick()
  nameInput.value?.focus()
  nameInput.value?.select()
}
function saveEditor() {
  const current = editor.value
  if (!current || !current.name.trim()) return
  const result =
    current.kind === 'newLayout'
      ? layouts.createLayout(current.name)
      : current.kind === 'renameLayout'
        ? layouts.renameLayout(layouts.activeId, current.name)
        : current.kind === 'newGroup'
          ? layouts.addGroup(current.name)
          : layouts.renameGroup(current.id!, current.name)
  if (layoutResult(result)) editor.value = null
}
function confirm(kind: 'layout' | 'group' | 'restore' | 'theme', id?: string) {
  editor.value = null
  confirmation.value = { kind, id }
}
async function applyTheme(id: string | null) {
  busy.value = true
  try {
    const result = await selectTheme(id)
    announce(result ? 'settings.themeApplied' : 'settings.themeWriteFailed', !result)
  } catch {
    announce('settings.themeWriteFailed', true)
  } finally {
    busy.value = false
  }
}
async function confirmAction() {
  const current = confirmation.value
  if (!current) return
  let done = false
  if (current.kind === 'theme') {
    busy.value = true
    try {
      done = await removeTheme(current.id!)
      announce(done ? 'settings.themeDeleted' : 'settings.themeWriteFailed', !done)
    } catch {
      announce('settings.themeWriteFailed', true)
    } finally {
      busy.value = false
    }
  } else if (current.kind === 'restore')
    done = layoutResult(layouts.restoreDefault(), 'settings.layoutRestored')
  else if (current.kind === 'layout') done = layoutResult(layouts.removeLayout(layouts.activeId))
  else done = layoutResult(layouts.removeGroup(current.id!))
  if (done) confirmation.value = null
}
function moveFeature(value: string, id: string) {
  layoutResult(layouts.moveItem(id, value))
}
function setFeatureVisible(value: unknown, id: string) {
  layoutResult(layouts.setHidden(id, !Boolean(value)))
}
async function importFile(event: Event, kind: 'theme' | 'layout') {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  fileBusy.value = true
  try {
    if (file.size > (kind === 'theme' ? 2 : 1) * 1024 * 1024) {
      announce('settings.fileTooLarge', true)
      return
    }
    const payload = await file.text()
    if (kind === 'theme') {
      const result = await importThemes(payload)
      announce(result.committed ? 'settings.themeImported' : 'settings.themeImportFailed', !result.committed)
    } else layoutResult(layouts.importLayout(payload), 'settings.layoutImported')
  } catch {
    announce('settings.fileReadFailed', true)
  } finally {
    input.value = ''
    fileBusy.value = false
  }
}
function download(payload: string, name: string): boolean {
  let url: string | null = null
  try {
    url = URL.createObjectURL(new Blob([payload], { type: 'application/json;charset=utf-8' }))
    const link = document.createElement('a')
    link.href = url
    link.download = name
    document.body.appendChild(link)
    link.click()
    link.remove()
    const savedUrl = url
    window.setTimeout(() => URL.revokeObjectURL(savedUrl), 1000)
    announce('settings.fileExported')
    return true
  } catch {
    if (url) URL.revokeObjectURL(url)
    return false
  }
}
function exportThemeFile() {
  const payload = exportThemes()
  if (payload === null || !download(payload, 'wailf-themes.json'))
    announce('settings.themeExportFailed', true)
}
function exportLayoutFile() {
  if (!download(layouts.exportLayout(), `wailf-layout-${layouts.activeId}.json`))
    announce('error.generic', true)
}
</script>

<template>
  <div class="settings-page page">
    <header class="page-header">
      <div>
        <div class="eyebrow">{{ t('settings.eyebrow') }}</div>
        <h1>{{ t('settings.title') }}</h1>
        <p>{{ t('settings.description') }}</p>
      </div>
    </header>
    <nav class="tabs" :aria-label="t('settings.title')">
      <ElButton
        v-for="item in tabs"
        :key="item"
        native-type="button"
        :class="{ active: tab === item }"
        :aria-current="tab === item ? 'page' : undefined"
        @click="chooseTab(item)"
      >
        {{ t(`settings.${item}`) }}
      </ElButton>
    </nav>
    <ElAlert
      v-if="feedback"
      :key="feedback.sequence"
      class="settings-feedback"
      :type="feedback.error ? 'error' : 'success'"
      :title="t(feedback.key)"
      :close-text="t('common.close')"
      :role="feedback.error ? 'alert' : 'status'"
      show-icon
      @close="feedback = null"
    />

    <section v-if="tab === 'general'" class="settings-section stack" :aria-label="t('settings.general')">
      <div class="card">
        <div class="card-header">
          <h2>{{ t('settings.general') }}</h2>
        </div>
        <div class="card-body">
          <div class="setting-row">
            <div>
              <label for="interface-language">{{ t('settings.language') }}</label>
              <p class="muted">{{ t('settings.languageHint') }}</p>
            </div>
            <ElSelect
              id="interface-language"
              :model-value="preferences.language"
              :aria-label="t('settings.language')"
              class="settings-select"
              @update:model-value="setLanguage"
            >
              <ElOption value="zh-CN" :label="t('settings.languageChinese')" />
              <ElOption value="en-US" :label="t('settings.languageEnglish')" />
            </ElSelect>
          </div>
          <div class="setting-row">
            <div>
              <label for="sidebar-width">{{ t('settings.sidebar') }}</label>
              <p class="muted">{{ t('settings.sidebarHint') }}</p>
            </div>
            <div class="range-control">
              <ElSlider
                id="sidebar-width"
                v-model="width"
                :aria-label="t('settings.sidebar')"
                :min="200"
                :max="360"
                :step="4"
                class="settings-slider"
                @change="saveWidth"
              /><output id="sidebar-width-value" for="sidebar-width">{{ width }} px</output>
            </div>
          </div>
          <div class="setting-row">
            <div>
              <label for="sidebar-collapse">{{ t('settings.collapsed') }}</label>
              <p class="muted">{{ t('settings.collapsedHint') }}</p>
            </div>
            <ElSwitch
              id="sidebar-collapse"
              :model-value="preferences.sidebarCollapsed"
              :aria-label="t('settings.collapsed')"
              @update:model-value="setCollapsed"
            />
          </div>
        </div>
      </div>
      <div class="card">
        <div class="card-body">
          <div class="setting-row">
            <div>
              <h3>{{ t('settings.storage') }}</h3>
              <p class="muted">{{ t('settings.storageHint') }}</p>
            </div>
            <UiIcon name="shield" />
          </div>
          <div class="setting-row">
            <div>
              <h3>{{ t('settings.runtime') }}</h3>
              <p class="muted">{{ t('settings.runtimeHint') }}</p>
            </div>
            <span class="badge">Wails 3.0.0-beta.20</span>
          </div>
        </div>
      </div>
    </section>

    <section
      v-else-if="tab === 'appearance'"
      class="settings-section stack"
      :aria-label="t('settings.appearance')"
      :aria-busy="busy || fileBusy"
    >
      <div class="card">
        <div class="card-header">
          <div>
            <h2>{{ t('settings.theme') }}</h2>
            <p class="muted">{{ t('settings.themeHint') }}</p>
          </div>
          <span class="badge">{{ t(`platform.${themeState.platform}`) }}</span>
        </div>
        <div class="card-body">
          <div class="appearance-preview" role="img" :aria-label="t('settings.preview')">
            <div class="preview-sidebar">
              <UiIcon name="radar" :size="24" /><span v-for="index in 4" :key="index" class="preview-line" />
            </div>
            <div class="preview-main">
              <div class="eyebrow">Wailf</div>
              <h3>{{ t('settings.lightPreview') }}</h3>
              <span class="preview-line" /><span class="preview-line" />
              <p class="muted">{{ t('settings.previewCaption') }}</p>
            </div>
          </div>
          <div class="theme-grid">
            <ElButton
              native-type="button"
              class="theme-choice"
              :class="{ selected: themeState.selection.mode === 'platform' }"
              :aria-pressed="themeState.selection.mode === 'platform'"
              :disabled="busy || fileBusy"
              @click="applyTheme(null)"
            >
              <UiIcon name="monitor" /><span
                ><strong>{{ t('settings.platformTheme') }}</strong
                ><small>{{ t('settings.followsSystem') }}</small></span
              ><UiIcon v-if="themeState.selection.mode === 'platform'" name="check" />
            </ElButton>
            <ElButton
              v-for="theme in themeState.customThemes"
              :key="theme.id"
              native-type="button"
              class="theme-choice"
              :class="{ selected: themeState.selection.customId === theme.id }"
              :aria-pressed="themeState.selection.customId === theme.id"
              :disabled="busy || fileBusy"
              @click="applyTheme(theme.id)"
            >
              <UiIcon name="layers" /><span
                ><strong>{{ theme.name }}</strong
                ><small>{{ theme.id }}</small></span
              ><UiIcon v-if="themeState.selection.customId === theme.id" name="check" />
            </ElButton>
          </div>
          <p v-if="themeState.customThemes.length === 0" class="muted">{{ t('settings.noThemes') }}</p>
        </div>
      </div>
      <div class="card">
        <div class="card-header">
          <div>
            <h2>{{ t('settings.customThemes') }}</h2>
            <p class="muted">{{ t('settings.themeImportHint') }}</p>
          </div>
        </div>
        <div class="card-body stack">
          <div class="toolbar-actions">
            <ElButton native-type="button" :disabled="busy || fileBusy" @click="themeFile?.click()">
              <UiIcon name="upload" />{{ t('common.import') }}</ElButton
            ><ElButton native-type="button" :disabled="busy || fileBusy" @click="exportThemeFile">
              <UiIcon name="download" />{{ t('common.export') }}</ElButton
            ><ElButton
              native-type="button"
              text
              :disabled="busy || fileBusy || themeState.selection.mode === 'platform'"
              @click="applyTheme(null)"
            >
              <UiIcon name="reset" />{{ t('common.reset') }}
            </ElButton>
          </div>
          <input
            ref="themeFile"
            hidden
            type="file"
            accept=".json,application/json"
            :aria-label="t('common.import')"
            @change="importFile($event, 'theme')"
          />
          <div v-for="theme in themeState.customThemes" :key="theme.id" class="setting-row">
            <div>
              <strong>{{ theme.name }}</strong>
              <p class="muted">{{ theme.id }}</p>
            </div>
            <ElButton
              native-type="button"
              class="danger"
              text
              type="danger"
              :disabled="busy || fileBusy"
              @click="confirm('theme', theme.id)"
            >
              <UiIcon name="trash" :size="16" />{{ t('settings.deleteTheme') }}
            </ElButton>
          </div>
          <div v-if="confirmation?.kind === 'theme'" class="confirm-box">
            <p>{{ t(confirmationHint) }}</p>
            <div class="toolbar-actions">
              <ElButton
                native-type="button"
                class="danger"
                type="danger"
                :disabled="busy"
                @click="confirmAction"
              >
                {{ t('common.confirmRemove') }}</ElButton
              ><ElButton native-type="button" :disabled="busy" @click="confirmation = null">
                {{ t('common.cancel') }}
              </ElButton>
            </div>
          </div>
        </div>
      </div>
      <div v-if="themeState.diagnostics.length" class="inline-note" role="status">
        <UiIcon name="info" /><span>{{ t('settings.themeUnavailable') }}</span>
      </div>
    </section>

    <section v-else class="settings-section stack" :aria-label="t('settings.layout')" :aria-busy="fileBusy">
      <div class="card layout-management">
        <div class="card-header">
          <div>
            <h2>{{ t('settings.layout') }}</h2>
            <p class="muted">{{ t('settings.layoutHint') }}</p>
          </div>
          <span class="badge">{{ t('settings.hiddenItems', { count: hiddenCount }) }}</span>
        </div>
        <div class="card-body stack">
          <div class="layout-picker">
            <label for="active-layout">{{ t('settings.layoutSelect') }}</label
            ><ElSelect
              id="active-layout"
              class="layout-select"
              :model-value="layouts.activeId"
              :aria-label="t('settings.layoutSelect')"
              @update:model-value="selectLayout"
            >
              <ElOption
                v-for="layout in layouts.layouts"
                :key="layout.layoutId"
                :value="layout.layoutId"
                :label="layoutName(layout)"
              />
            </ElSelect>
          </div>
          <div class="toolbar-actions">
            <ElButton native-type="button" @click="beginEdit('newLayout')">
              <UiIcon name="plus" />{{ t('settings.newLayout') }}</ElButton
            ><ElButton native-type="button" @click="beginEdit('renameLayout')">
              {{ t('settings.renameLayout') }}</ElButton
            ><ElButton
              native-type="button"
              class="danger"
              text
              type="danger"
              :disabled="layouts.layouts.length === 1"
              :title="
                layouts.layouts.length === 1 ? t('settings.layoutDeleteLast') : t('settings.deleteLayout')
              "
              @click="confirm('layout')"
            >
              <UiIcon name="trash" />{{ t('settings.deleteLayout') }}
            </ElButton>
          </div>
          <div class="toolbar-actions">
            <ElButton native-type="button" :disabled="fileBusy" @click="layoutFile?.click()">
              <UiIcon name="upload" />{{ t('common.import') }}</ElButton
            ><ElButton native-type="button" @click="exportLayoutFile">
              <UiIcon name="download" />{{ t('common.export') }}</ElButton
            ><ElButton native-type="button" text @click="confirm('restore')">
              <UiIcon name="reset" />{{ t('common.reset') }}
            </ElButton>
          </div>
          <p class="muted">{{ t('settings.layoutExportHint') }}</p>
          <input
            ref="layoutFile"
            hidden
            type="file"
            accept=".json,application/json"
            :aria-label="t('common.import')"
            @change="importFile($event, 'layout')"
          />
          <form
            v-if="editor && editor.kind !== 'renameGroup'"
            class="inline-edit"
            @submit.prevent="saveEditor"
          >
            <label for="layout-editor-name">{{ t(editingLabel) }}</label
            ><ElInput
              id="layout-editor-name"
              :ref="captureNameInput"
              v-model="editor.name"
              maxlength="80"
              required
              @keydown.esc.prevent="editor = null"
            /><ElButton native-type="submit" type="primary" :disabled="!editor.name.trim()">
              {{ t('common.save') }}</ElButton
            ><ElButton native-type="button" @click="editor = null">{{ t('common.cancel') }}</ElButton>
          </form>
          <div
            v-if="confirmation && (confirmation.kind === 'layout' || confirmation.kind === 'restore')"
            class="confirm-box"
          >
            <p>{{ t(confirmationHint) }}</p>
            <div class="toolbar-actions">
              <ElButton
                native-type="button"
                :type="confirmation.kind === 'restore' ? 'primary' : 'danger'"
                @click="confirmAction"
              >
                {{
                  t(confirmation.kind === 'restore' ? 'settings.restoreConfirm' : 'common.confirmRemove')
                }}</ElButton
              ><ElButton native-type="button" @click="confirmation = null">
                {{ t('common.cancel') }}
              </ElButton>
            </div>
          </div>
        </div>
      </div>
      <div class="toolbar">
        <h2>{{ t('settings.editingGroup') }}</h2>
        <ElButton native-type="button" @click="beginEdit('newGroup')">
          <UiIcon name="plus" />{{ t('settings.newGroup') }}
        </ElButton>
      </div>
      <p v-if="!layouts.active.groups.length" class="muted">{{ t('settings.noGroups') }}</p>
      <div v-for="(group, groupIndex) in layouts.active.groups" :key="group.id" class="card">
        <div class="card-header layout-group-header">
          <div>
            <UiIcon :name="group.icon" />
            <h3>{{ groupName(group) }}</h3>
            <span class="badge">{{ t('settings.featureCount', { count: group.items.length }) }}</span>
          </div>
          <div v-if="group.id !== UNASSIGNED_GROUP" class="toolbar-actions">
            <ElButton
              native-type="button"
              text
              :disabled="groupIndex === 0"
              :aria-label="`${groupName(group)} · ${t('common.up')}`"
              :title="t('common.up')"
              @click="layoutResult(layouts.moveGroup(group.id, -1))"
            >
              <UiIcon name="arrow-up" :size="16" />
            </ElButton>
            <ElButton
              native-type="button"
              text
              :disabled="
                groupIndex >= layouts.active.groups.filter((item) => item.id !== UNASSIGNED_GROUP).length - 1
              "
              :aria-label="`${groupName(group)} · ${t('common.down')}`"
              :title="t('common.down')"
              @click="layoutResult(layouts.moveGroup(group.id, 1))"
            >
              <UiIcon name="arrow-down" :size="16" />
            </ElButton>
            <ElButton native-type="button" text @click="beginEdit('renameGroup', group)">
              {{ t('common.rename') }}</ElButton
            ><ElButton
              native-type="button"
              class="danger"
              text
              type="danger"
              :aria-label="`${groupName(group)} · ${t('common.remove')}`"
              :title="t('common.remove')"
              @click="confirm('group', group.id)"
            >
              <UiIcon name="trash" :size="16" />
            </ElButton>
          </div>
        </div>
        <div class="card-body">
          <p v-if="group.id === UNASSIGNED_GROUP" class="muted">{{ t('settings.unknownHint') }}</p>
          <form
            v-if="editor?.kind === 'renameGroup' && editor.id === group.id"
            class="inline-edit"
            @submit.prevent="saveEditor"
          >
            <label :for="`group-name-${group.id}`">{{ t('settings.groupName') }}</label
            ><ElInput
              :id="`group-name-${group.id}`"
              :ref="captureNameInput"
              v-model="editor.name"
              maxlength="80"
              required
              @keydown.esc.prevent="editor = null"
            /><ElButton native-type="submit" type="primary" :disabled="!editor.name.trim()">
              {{ t('common.save') }}</ElButton
            ><ElButton native-type="button" @click="editor = null">{{ t('common.cancel') }}</ElButton>
          </form>
          <div v-if="confirmation?.kind === 'group' && confirmation.id === group.id" class="confirm-box">
            <p>{{ t(confirmationHint) }}</p>
            <div class="toolbar-actions">
              <ElButton native-type="button" class="danger" type="danger" @click="confirmAction">
                {{ t('common.confirmRemove') }}</ElButton
              ><ElButton native-type="button" @click="confirmation = null">
                {{ t('common.cancel') }}
              </ElButton>
            </div>
          </div>
          <p v-if="!group.items.length" class="muted">{{ t('settings.noItems') }}</p>
          <div
            v-for="(id, index) in group.items"
            :key="id"
            class="layout-item"
            :class="{ 'is-hidden': layouts.active.hidden.includes(id) }"
          >
            <label class="layout-item-name"
              ><ElCheckbox
                :model-value="!layouts.active.hidden.includes(id)"
                :aria-label="`${featureName(id)} · ${t('common.visible')}`"
                @update:model-value="setFeatureVisible($event, id)"
              /><UiIcon :name="featureById.get(id)?.icon ?? 'info'" :size="16" /><span>{{
                featureName(id)
              }}</span></label
            >
            <div class="toolbar-actions">
              <ElSelectV2
                :model-value="group.id"
                :options="groupOptions"
                :persistent="false"
                class="feature-group-select"
                :disabled="!featureById.has(id)"
                :aria-label="`${featureName(id)} · ${t('common.moveTo')}`"
                :title="!featureById.has(id) ? t('settings.unknownHint') : t('common.moveTo')"
                @update:model-value="moveFeature($event, id)"
              />
              <ElButton
                native-type="button"
                text
                :disabled="index === 0"
                :aria-label="`${featureName(id)} · ${t('common.up')}`"
                :title="t('common.up')"
                @click="layoutResult(layouts.moveItemBy(id, -1))"
              >
                <UiIcon name="arrow-up" :size="16" /></ElButton
              ><ElButton
                native-type="button"
                text
                :disabled="index === group.items.length - 1"
                :aria-label="`${featureName(id)} · ${t('common.down')}`"
                :title="t('common.down')"
                @click="layoutResult(layouts.moveItemBy(id, 1))"
              >
                <UiIcon name="arrow-down" :size="16" />
              </ElButton>
            </div>
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.settings-select,
.layout-select {
  width: 190px;
  max-width: 100%;
  flex-shrink: 0;
}
.settings-slider {
  width: 140px;
}
.feature-group-select {
  width: 155px;
}
.theme-choice.el-button {
  height: auto;
  min-height: 70px;
  margin-left: 0;
  white-space: normal;
}
.theme-choice :deep(> span) {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.theme-choice :deep(> span > span) {
  flex: 1;
  min-width: 0;
  text-align: left;
}
.layout-item-name {
  display: flex;
  align-items: center;
  gap: 8px;
}
.layout-item-name :deep(.el-checkbox) {
  margin-right: 0;
}
@media (max-width: 600px) {
  .settings-slider {
    width: 120px;
  }
  .layout-item {
    flex-wrap: wrap;
  }
  .layout-item-name {
    flex-basis: 100%;
  }
}
</style>
