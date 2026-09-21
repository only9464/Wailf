<script setup lang="ts">
import { computed, ref, watch, nextTick } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import { Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem, useSidebar } from './ui/sidebar'
import { features } from '../features/registry'
import { useLayoutStore } from '../stores/layout'
import { useNotificationStore } from '../stores/notifications'
import { themeState } from '../theme'
import UiIcon from './UiIcon.vue'
const emit = defineEmits<{ panel: [value: 'tasks' | 'notifications', trigger?: HTMLElement | null] }>()
const { t, te } = useI18n()
const { isMobile, state, setOpen, setOpenMobile, openMobile } = useSidebar()
const platformCard = ref<HTMLButtonElement>()
const route = useRoute(); const layout = useLayoutStore(); const notifications = useNotificationStore()
const search = ref(''); const platformActionsOpen = ref(false); const expanded = ref(new Set(['recon']))
const registered = new Map(features.map((feature) => [feature.id, feature]))
const platform = computed(() => themeState.platform || 'unknown')
const navGroups = computed(() => layout.active.groups.map(group => ({ ...group, items: group.items.map(id => registered.get(id)).filter((feature): feature is NonNullable<typeof feature> => !!feature && !layout.active.hidden.includes(feature.id) && (!search.value || `${t(feature.nameKey)} ${feature.id} ${feature.tags.join(' ')}`.toLocaleLowerCase().includes(search.value.toLocaleLowerCase()))) })).filter(group => group.items.length))
function groupName(group: { id: string; name: string }) { return layout.active.customNames?.[group.id] || (te(group.name) ? t(group.name) : group.name) }
function toggleGroup(id: string) {
  if (!isMobile.value && state.value === 'collapsed') { setOpen(true); expanded.value.add(id) }
  else if (expanded.value.has(id)) expanded.value.delete(id)
  else expanded.value.add(id)
}
function action(value: 'tasks' | 'notifications') {
  const trigger = isMobile.value ? document.querySelector<HTMLElement>('.mobile-menu') : platformCard.value
  platformActionsOpen.value = false
  setOpenMobile(false)
  emit('panel', value, trigger)
}
function openSettings() { platformActionsOpen.value = false; setOpenMobile(false) }
function drawerEscape(event: KeyboardEvent) {
  if (event.key !== 'Escape' || !platformActionsOpen.value) return
  event.preventDefault(); event.stopPropagation(); platformActionsOpen.value = false
  void nextTick(() => platformCard.value?.focus())
}
watch(() => route.path, path => {
  setOpenMobile(false)
  const group = layout.active.groups.find(item => item.items.some(id => registered.get(id)?.route === path))
  if (group) expanded.value.add(group.id)
}, { immediate: true })
watch(openMobile, value => { if (!value) platformActionsOpen.value = false })
</script>
<template>
  <Sidebar class="native-sidebar" collapsible="icon">
    <SidebarHeader class="sidebar-top-controls">
      <div class="sidebar-controls"><div class="sidebar-search"><UiIcon name="search" :size="16" /><input v-model="search" :aria-label="t('common.search')" :placeholder="t('app.search')" /><button v-if="search" class="icon-button" :aria-label="t('common.clear')" @click="search = ''"><UiIcon name="x" :size="13" /></button></div>
      <button class="icon-button" :aria-label="isMobile ? t('common.close') : t(state === 'collapsed' ? 'app.expand' : 'app.collapse')" @click="isMobile ? setOpenMobile(false) : setOpen(state === 'collapsed')"><UiIcon :name="isMobile ? 'x' : state === 'collapsed' ? 'expand' : 'collapse'" /></button></div>
    </SidebarHeader>
    <SidebarContent class="nav-tree">
      <SidebarGroup>
        <SidebarGroupLabel>{{ t('app.navigation') }}<span>{{ features.length }}</span></SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <div v-for="group in navGroups" :key="group.id" class="nav-group">
              <SidebarMenuItem>
                <SidebarMenuButton :title="groupName(group)" :aria-label="groupName(group)" :aria-expanded="!!search || expanded.has(group.id)" :is-active="group.items.some(item => item.route === route.path)" @click="toggleGroup(group.id)"><UiIcon :name="group.icon" :size="18" /><span>{{ groupName(group) }}</span><UiIcon class="group-chevron" :name="expanded.has(group.id) || search ? 'chevron-down' : 'chevron-right'" :size="13" /></SidebarMenuButton>
              </SidebarMenuItem>
              <div v-if="expanded.has(group.id) || search" class="nav-items"><RouterLink v-for="feature in group.items" :key="feature.id" :to="feature.route" class="nav-item" active-class="is-active"><span class="nav-dot"></span><span>{{ t(feature.nameKey) }}</span></RouterLink></div>
            </div>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
      <p v-if="!navGroups.length" class="muted nav-no-results">{{ t('app.noSearch') }}</p>
    </SidebarContent>
    <SidebarFooter class="sidebar-footer">
      <Collapsible v-model:open="platformActionsOpen" class="platform-drawer" @keydown.capture="drawerEscape">
        <CollapsibleContent class="platform-drawer-content">
          <button class="footer-action" :title="t('app.tasks')" @click="action('tasks')"><UiIcon name="tasks" /><span>{{ t('app.tasks') }}</span></button>
          <button class="footer-action" :title="t('app.notifications')" @click="action('notifications')"><UiIcon name="bell" /><span>{{ t('app.notifications') }}</span><span v-if="notifications.unread" class="notification-count">{{ notifications.unread }}</span></button>
          <RouterLink class="footer-action" to="/settings" :title="t('app.settings')" @click="openSettings"><UiIcon name="settings" /><span>{{ t('app.settings') }}</span></RouterLink>
        </CollapsibleContent>
        <CollapsibleTrigger as-child><button ref="platformCard" class="platform-card" :aria-label="`${t('app.platformCard')} · ${t(`platform.${platform}`)}`" :title="t('app.platformActions')"><UiIcon name="monitor" :size="18" /><span>{{ t(`platform.${platform}`) }}</span><UiIcon class="platform-chevron" :name="platformActionsOpen ? 'chevron-down' : 'chevron-up'" :size="14" /></button></CollapsibleTrigger>
      </Collapsible>
    </SidebarFooter>
  </Sidebar>
</template>
