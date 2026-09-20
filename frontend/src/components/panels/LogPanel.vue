<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElAlert, ElButton } from 'element-plus'
import { useNotificationStore } from '../../stores/notifications'
import UiState from '../UiState.vue'
const { t, locale } = useI18n()
const notifications = useNotificationStore()
</script>
<template>
  <div class="stack">
    <ElAlert :title="t('notifications.hint')" type="info" :closable="false" show-icon />
    <div class="toolbar">
      <span class="muted">{{ t('notifications.count', { count: notifications.entries.length }) }}</span
      ><ElButton
        text
        :aria-label="t('common.clear')"
        :disabled="!notifications.entries.length"
        @click="notifications.clear"
      >
        {{ t('common.clear') }}
      </ElButton>
    </div>
    <UiState
      v-if="!notifications.entries.length"
      kind="empty"
      :title="t('notifications.empty')"
      :description="t('notifications.emptyDescription')"
    />
    <ol v-else class="notification-list">
      <li v-for="entry in notifications.entries" :key="entry.id">
        <div>
          <p>{{ t(entry.key, entry.values) }}</p>
          <time class="muted">{{ new Date(entry.time).toLocaleString(locale) }}</time>
        </div>
      </li>
    </ol>
  </div>
</template>
