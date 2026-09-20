<script setup lang="ts">
import { onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ElAlert,
  ElButton,
  ElForm,
  ElFormItem,
  ElOption,
  ElPagination,
  ElProgress,
  ElSelect,
} from 'element-plus'
import { useJobsStore } from '../../stores/jobs'
import { JOB_STATUSES } from '../../services/types'
import QueryFeedback from '../business/QueryFeedback.vue'
const { t, te, locale } = useI18n()
const jobs = useJobsStore()
const emit = defineEmits<{ navigate: [] }>()
onMounted(jobs.initialize)
function refilter() {
  jobs.filters.page = 1
  void jobs.refresh()
}
function page(value: number) {
  jobs.filters.page = value
  void jobs.refresh()
}
function date(value: string) {
  const parsed = new Date(value)
  return Number.isNaN(parsed.valueOf())
    ? '—'
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(parsed)
}
</script>
<template>
  <div class="stack task-panel">
    <p class="muted">{{ t('business.jobs.description') }}</p>
    <ElForm label-position="top" class="form-grid"
      ><ElFormItem :label="t('business.jobs.filterStatus')"
        ><ElSelect v-model="jobs.filters.status" :teleported="false" @change="refilter"
          ><ElOption value="" :label="t('business.jobs.allStatuses')" /><ElOption
            v-for="status in JOB_STATUSES"
            :key="status"
            :value="status"
            :label="t(`business.jobStatus.${status}`)" /></ElSelect></ElFormItem
      ><ElFormItem :label="t('business.jobs.sort')"
        ><ElSelect v-model="jobs.filters.direction" :teleported="false" @change="refilter"
          ><ElOption value="desc" :label="t('business.jobs.newest')" /><ElOption
            value="asc"
            :label="t('business.jobs.oldest')" /></ElSelect></ElFormItem
    ></ElForm>
    <div class="toolbar">
      <span class="muted">{{ t('business.jobs.total', { count: jobs.list.data.total }) }}</span
      ><ElButton text :disabled="!jobs.available || jobs.list.status === 'loading'" @click="jobs.refresh">{{
        t('business.action.refresh')
      }}</ElButton>
    </div>
    <QueryFeedback :state="jobs.list" @retry="jobs.refresh" />
    <article v-for="job in jobs.list.data.items" :key="job.id" class="card job-card">
      <div class="card-content stack">
        <div class="toolbar">
          <strong>{{ job.requestSummary || job.type }}</strong
          ><span class="badge" :data-status="job.status">{{ t(`business.jobStatus.${job.status}`) }}</span>
        </div>
        <p class="muted mono">{{ job.id }}</p>
        <div v-if="job.status === 'running' || job.status === 'queued'" class="job-progress">
          <span>{{
            job.progress === null
              ? t('business.jobs.indeterminate')
              : t('business.jobs.progress', { value: Math.round(Math.min(100, Math.max(0, job.progress))) })
          }}</span
          ><ElProgress
            :percentage="job.progress === null ? 0 : Math.min(100, Math.max(0, job.progress))"
            :show-text="false"
            :indeterminate="job.progress === null"
          />
        </div>
        <p v-if="job.error" class="muted">
          {{ t(te(job.error.messageKey) ? job.error.messageKey : 'business.state.errorDescription') }}
        </p>
        <div class="toolbar">
          <span class="muted">{{ date(job.createdAt) }}</span
          ><RouterLink
            class="button ghost"
            :to="`/jobs/${encodeURIComponent(job.id)}`"
            @click="emit('navigate')"
            >{{ t('business.jobs.details') }}</RouterLink
          ><ElButton
            v-if="job.status === 'queued' || job.status === 'running'"
            :disabled="!jobs.available || jobs.cancelling.includes(job.id)"
            @click="jobs.cancel(job.id)"
            >{{
              t(jobs.cancelling.includes(job.id) ? 'business.jobs.cancelling' : 'business.jobs.cancel')
            }}</ElButton
          >
        </div>
      </div>
    </article>
    <ElPagination
      v-if="jobs.list.status === 'ready'"
      layout="prev, pager, next"
      :current-page="jobs.filters.page"
      :page-size="jobs.list.data.pageSize"
      :total="jobs.list.data.total"
      @current-change="page"
    />
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
  </div>
</template>
