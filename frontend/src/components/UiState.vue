<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import { ElEmpty, ElIcon, ElResult, ElSkeleton } from 'element-plus'
import { Loading, WarningFilled, FolderOpened, Folder } from '@element-plus/icons-vue'
withDefaults(
  defineProps<{
    kind: 'unavailable' | 'empty' | 'loading' | 'error' | 'context'
    title?: string
    description?: string
  }>(),
  { kind: 'empty' },
)
defineEmits<{ retry: [] }>()
const { t } = useI18n()
const elementIcons = {
  unavailable: WarningFilled,
  empty: FolderOpened,
  loading: Loading,
  error: WarningFilled,
  context: Folder,
}
</script>
<template>
  <div
    class="empty-state"
    :class="`state-${kind}`"
    :role="kind === 'error' ? 'alert' : 'status'"
    aria-live="polite"
  >
    <ElEmpty v-if="kind === 'empty' || kind === 'unavailable' || kind === 'context'" :image-size="68">
      <template #image
        ><ElIcon :size="28"><component :is="elementIcons[kind]" /></ElIcon
      ></template>
      <template #description>
        <span class="ui-state-copy">
          <strong>{{ title || t(`state.${kind}.title`) }}</strong>
          <small>{{ description || t(`state.${kind}.description`) }}</small>
        </span>
      </template>
      <slot /><slot name="actions" />
    </ElEmpty>
    <div
      v-else-if="kind === 'loading'"
      class="ui-state-loading"
      role="status"
      aria-live="polite"
      :aria-label="`${title || t('state.loading.title')}: ${description || t('state.loading.description')}`"
    >
      <ElSkeleton :rows="3" animated />
      <slot /><slot name="actions" />
    </div>
    <ElResult
      v-else
      status="error"
      :title="title || t(`state.${kind}.title`)"
      :sub-title="description || t(`state.${kind}.description`)"
    >
      <template #icon
        ><ElIcon :size="28"><WarningFilled /></ElIcon
      ></template>
      <template #extra><slot /><slot name="actions" /></template>
    </ElResult>
  </div>
</template>

<style scoped>
.ui-state-copy {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.ui-state-copy strong {
  color: var(--wailf-color-text-primary);
}
.ui-state-copy small {
  color: var(--wailf-color-text-muted);
  font-size: inherit;
}
.ui-state-loading {
  width: 100%;
  min-width: 180px;
}
@media (prefers-reduced-motion: reduce) {
  :deep(.el-skeleton__item) {
    animation: none;
  }
}
</style>
