import { computed, reactive, ref, watch } from 'vue'
import { defineStore } from 'pinia'
import { emptyPage, getServices, normalizeError, queryState, setQueryError } from '../services'
import type {
  ArtifactSummary,
  AssetSummary,
  AuditSummary,
  ConnectorSummary,
  DomainError,
  JobStatus,
  JobSummary,
  Page,
  QueryState,
  ScanProfile,
  ServiceSummary,
} from '../services/types'
type ResultKind = 'assets' | 'services' | 'artifacts' | 'audit'
const newDraft = () => ({
  inputKind: 'text' as 'text' | 'assets',
  targets: '',
  assetIds: '',
  connectorId: '',
  profileId: '',
})
export const useJobsStore = defineStore('jobs', () => {
  const list = reactive(queryState(emptyPage<JobSummary>()))
  const detail = reactive(queryState<JobSummary | null>(null))
  const filters = reactive({
    status: '' as JobStatus | '',
    page: 1,
    sort: 'createdAt',
    direction: 'desc' as 'asc' | 'desc',
  })
  const scanDraft = reactive(newDraft())
  const connectors = reactive(queryState(emptyPage<ConnectorSummary>()))
  const profiles = reactive(queryState(emptyPage<ScanProfile>()))
  const selectedJobId = ref(''),
    requestedDetailId = ref('')
  const results = reactive({
    assets: queryState(emptyPage<AssetSummary>()),
    services: queryState(emptyPage<ServiceSummary>()),
    artifacts: queryState(emptyPage<ArtifactSummary>()),
    audit: queryState(emptyPage<AuditSummary>()),
  })
  const cancelling = ref<string[]>([]),
    submitting = ref(false),
    commandError = ref<DomainError | null>(null),
    feedback = ref('')
  const available = computed(() => getServices().jobs.available),
    scanAvailable = computed(() => getServices().recon.available)
  let listGeneration = 0,
    detailGeneration = 0,
    optionGeneration = 0,
    contextGeneration = 0,
    resultSelectionGeneration = 0,
    initialized = false
  const resultGenerations: Record<ResultKind, number> = { assets: 0, services: 0, artifacts: 0, audit: 0 }
  const activeConnector = computed(() =>
    connectors.data.items.find((item) => item.id === scanDraft.connectorId),
  )
  const availableProfiles = computed(() =>
    profiles.data.items.filter((item) => activeConnector.value?.profileIds.includes(item.id)),
  )
  const canSubmit = computed(
    () =>
      scanAvailable.value &&
      activeConnector.value?.status === 'healthy' &&
      !!activeConnector.value.inputKinds.includes(scanDraft.inputKind) &&
      availableProfiles.value.some((item) => item.id === scanDraft.profileId) &&
      !!(scanDraft.inputKind === 'text' ? scanDraft.targets.trim() : scanDraft.assetIds.trim()) &&
      !submitting.value,
  )
  function noContext<T>(state: QueryState<T>, connected: boolean) {
    state.status = connected ? 'context' : 'unavailable'
    state.error = null
  }
  async function refresh() {
    const generation = ++listGeneration
    list.status = 'loading'
    list.error = null
    list.data = emptyPage(filters.page)
    try {
      const data = await getServices().jobs.list({
        page: filters.page,
        pageSize: 20,
        sort: filters.sort,
        direction: filters.direction,
        status: filters.status || undefined,
      })
      if (generation !== listGeneration) return
      list.data = data
      list.status = data.items.length ? 'ready' : 'empty'
    } catch (error) {
      if (generation === listGeneration) setQueryError(list, error)
    }
  }
  async function loadDetail(jobId: string) {
    const generation = ++detailGeneration
    requestedDetailId.value = jobId
    detail.data = null
    detail.error = null
    if (!jobId) {
      noContext(detail, available.value)
      return
    }
    detail.status = 'loading'
    try {
      const data = await getServices().jobs.get(jobId)
      if (generation !== detailGeneration || requestedDetailId.value !== jobId) return
      if (data.id !== jobId)
        throw { code: 'job.mismatch', messageKey: 'business.state.error', retryable: false }
      detail.data = data
      detail.status = 'ready'
    } catch (error) {
      if (generation === detailGeneration) setQueryError(detail, error)
    }
  }
  async function loadScanOptions() {
    const generation = ++optionGeneration
    connectors.data = emptyPage()
    profiles.data = emptyPage()
    connectors.error = null
    profiles.error = null
    if (!scanAvailable.value) {
      noContext(connectors, false)
      noContext(profiles, false)
      return
    }
    connectors.status = 'loading'
    profiles.status = 'loading'
    const query = { page: 1, pageSize: 100, sort: 'name', direction: 'asc' as const }
    const [a, b] = await Promise.allSettled([
      getServices().recon.connectors(query),
      getServices().recon.profiles(query),
    ])
    if (generation !== optionGeneration) return
    if (a.status === 'fulfilled') {
      connectors.data = a.value
      connectors.status = a.value.items.length ? 'ready' : 'empty'
    } else setQueryError(connectors, a.reason)
    if (b.status === 'fulfilled') {
      profiles.data = b.value
      profiles.status = b.value.items.length ? 'ready' : 'empty'
    } else setQueryError(profiles, b.reason)
  }
  async function loadResult(kind: ResultKind, page = 1) {
    const generation = ++resultGenerations[kind],
      jobId = selectedJobId.value
    const state = results[kind] as QueryState<
      Page<AssetSummary | ServiceSummary | ArtifactSummary | AuditSummary>
    >
    state.data = emptyPage(page)
    state.error = null
    if (!jobId) {
      noContext(state, scanAvailable.value)
      return
    }
    state.status = 'loading'
    try {
      const data = await getServices().recon[kind]({
        jobId,
        page,
        pageSize: 20,
        sort: kind === 'assets' ? 'lastSeenAt' : kind === 'services' ? 'observedAt' : 'createdAt',
        direction: 'desc',
      })
      if (generation !== resultGenerations[kind] || jobId !== selectedJobId.value) return
      state.data = data
      state.status = data.items.length ? 'ready' : 'empty'
    } catch (error) {
      if (generation === resultGenerations[kind]) setQueryError(state, error)
    }
  }
  async function loadResults(jobId: string) {
    ++resultSelectionGeneration
    selectedJobId.value = jobId
    await Promise.all((Object.keys(results) as ResultKind[]).map((kind) => loadResult(kind)))
  }
  async function cancel(jobId: string) {
    if (!jobId || cancelling.value.includes(jobId)) return
    const generation = contextGeneration
    const detailAt = detailGeneration
    const resultAt = resultSelectionGeneration
    const filtersAt = JSON.stringify(filters)
    const isCurrent = () =>
      generation === contextGeneration &&
      detailAt === detailGeneration &&
      resultAt === resultSelectionGeneration &&
      filtersAt === JSON.stringify(filters)
    cancelling.value.push(jobId)
    commandError.value = null
    feedback.value = ''
    try {
      await getServices().jobs.cancel(jobId)
      if (!isCurrent()) return
      feedback.value = 'business.jobs.cancelRequested'
      await Promise.all([
        refresh(),
        requestedDetailId.value === jobId ? loadDetail(jobId) : Promise.resolve(),
      ])
    } catch (error) {
      if (isCurrent()) commandError.value = normalizeError(error)
    } finally {
      cancelling.value = cancelling.value.filter((item) => item !== jobId)
    }
  }
  async function submitScan() {
    if (!canSubmit.value) return
    const generation = contextGeneration,
      detailAt = detailGeneration,
      resultsAt = resultSelectionGeneration
    submitting.value = true
    commandError.value = null
    feedback.value = ''
    try {
      const split = (v: string) =>
        v
          .split(/[\n,]+/)
          .map((x) => x.trim())
          .filter(Boolean)
      const job = await getServices().recon.start({
        targets: scanDraft.inputKind === 'text' ? split(scanDraft.targets) : [],
        assetIds: scanDraft.inputKind === 'assets' ? split(scanDraft.assetIds) : [],
        profileId: scanDraft.profileId,
        connectorId: scanDraft.connectorId,
      })
      if (generation !== contextGeneration) return
      feedback.value = 'business.scan.submitted'
      const unchanged = detailAt === detailGeneration && resultsAt === resultSelectionGeneration
      await Promise.all([refresh(), ...(unchanged ? [loadDetail(job.id), loadResults(job.id)] : [])])
    } catch (error) {
      if (generation === contextGeneration) commandError.value = normalizeError(error)
    } finally {
      submitting.value = false
    }
  }
  async function exportResult(artifactId?: string) {
    if (!selectedJobId.value) return
    const generation = contextGeneration
    const selection = resultSelectionGeneration
    const isCurrent = () => generation === contextGeneration && selection === resultSelectionGeneration
    commandError.value = null
    feedback.value = ''
    try {
      if (artifactId) await getServices().recon.exportArtifact(artifactId)
      else
        await getServices().recon.exportAssets({
          jobId: selectedJobId.value,
          page: results.assets.data.page,
          pageSize: results.assets.data.pageSize,
          sort: 'lastSeenAt',
          direction: 'desc',
        })
      if (isCurrent()) feedback.value = 'business.results.exported'
    } catch (error) {
      if (isCurrent()) commandError.value = normalizeError(error)
    }
  }
  function handleJobChanged(event: { jobId: string }) {
    void refresh()
    if (requestedDetailId.value === event.jobId) void loadDetail(event.jobId)
    if (selectedJobId.value === event.jobId) void loadResults(event.jobId)
  }
  function initialize() {
    if (initialized) return
    initialized = true
    void refresh()
    void loadScanOptions()
    void loadResults('')
  }
  watch(
    () => scanDraft.connectorId,
    () => {
      scanDraft.profileId = ''
    },
    { flush: 'sync' },
  )
  watch(
    () => [scanDraft.targets, scanDraft.assetIds, scanDraft.inputKind, scanDraft.profileId],
    () => {
      ++contextGeneration
      commandError.value = null
      feedback.value = ''
    },
    { flush: 'sync' },
  )
  initialize()
  return {
    list,
    detail,
    filters,
    scanDraft,
    connectors,
    profiles,
    availableProfiles,
    activeConnector,
    selectedJobId,
    results,
    cancelling,
    submitting,
    commandError,
    feedback,
    available,
    scanAvailable,
    canSubmit,
    initialize,
    refresh,
    loadDetail,
    loadScanOptions,
    loadResults,
    loadResult,
    cancel,
    submitScan,
    exportResult,
    handleJobChanged,
  }
})
