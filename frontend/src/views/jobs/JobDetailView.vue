<script setup lang="ts">
import { effectScope, onActivated, onDeactivated, onMounted, onUnmounted, watch, type EffectScope } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useJobsStore } from '../../stores/jobs'
import { ElButton, ElProgress } from 'element-plus'
import QueryFeedback from '../../components/business/QueryFeedback.vue'
import ResultViews from '../../components/business/ResultViews.vue'
const route = useRoute()
const { t, te } = useI18n()
const jobs = useJobsStore()
jobs.initialize()
let queries: EffectScope | undefined
function startQueries() {
  if (queries) return
  queries = effectScope()
  queries.run(() =>
    watch(
      () => [route.params.jobId, route.name],
      () => {
        if (route.name !== 'job-detail') return
        const id = String(route.params.jobId || '')
        void jobs.loadDetail(id)
        void jobs.loadResults(id)
      },
      { immediate: true },
    ),
  )
}
function stopQueries() {
  queries?.stop()
  queries = undefined
}
onMounted(startQueries)
onActivated(startQueries)
onDeactivated(stopQueries)
onUnmounted(stopQueries)
</script>
<template>
  <div class="page stack">
    <header class="page-header">
      <div>
        <p class="section-label">{{ t('business.jobs.eyebrow') }}</p>
        <h1 class="page-title">{{ t('business.jobs.details') }}</h1>
        <p class="muted mono">{{ route.params.jobId }}</p>
      </div>
      <RouterLink class="button ghost" to="/recon/portscan">{{ t('business.jobs.back') }}</RouterLink>
    </header>
    <section class="card">
      <header class="card-header">
        <h2>{{ t('business.jobs.snapshot') }}</h2>
        <div class="toolbar">
          <ElButton
            text
            :disabled="!jobs.available || jobs.detail.status === 'loading'"
            @click="jobs.loadDetail(String(route.params.jobId))"
          >
            {{ t('business.action.refresh') }}</ElButton
          ><ElButton
            :disabled="
              !jobs.available ||
              !jobs.detail.data ||
              !['queued', 'running'].includes(jobs.detail.data.status) ||
              jobs.cancelling.includes(String(route.params.jobId))
            "
            :title="!jobs.available ? t('business.state.unavailableDescription') : ''"
            @click="jobs.cancel(String(route.params.jobId))"
          >
            {{
              t(
                jobs.cancelling.includes(String(route.params.jobId))
                  ? 'business.jobs.cancelling'
                  : 'business.jobs.cancel',
              )
            }}
          </ElButton>
        </div>
      </header>
      <QueryFeedback :state="jobs.detail" @retry="jobs.loadDetail(String(route.params.jobId))" />
      <div v-if="jobs.detail.data" class="card-content stack">
        <div class="toolbar">
          <strong>{{ jobs.detail.data.requestSummary }}</strong
          ><span class="badge" :data-status="jobs.detail.data.status">{{
            t(`business.jobStatus.${jobs.detail.data.status}`)
          }}</span>
        </div>
        <label class="job-progress"
          ><span>{{
            jobs.detail.data.progress === null
              ? t('business.jobs.indeterminate')
              : t('business.jobs.progress', {
                  value: Math.round(Math.min(100, Math.max(0, jobs.detail.data.progress))),
                })
          }}</span
          ><ElProgress
            :percentage="
              jobs.detail.data.progress === null ? 0 : Math.min(100, Math.max(0, jobs.detail.data.progress))
            "
            :show-text="false"
            :indeterminate="jobs.detail.data.progress === null"
        /></label>
        <dl class="detail-grid">
          <dt>{{ t('business.jobs.type') }}</dt>
          <dd>{{ jobs.detail.data.domain }} / {{ jobs.detail.data.type }}</dd>
          <dt>{{ t('business.results.created') }}</dt>
          <dd>{{ jobs.detail.data.createdAt }}</dd>
          <dt>{{ t('business.jobs.updated') }}</dt>
          <dd>{{ jobs.detail.data.updatedAt }}</dd>
        </dl>
        <p v-if="jobs.detail.data.error" class="inline-note" role="alert">
          {{
            t(
              te(jobs.detail.data.error.messageKey)
                ? jobs.detail.data.error.messageKey
                : 'business.state.errorDescription',
            )
          }}<span v-if="jobs.detail.data.error.requestId">
            · {{ t('business.state.requestId', { id: jobs.detail.data.error.requestId }) }}</span
          >
        </p>
        <p v-if="jobs.detail.data.status === 'interrupted'" class="inline-note">
          {{ t('business.jobs.interruptedHint') }}
        </p>
      </div>
    </section>
    <p v-if="jobs.commandError" class="inline-note" role="alert">
      {{
        t(te(jobs.commandError.messageKey) ? jobs.commandError.messageKey : 'business.state.errorDescription')
      }}
    </p>
    <p v-if="jobs.feedback" class="inline-note" role="status">{{ t(jobs.feedback) }}</p>
    <ResultViews />
  </div>
</template>
