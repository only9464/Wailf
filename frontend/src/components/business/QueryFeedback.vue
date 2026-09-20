<script setup lang="ts">
import { useI18n } from 'vue-i18n'
import UiState from '../UiState.vue'
import { ElButton } from 'element-plus'
import type { QueryState } from '../../services/types'
defineProps<{ state: QueryState<unknown>; contextKey?: string }>()
defineEmits<{ retry: [] }>()
const { t, te } = useI18n()
</script>
<template>
  <UiState
    v-if="state.status !== 'ready'"
    :kind="state.status"
    :title="t(`business.state.${state.status}`)"
    :description="
      t(state.status === 'context' && contextKey ? contextKey : `business.state.${state.status}Description`)
    "
  >
    <p v-if="state.status === 'error' && state.error" class="muted" role="alert">
      {{ t(te(state.error.messageKey) ? state.error.messageKey : 'business.state.errorDescription')
      }}<span v-if="state.error.requestId">
        · {{ t('business.state.requestId', { id: state.error.requestId }) }}</span
      >
    </p>
    <ElButton v-if="state.status === 'error' && state.error?.retryable" @click="$emit('retry')">
      {{ t('business.action.retry') }}
    </ElButton>
  </UiState>
</template>
