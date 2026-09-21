import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { createI18n } from 'vue-i18n'
import { configureServices, createUnavailableServices, emptyPage } from '../services'
import type {
  AssetSummary,
  AuditSummary,
  ArtifactSummary,
  ConnectorSummary,
  FrontendServices,
  JobSummary,
  Page,
  ScanProfile,
  ServiceSummary,
} from '../services/types'
import { useJobsStore } from './jobs'
import PortScanView from '../views/recon/PortScanView.vue'
import ResultViews from '../components/business/ResultViews.vue'
import TaskPanel from '../components/panels/TaskPanel.vue'
import en from '../i18n/en-US/en-US.json'

const page = <T>(items: T[], pageNumber = 1): Page<T> => ({
  items,
  total: items.length,
  page: pageNumber,
  pageSize: 20,
})

const job = (id: string, status: JobSummary['status'] = 'running'): JobSummary => ({
  id,
  domain: 'recon',
  type: 'portscan',
  status,
  progress: 42,
  requestSummary: id,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
})

const asset = (id: string): AssetSummary => ({
  id,
  kind: 'host',
  value: `${id}.test`,
  source: 'test adapter',
  tags: ['fixture'],
  lastSeenAt: '2026-01-01T00:00:00Z',
})

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason: unknown) => void
  const promise = new Promise<T>((yes, no) => {
    resolve = yes
    reject = no
  })
  return { promise, resolve, reject }
}

function connected(): FrontendServices {
  const services = createUnavailableServices()
  services.jobs = {
    available: true,
    list: vi.fn(async () => page([job('a')])),
    get: vi.fn(async (id: string) => job(id)),
    cancel: vi.fn(async () => undefined),
  }
  services.recon = {
    ...services.recon,
    available: true,
    connectors: vi.fn(async () => emptyPage<ConnectorSummary>()),
    profiles: vi.fn(async () => emptyPage<ScanProfile>()),
    start: vi.fn(async () => job('submitted', 'queued')),
    assets: vi.fn(async () => emptyPage<AssetSummary>()),
    services: vi.fn(async () => emptyPage<ServiceSummary>()),
    artifacts: vi.fn(async () => emptyPage<ArtifactSummary>()),
    audit: vi.fn(async () => emptyPage<AuditSummary>()),
  }
  return services
}

function i18n() {
  return createI18n({ legacy: false, locale: 'en-US', fallbackLocale: 'en-US', messages: { 'en-US': en } })
}

function enableScan(services: FrontendServices) {
  services.recon.connectors = vi.fn(async () =>
    page<ConnectorSummary>([
      {
        id: 'connector',
        name: 'Test connector',
        version: '1',
        status: 'healthy',
        inputKinds: ['text'],
        profileIds: ['profile'],
      },
    ]),
  )
  services.recon.profiles = vi.fn(async () => page([{ id: 'profile', name: 'Profile', description: '' }]))
}

async function readyScan(services: FrontendServices) {
  enableScan(services)
  configureServices(services)
  const jobs = useJobsStore()
  await flushPromises()
  Object.assign(jobs.scanDraft, {
    targets: 'example.test',
    connectorId: 'connector',
    profileId: 'profile',
  })
  await nextTick()
  return jobs
}

beforeEach(() => {
  setActivePinia(createPinia())
  configureServices(createUnavailableServices())
})

