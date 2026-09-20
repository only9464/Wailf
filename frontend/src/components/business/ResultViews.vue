<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElButton, ElPagination, ElTabPane, ElTable, ElTableColumn, ElTabs } from 'element-plus'
import { useJobsStore } from '../../stores/jobs'
import QueryFeedback from './QueryFeedback.vue'
const { t, locale } = useI18n()
const jobs = useJobsStore()
const kinds = ['assets', 'services', 'artifacts', 'audit'] as const
const active = ref<(typeof kinds)[number]>('assets')
function formatDate(value: string) {
  const date = new Date(value)
  return Number.isNaN(date.valueOf())
    ? '—'
    : new Intl.DateTimeFormat(locale.value, { dateStyle: 'short', timeStyle: 'short' }).format(date)
}
function bytes(value: number) {
  return new Intl.NumberFormat(locale.value, {
    style: 'unit',
    unit: 'byte',
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value)
}
</script>
<template>
  <section class="card results-card" :aria-label="t('business.results.title')">
    <header class="card-header">
      <div>
        <h2>{{ t('business.results.title') }}</h2>
        <p class="muted">{{ t('business.results.description') }}</p>
      </div>
      <ElButton
        text
        :disabled="!jobs.scanAvailable || !jobs.selectedJobId || jobs.results[active].status === 'loading'"
        @click="jobs.loadResult(active)"
        >{{ t('business.action.refresh') }}</ElButton
      >
    </header>
    <ElTabs v-model="active" class="result-tabs" :aria-label="t('business.results.title')"
      ><ElTabPane v-for="kind in kinds" :key="kind" :name="kind" :label="t(`business.results.${kind}`)"
    /></ElTabs>
    <QueryFeedback
      :state="jobs.results[active]"
      context-key="business.results.selectJob"
      @retry="jobs.loadResult(active)"
    />
    <div v-if="jobs.results[active].status === 'ready'" class="table-wrap">
      <ElTable
        v-if="active === 'assets'"
        :data="jobs.results.assets.data.items"
        row-key="id"
        class="data-table"
        ><ElTableColumn prop="value" :label="t('business.results.target')" min-width="160" /><ElTableColumn
          prop="kind"
          :label="t('business.results.kind')"
          min-width="100"
        /><ElTableColumn prop="source" :label="t('business.results.source')" min-width="130" /><ElTableColumn
          :label="t('business.results.tags')"
          min-width="120"
          ><template #default="{ row }">{{ row.tags.join(', ') || '—' }}</template></ElTableColumn
        ><ElTableColumn :label="t('business.results.lastSeen')" min-width="160"
          ><template #default="{ row }">{{ formatDate(row.lastSeenAt) }}</template></ElTableColumn
        ></ElTable
      >
      <ElTable
        v-else-if="active === 'services'"
        :data="jobs.results.services.data.items"
        row-key="id"
        class="data-table"
        ><ElTableColumn
          prop="assetValue"
          :label="t('business.results.target')"
          min-width="160"
        /><ElTableColumn prop="port" :label="t('business.results.port')" width="85" /><ElTableColumn
          prop="protocol"
          :label="t('business.results.protocol')"
          width="100"
        /><ElTableColumn
          prop="service"
          :label="t('business.results.service')"
          min-width="120"
        /><ElTableColumn prop="source" :label="t('business.results.source')" min-width="130" /><ElTableColumn
          :label="t('business.results.observed')"
          min-width="160"
          ><template #default="{ row }">{{ formatDate(row.observedAt) }}</template></ElTableColumn
        ></ElTable
      >
      <ElTable
        v-else-if="active === 'artifacts'"
        :data="jobs.results.artifacts.data.items"
        row-key="id"
        class="data-table"
        ><ElTableColumn prop="name" :label="t('business.results.name')" min-width="160" /><ElTableColumn
          prop="mediaType"
          :label="t('business.results.mediaType')"
          min-width="140"
        /><ElTableColumn :label="t('business.results.size')" min-width="100"
          ><template #default="{ row }">{{ bytes(row.size) }}</template></ElTableColumn
        ><ElTableColumn :label="t('business.results.status')" min-width="100"
          ><template #default="{ row }">{{
            t(`business.artifactStatus.${row.status}`)
          }}</template></ElTableColumn
        ><ElTableColumn
          prop="hash"
          :label="t('business.results.hash')"
          min-width="120"
          show-overflow-tooltip
        /><ElTableColumn :label="t('business.results.created')" min-width="160"
          ><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></ElTableColumn
        ><ElTableColumn :label="t('business.results.actions')" width="100"
          ><template #default="{ row }"
            ><ElButton
              text
              :disabled="!jobs.scanAvailable || row.status !== 'available'"
              @click="jobs.exportResult(row.id)"
              >{{ t('business.action.export') }}</ElButton
            ></template
          ></ElTableColumn
        ></ElTable
      >
      <ElTable v-else :data="jobs.results.audit.data.items" row-key="id" class="data-table"
        ><ElTableColumn :label="t('business.results.created')" min-width="160"
          ><template #default="{ row }">{{ formatDate(row.createdAt) }}</template></ElTableColumn
        ><ElTableColumn prop="actor" :label="t('business.results.actor')" min-width="120" /><ElTableColumn
          prop="entry"
          :label="t('business.results.entry')"
          min-width="120" /><ElTableColumn
          prop="action"
          :label="t('business.results.action')"
          min-width="120" /><ElTableColumn
          prop="result"
          :label="t('business.results.outcome')"
          min-width="120" /><ElTableColumn
          prop="requestId"
          :label="t('business.results.correlation')"
          min-width="160"
      /></ElTable>
    </div>
    <footer class="toolbar result-footer">
      <span class="muted">{{
        jobs.results[active].status === 'ready'
          ? t('business.results.total', { count: jobs.results[active].data.total })
          : t('business.results.noSnapshot')
      }}</span
      ><ElPagination
        v-if="jobs.results[active].status === 'ready'"
        layout="prev, pager, next"
        :current-page="jobs.results[active].data.page"
        :page-size="jobs.results[active].data.pageSize"
        :total="jobs.results[active].data.total"
        @current-change="jobs.loadResult(active, $event)"
      /><ElButton
        v-if="active === 'assets'"
        text
        :disabled="!jobs.scanAvailable || jobs.results.assets.status !== 'ready'"
        :title="!jobs.scanAvailable ? t('business.state.unavailableDescription') : ''"
        @click="jobs.exportResult()"
        >{{ t('business.results.exportAssets') }}</ElButton
      >
    </footer>
  </section>
</template>
