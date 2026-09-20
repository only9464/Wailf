<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElAlert,
  ElButton,
  ElDatePicker,
  ElForm,
  ElFormItem,
  ElInput,
  ElOption,
  ElSelect,
} from 'element-plus'
import { useScopeStore } from '../../stores/scopes'
import QueryFeedback from '../business/QueryFeedback.vue'
const { t, te } = useI18n()
const store = useScopeStore()
onMounted(store.initialize)
const canSave = computed(() => store.available && store.validDraft && !store.saving)
function selectScope(id: string | number | boolean | undefined) {
  store.select(String(id ?? ''))
}
</script>
<template>
  <div class="stack scope-panel">
    <p class="muted">{{ t('business.scope.description') }}</p>
    <ElForm label-position="top" class="stack">
      <ElFormItem :label="t('business.scope.scope')">
        <ElSelect
          :model-value="store.scopeId"
          :disabled="store.scopes.status !== 'ready'"
          :teleported="false"
          @update:model-value="selectScope"
          class="full-width"
        >
          <ElOption value="" :label="t('business.scope.chooseScope')" />
          <ElOption
            v-for="item in store.options"
            :key="item.id"
            :value="item.id"
            :label="item.name"
            :disabled="item.status === 'revoked'"
          />
        </ElSelect>
      </ElFormItem>
    </ElForm>
    <QueryFeedback :state="store.scopes" @retry="store.load()" />
    <dl v-if="store.currentScope" class="detail-grid">
      <dt>{{ t('business.scope.expressions') }}</dt>
      <dd>{{ store.currentScope.expressions.join(', ') }}</dd>
      <dt>{{ t('business.scope.authorization') }}</dt>
      <dd>{{ store.currentScope.authorization }}</dd>
      <dt>{{ t('business.scope.expires') }}</dt>
      <dd>{{ store.currentScope.expiresAt }}</dd>
      <dt>{{ t('business.scope.riskLevel') }}</dt>
      <dd>{{ store.currentScope.riskLevel }}</dd>
    </dl>
    <div v-if="store.scopes.data.total > store.scopes.data.pageSize" class="toolbar">
      <ElButton
        text
        :disabled="store.scopes.data.page <= 1"
        @click="store.load(store.scopes.data.page - 1)"
        >{{ t('business.action.previous') }}</ElButton
      ><span class="muted">{{ t('business.results.page', { page: store.scopes.data.page }) }}</span
      ><ElButton
        text
        :disabled="store.scopes.data.page * store.scopes.data.pageSize >= store.scopes.data.total"
        @click="store.load(store.scopes.data.page + 1)"
        >{{ t('business.action.next') }}</ElButton
      >
    </div>
    <details class="card" open>
      <summary>{{ t('business.scope.newScope') }}</summary>
      <ElForm class="card-content stack" label-position="top" @submit.prevent="store.create">
        <ElFormItem :label="t('business.scope.name')"
          ><ElInput v-model="store.draft.name" :placeholder="t('business.scope.scopeName')"
        /></ElFormItem>
        <ElFormItem :label="t('business.scope.expressions')"
          ><ElInput
            v-model="store.draft.expressions"
            type="textarea"
            :rows="3"
            :placeholder="t('business.scan.targetPlaceholder')"
        /></ElFormItem>
        <ElFormItem :label="t('business.scope.authorization')"
          ><ElInput
            v-model="store.draft.authorization"
            type="textarea"
            :rows="2"
            :placeholder="t('business.scope.authorizationPlaceholder')"
        /></ElFormItem>
        <div class="form-grid">
          <ElFormItem :label="t('business.scope.validFrom')"
            ><ElDatePicker
              v-model="store.draft.validFrom"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm"
              :teleported="false" /></ElFormItem
          ><ElFormItem :label="t('business.scope.expires')"
            ><ElDatePicker
              v-model="store.draft.expiresAt"
              type="datetime"
              value-format="YYYY-MM-DDTHH:mm"
              :teleported="false"
          /></ElFormItem>
        </div>
        <div class="form-grid">
          <ElFormItem :label="t('business.scope.riskLevel')"
            ><ElSelect v-model="store.draft.riskLevel" :teleported="false"
              ><ElOption
                v-for="level in ['L0', 'L1', 'L2', 'L3', 'L4']"
                :key="level"
                :value="level"
                :label="level" /></ElSelect></ElFormItem
          ><ElFormItem :label="t('business.scope.operations')"
            ><ElInput v-model="store.draft.allowedOperations"
          /></ElFormItem>
        </div>
        <p class="muted">{{ t('business.scope.scopeHint') }}</p>
        <ElButton
          type="primary"
          native-type="submit"
          :disabled="!canSave"
          :title="
            !store.available
              ? t('business.state.unavailableDescription')
              : t('business.scope.scopeRequirements')
          "
          >{{ t('business.scope.saveScope') }}</ElButton
        >
      </ElForm>
    </details>
    <ElAlert
      :title="t(store.available ? 'business.scope.draftHint' : 'business.scope.unavailableHint')"
      type="info"
      :closable="false"
    />
    <ElAlert
      v-if="store.saveError"
      :title="
        t(te(store.saveError.messageKey) ? store.saveError.messageKey : 'business.state.errorDescription')
      "
      type="error"
      :closable="false"
    />
  </div>
</template>