describe('unavailable service boundary', () => {
  it('starts empty and rejects commands without inventing business records', async () => {
    const services = createUnavailableServices()
    await expect(services.jobs.cancel('job')).rejects.toMatchObject({ code: 'service.unavailable' })
    const jobs = useJobsStore()
    await flushPromises()
    expect(jobs.list.status).toBe('unavailable')
    expect(jobs.results.assets.status).toBe('unavailable')
    expect(jobs.canSubmit).toBe(false)
  })

  it('keeps an editable scan draft while submit remains disabled', async () => {
    const wrapper = mount(PortScanView, { global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('example.test')
    await nextTick()
    expect(useJobsStore().scanDraft.targets).toBe('example.test')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Service not connected')
    wrapper.unmount()
  })
})

describe('global job store', () => {
  it('loads jobs without a context selection', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    expect(jobs.list.data.items[0]?.id).toBe('a')
    expect(services.jobs.list).toHaveBeenCalledWith({
      page: 1,
      pageSize: 20,
      sort: 'createdAt',
      direction: 'desc',
      status: undefined,
    })
    await jobs.loadDetail('a')
    await jobs.loadResults('a')
    expect(jobs.detail.data?.id).toBe('a')
    expect(jobs.selectedJobId).toBe('a')
  })

  it('keeps the newest global job list when responses arrive out of order', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const old = deferred<Page<JobSummary>>()
    const latest = deferred<Page<JobSummary>>()
    services.jobs.list = vi.fn().mockReturnValueOnce(old.promise).mockReturnValueOnce(latest.promise)
    const first = jobs.refresh()
    const second = jobs.refresh()
    latest.resolve(page([job('latest', 'cancelled')]))
    await second
    old.resolve(page([job('old')]))
    await first
    expect(jobs.list.data.items[0]?.id).toBe('latest')
    expect(jobs.list.data.items[0]?.status).toBe('cancelled')
  })

  it('does not apply an old result after the selected job changes', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const old = deferred<Page<AssetSummary>>()
    services.recon.assets = vi.fn((query) =>
      query.jobId === 'old' ? old.promise : Promise.resolve(page([asset('new')])),
    )
    const first = jobs.loadResults('old')
    await jobs.loadResults('new')
    old.resolve(page([asset('old')]))
    await first
    expect(jobs.results.assets.data.items[0]?.id).toBe('new')
  })

  it('discards an old failed list request after a filter changes', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const old = deferred<Page<JobSummary>>()
    services.jobs.list = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page([job('finished', 'succeeded')]))
    const request = jobs.refresh()
    jobs.filters.status = 'succeeded'
    await jobs.refresh()
    old.reject(new Error('old failure'))
    await request
    expect(jobs.list.status).toBe('ready')
    expect(jobs.list.error).toBeNull()
    expect(jobs.list.data.items[0]?.id).toBe('finished')
    expect(services.jobs.list).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'succeeded' }))
  })

  it('discards a failed result request from an earlier task selection', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const old = deferred<Page<AssetSummary>>()
    services.recon.assets = vi
      .fn()
      .mockReturnValueOnce(old.promise)
      .mockResolvedValueOnce(page([asset('current')]))
    const request = jobs.loadResults('old')
    await jobs.loadResults('current')
    old.reject(new Error('old failure'))
    await request
    expect(jobs.results.assets.status).toBe('ready')
    expect(jobs.results.assets.error).toBeNull()
    expect(jobs.results.assets.data.items[0]?.id).toBe('current')
  })
})

