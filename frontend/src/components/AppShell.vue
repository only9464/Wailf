<script setup lang="ts">
import { computed, ref, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { SidebarProvider, SidebarTrigger } from './ui/sidebar'
import SidebarNavigation from './SidebarNavigation.vue'
import { usePreferenceStore } from '../stores/preferences'
import { useNotificationStore } from '../stores/notifications'
import UiIcon from './UiIcon.vue'
import OverlayPanel from './OverlayPanel.vue'
import TaskPanel from './panels/TaskPanel.vue'
import LogPanel from './panels/LogPanel.vue'
const { t } = useI18n()
const route = useRoute()
const preferences = usePreferenceStore()
const notifications = useNotificationStore()
type Panel = 'tasks' | 'notifications'
const panel = ref<Panel | null>(null)
const returnFocus = ref<HTMLElement | null>(null)
async function showPanel(value: Panel, trigger?: HTMLElement | null) {
  returnFocus.value = trigger ?? document.activeElement as HTMLElement
  await nextTick()
  panel.value = value
  if (value === 'notifications') notifications.markRead()
}
function setSidebar(open: boolean) {
  if (!preferences.setSidebarCollapsed(!open)) notifications.push('settings.preferenceFailed', 'error')
}
const panelTitle = computed(() => panel.value ? t(`app.${panel.value}`) : '')
const panelDescription = computed(() => panel.value ? t(`app.${panel.value === 'tasks' ? 'task' : 'notification'}Description`) : '')
</script>
<template>
  <div class="app-shell" :class="{ 'sidebar-collapsed': preferences.sidebarCollapsed }">
    <div class="titlebar" aria-hidden="true"></div>
    <SidebarProvider class="app-layout" :open="!preferences.sidebarCollapsed" :style="{ '--sidebar-width': `${preferences.sidebarWidth}px`, '--sidebar-width-icon': '80px' }" @update:open="setSidebar">
      <SidebarNavigation @panel="showPanel" />
      <main class="main-area">
        <header class="main-toolbar">
          <div class="breadcrumb">
            <SidebarTrigger class="mobile-menu" :aria-label="t('app.menu')" />
            <UiIcon name="layers" :size="16" /><strong>{{ t(String(route.meta.titleKey || 'app.subtitle')) }}</strong>
          </div>
          <span class="muted">{{ t('app.local') }}</span>
        </header>
        <div class="main-scroll">
          <RouterView v-slot="{ Component }"><KeepAlive :max="12"><component :is="Component" :key="route.name === 'job-detail' ? route.fullPath : route.name" /></KeepAlive></RouterView>
        </div>
        <footer class="main-statusbar"><span><UiIcon name="info" :size="13" />{{ t('app.unavailable') }}</span><span>{{ t('app.footerHint') }}</span></footer>
      </main>
    </SidebarProvider>
  </div>
  <OverlayPanel v-if="panel" :return-focus="returnFocus" :title="panelTitle" :description="panelDescription" @close="panel = null">
    <TaskPanel v-if="panel === 'tasks'" @navigate="panel = null" /><LogPanel v-else />
  </OverlayPanel>
</template>
