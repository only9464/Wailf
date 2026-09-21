<script setup lang="ts">
import { computed, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElAlert, ElButton, ElForm, ElFormItem, ElInput, ElOption, ElSelect } from 'element-plus'
import { useJobsStore } from '../../stores/jobs'
import QueryFeedback from '../../components/business/QueryFeedback.vue'
import ResultViews from '../../components/business/ResultViews.vue'
import UiIcon from '../../components/UiIcon.vue'
const { t, te } = useI18n()
const jobs = useJobsStore()
const blockedReason = computed(() =>
  !jobs.scanAvailable
    ? 'business.state.unavailableDescription'
    : !jobs.activeConnector || jobs.activeConnector.status !== 'healthy'
      ? 'business.scan.connectorRequired'
      : !jobs.canSubmit
        ? 'business.scan.completeForm'
        : '',
)
onMounted(() => jobs.initialize())
function selectedJob(id: string | number | boolean | undefined) {
  const value = String(id ?? '')
  void jobs.loadResults(value)
  void jobs.loadDetail(value)
}
</script>
<template>
  <div class="page stack portscan-view">
    <header class="page-header">
      <div>
        <p class="section-label">{{ t('business.scan.eyebrow') }}</p>
        <h1 class="page-title">{{ t('business.scan.title') }}</h1>
        <p class="muted">{{ t('business.scan.subtitle') }}</p>
      </div>
      <span class="badge">{{ t('business.scan.risk') }}</span>
    </header>
    <ElAlert
      v-if="!jobs.scanAvailable"
      :title="t('business.state.unavailable')"
      :description="t('business.scan.unavailableNote')"
      type="info"
      :closable="false"
      class="service-note"
    />
    <ElForm class="scan-form" label-position="top" @submit.prevent="jobs.submitScan">
      <section class="card scan-targets">
        <header class="card-header">
          <div class="toolbar">
            <span class="step-number">1</span>
            <div>
              <h2>{{ t('business.scan.targets') }}</h2>
              <p class="muted">{{ t('business.scan.targetHint') }}</p>
            </div>
          </div>
        </header>
        <div class="card-content stack">
          <div class="tabs">
            <ElButton
              text
              :class="{ active: jobs.scanDraft.inputKind === 'text' }"
              @click="jobs.scanDraft.inputKind = 'text'"
              >{{ t('business.scan.manual') }}</ElButton
            ><ElButton
              text
              :class="{ active: jobs.scanDraft.inputKind === 'assets' }"
              @click="jobs.scanDraft.inputKind = 'assets'"
              >{{ t('business.scan.existing') }}</ElButton
            >
          </div>
          <ElFormItem v-if="jobs.scanDraft.inputKind === 'text'" :label="t('business.scan.expressions')"
            ><ElInput
              v-model="jobs.scanDraft.targets"
              type="textarea"
              :rows="6"
              spellcheck="false"
              :placeholder="t('business.scan.targetPlaceholder')"
            /><small class="muted">{{ t('business.scan.targetFormat') }}</small></ElFormItem
          >
          <ElFormItem v-else :label="t('business.scan.assetIds')"
            ><ElInput
              v-model="jobs.scanDraft.assetIds"
              type="textarea"
              :rows="6"
              spellcheck="false"
              :placeholder="t('business.scan.assetPlaceholder')"
            /><small class="muted">{{ t('business.scan.assetHint') }}</small></ElFormItem
          >
          <p class="muted draft-note"><UiIcon name="file" :size="14" />{{ t('business.scan.draft') }}</p>
        </div>
      </section>
      <section class="card scan-options">
        <header class="card-header">
          <div class="toolbar">
            <span class="step-number">2</span>
            <div>
              <h2>{{ t('business.scan.configuration') }}</h2>
              <p class="muted">{{ t('business.scan.configHint') }}</p>
            </div>
          </div>
        </header>
        <div class="card-content stack">
          <ElFormItem :label="t('business.scan.connector')"
            ><ElSelect
              v-model="jobs.scanDraft.connectorId"
              :disabled="jobs.connectors.status !== 'ready'"
              class="full-width"
              ><ElOption value="" :label="t('business.scan.chooseConnector')" /><ElOption
                v-for="connector in jobs.connectors.data.items"
                :key="connector.id"
                :value="connector.id"
                :label="`${connector.name} · ${connector.version} · ${t('business.connectorStatus.' + connector.status)}`"
                :disabled="connector.status !== 'healthy'" /></ElSelect
          ></ElFormItem>
          <ElFormItem :label="t('business.scan.profile')"
            ><ElSelect
              v-model="jobs.scanDraft.profileId"
              :disabled="!jobs.activeConnector || jobs.profiles.status !== 'ready'"
              class="full-width"
              ><ElOption value="" :label="t('business.scan.chooseProfile')" /><ElOption
                v-for="profile in jobs.availableProfiles"
                :key="profile.id"
                :value="profile.id"
                :label="profile.name" /></ElSelect
            ><small v-if="jobs.scanDraft.profileId" class="muted">{{
              jobs.availableProfiles.find((item) => item.id === jobs.scanDraft.profileId)?.description
            }}</small></ElFormItem
          >
          <QueryFeedback
            v-if="jobs.connectors.status !== 'ready'"
            :state="jobs.connectors"
            @retry="jobs.loadScanOptions"
          /><QueryFeedback
            v-else-if="jobs.profiles.status !== 'ready'"
            :state="jobs.profiles"
            @retry="jobs.loadScanOptions"
          />
          <div v-else-if="jobs.activeConnector" class="inline-note">
            <span class="status-dot" /><span>{{
              t('business.scan.connectorVersion', { version: jobs.activeConnector.version })
            }}</span>
          </div>
        </div>
      </section>
      <div class="toolbar submit-row">
        <span class="muted" aria-live="polite">{{ blockedReason ? t(blockedReason) : t('business.scan.ready') }}</span
        ><ElButton
          type="primary"
          native-type="submit"
          :disabled="!jobs.canSubmit"
          :title="blockedReason ? t(blockedReason) : ''"
          ><UiIcon name="play" :size="16" />{{
            t(jobs.submitting ? 'business.scan.submitting' : 'business.scan.start')
          }}</ElButton
        >
      </div>
    </ElForm>
    <ElAlert
      v-if="jobs.commandError"
      :title="
        t(te(jobs.commandError.messageKey) ? jobs.commandError.messageKey : 'business.state.errorDescription')
      "
      type="error"
      :closable="false"
      role="alert"
    /><ElAlert
      v-if="jobs.feedback"
      :title="t(jobs.feedback)"
      type="success"
      :closable="false"
      role="status"
    />
    <section class="toolbar result-selector">
      <ElFormItem :label="t('business.scan.relatedJob')"
        ><ElSelect
          :model-value="jobs.selectedJobId"
          :disabled="jobs.list.status !== 'ready'"
          @update:model-value="selectedJob"
          ><ElOption value="" :label="t('business.scan.chooseJob')" /><ElOption
            v-for="job in jobs.list.data.items"
            :key="job.id"
            :value="job.id"
            :label="`${job.requestSummary || job.id} · ${t('business.jobStatus.' + job.status)}`" /></ElSelect></ElFormItem
      ><RouterLink
        v-if="jobs.selectedJobId"
        class="button ghost"
        :to="`/jobs/${encodeURIComponent(jobs.selectedJobId)}`"
        >{{ t('business.jobs.details') }}</RouterLink
      ><span v-if="jobs.detail.data" class="badge">{{
        t(`business.jobStatus.${jobs.detail.data.status}`)
      }}</span>
    </section>
    <ResultViews />
  </div>
</template>