describe('scan commands and cancellation', () => {
  it('submits a scan without a context or confirmation payload', async () => {
    const services = connected()
    const jobs = await readyScan(services)
    expect(jobs.canSubmit).toBe(true)
    await jobs.submitScan()
    expect(services.recon.start).toHaveBeenCalledWith({
      targets: ['example.test'],
      assetIds: [],
      profileId: 'profile',
      connectorId: 'connector',
    })
  })

  it('keeps a different task opened while submission was pending', async () => {
    const services = connected()
    const pending = deferred<JobSummary>()
    services.recon.start = vi.fn(() => pending.promise)
    const jobs = await readyScan(services)
    const request = jobs.submitScan()
    await jobs.loadDetail('other')
    await jobs.loadResults('other')
    pending.resolve(job('submitted', 'queued'))
    await request
    expect(jobs.detail.data?.id).toBe('other')
    expect(jobs.selectedJobId).toBe('other')
    expect(jobs.feedback).toBe('business.scan.submitted')
  })

  it('retains a valid scan submission after editing the target draft', async () => {
    const services = connected()
    const jobs = await readyScan(services)
    jobs.scanDraft.targets = 'changed.test'
    await nextTick()
    expect(jobs.canSubmit).toBe(true)
    await jobs.submitScan()
    expect(services.recon.start).toHaveBeenCalledWith(expect.objectContaining({ targets: ['changed.test'] }))
  })

  it('refreshes actual task status after cancellation without assuming a terminal state', async () => {
    const services = connected()
    const pending = deferred<void>()
    services.jobs.cancel = vi.fn(() => pending.promise)
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    await jobs.loadDetail('a')
    const request = jobs.cancel('a')
    await jobs.cancel('a')
    expect(services.jobs.cancel).toHaveBeenCalledTimes(1)
    expect(jobs.detail.data?.status).toBe('running')
    pending.resolve()
    await request
    expect(services.jobs.cancel).toHaveBeenCalledWith('a')
    expect(jobs.detail.data?.status).toBe('running')
    expect(jobs.feedback).toBe('business.jobs.cancelRequested')
    expect(jobs.cancelling).toEqual([])
  })

  it('refreshes an in-flight task detail after cancellation and discards its old reply', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const beforeCancel = deferred<JobSummary>()
    services.jobs.get = vi
      .fn()
      .mockReturnValueOnce(beforeCancel.promise)
      .mockResolvedValueOnce(job('a', 'cancelled'))
    const request = jobs.loadDetail('a')
    await jobs.cancel('a')
    expect(jobs.detail.data?.status).toBe('cancelled')
    beforeCancel.resolve(job('a', 'running'))
    await request
    expect(jobs.detail.data?.status).toBe('cancelled')
    expect(services.jobs.get).toHaveBeenCalledTimes(2)
  })

  it('ignores cancellation errors after leaving and returning to the same task', async () => {
    const services = connected()
    const pending = deferred<void>()
    services.jobs.cancel = vi.fn(() => pending.promise)
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    await jobs.loadDetail('a')
    const request = jobs.cancel('a')
    await jobs.loadDetail('other')
    await jobs.loadDetail('a')
    pending.reject(new Error('old cancellation'))
    await request
    expect(jobs.commandError).toBeNull()
    expect(jobs.feedback).toBe('')
  })

  it('ignores export errors after changing result selection', async () => {
    const services = connected()
    const pending = deferred<void>()
    services.recon.exportAssets = vi.fn(() => pending.promise)
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    await jobs.loadResults('a')
    const request = jobs.exportResult()
    await jobs.loadResults('b')
    pending.reject(new Error('old export'))
    await request
    expect(jobs.commandError).toBeNull()
    expect(jobs.feedback).toBe('')
  })

  it('treats events as hints to query again instead of using event state', async () => {
    const services = connected()
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    const beforeEvent = deferred<JobSummary>()
    services.jobs.get = vi
      .fn()
      .mockReturnValueOnce(beforeEvent.promise)
      .mockResolvedValueOnce(job('a', 'succeeded'))
    const request = jobs.loadDetail('a')
    jobs.handleJobChanged({ jobId: 'a' })
    await flushPromises()
    beforeEvent.resolve(job('a', 'running'))
    await request
    expect(jobs.detail.data?.status).toBe('succeeded')
    expect(services.jobs.get).toHaveBeenCalledTimes(2)
  })

  it('does not publish cancellation feedback after the selected task changes', async () => {
    const services = connected()
    const pending = deferred<void>()
    services.jobs.cancel = vi.fn(() => pending.promise)
    configureServices(services)
    const jobs = useJobsStore()
    await flushPromises()
    await jobs.loadDetail('a')
    const request = jobs.cancel('a')
    await jobs.loadDetail('other')
    pending.resolve()
    await request
    expect(jobs.feedback).toBe('')
    expect(jobs.commandError).toBeNull()
    expect(jobs.detail.data?.id).toBe('other')
  })

  it('reports a failed cancellation without fabricating a terminal status', async () => {
    const services = connected()
    services.jobs.cancel = vi.fn(async () => {
      throw { code: 'service.failed', messageKey: 'business.state.error', retryable: false }
    })
    configureServices(services)
    const jobs = useJobsStore()
    await jobs.loadDetail('a')
    await jobs.cancel('a')
    expect(jobs.detail.data?.status).toBe('running')
    expect(jobs.commandError?.code).toBe('service.failed')
  })
})

describe('business views', () => {
  it('shows real cancellation feedback and retains server task progress in the task panel', async () => {
    const services = connected()
    configureServices(services)
    const wrapper = mount(TaskPanel, { global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    await flushPromises()
    const cancel = wrapper.findAll('button').find((item) => item.text() === en.business.jobs.cancel)!
    await cancel.trigger('click')
    await flushPromises()
    expect(wrapper.text()).toContain(en.business.jobs.cancelRequested)
    expect(wrapper.text()).toContain('42')
    expect(wrapper.find('[data-status="running"]').exists()).toBe(true)
    wrapper.unmount()
  })

  it('renders loading, error and empty result states through QueryFeedback', async () => {
    const services = connected()
    const pending = deferred<Page<AssetSummary>>()
    services.recon.assets = vi.fn(() => pending.promise)
    services.recon.services = vi.fn(async () => {
      throw { code: 'timeout', messageKey: 'business.state.error', retryable: true }
    })
    configureServices(services)
    const jobs = useJobsStore()
    const request = jobs.loadResults('job')
    const wrapper = mount(ResultViews, { global: { plugins: [i18n()] } })
    await nextTick()
    expect(wrapper.find('.ui-state-loading').exists()).toBe(true)
    pending.resolve(page([asset('visible-host')]))
    await request
    await nextTick()
    expect(wrapper.text()).toContain('visible-host.test')
    await wrapper.findAll('.el-tabs__item')[1]!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Unable to load')
    await wrapper.findAll('.el-tabs__item')[2]!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('No records yet')
    wrapper.unmount()
  })
})
