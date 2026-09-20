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
  TargetScope,
} from '../services/types'
import { useScopeStore } from './scopes'
import { useJobsStore } from './jobs'
import PortScanView from '../views/PortScanView.vue'
import ResultViews from '../components/business/ResultViews.vue'
import ScopePanel from '../components/panels/ScopePanel.vue'
import TaskPanel from '../components/panels/TaskPanel.vue'
import en from '../i18n/en-US/en-US.json'

const page = <T>(items: T[], pageNumber = 1): Page<T> => ({
  items,
  total: items.length,
  page: pageNumber,
  pageSize: 20,
})
const scope = (id: string): TargetScope => ({
  id,
  name: id,
  expressions: ['authorized.invalid'],
  authorization: 'Test approval',
  validFrom: '2020-01-01T00:00:00Z',
  expiresAt: '2999-01-01T00:00:00Z',
  riskLevel: 'L2',
  allowedOperations: ['recon.portscan'],
  status: 'active',
})
const job = (id: string, status: JobSummary['status'] = 'running'): JobSummary => ({
  id,
  targetScopeId: 'scope',
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
  value: `${id}.invalid`,
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
  services.scopes = {
    available: true,
    list: vi.fn(async () => page([scope('scope')])),
    create: vi.fn(async () => scope('created')),
  }
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
const scopeDraft = () => ({
  name: 'Created',
  expressions: 'host.invalid',
  authorization: 'approved',
  validFrom: '2026-01-01T00:00',
  expiresAt: '2999-01-01T00:00',
  allowedOperations: 'recon.portscan',
})
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
  const scopes = useScopeStore()
  const jobs = useJobsStore()
  await flushPromises()
  scopes.select('scope')
  Object.assign(jobs.scanDraft, {
    targets: 'authorized.invalid',
    connectorId: 'connector',
    profileId: 'profile',
    reason: 'approved',
    confirmed: true,
  })
  return { scopes, jobs }
}

beforeEach(() => {
  setActivePinia(createPinia())
  configureServices(createUnavailableServices())
})

describe('unavailable service boundary', () => {
  it('starts empty and rejects commands without inventing business records', async () => {
    const services = createUnavailableServices()
    await expect(services.jobs.cancel('job')).rejects.toMatchObject({ code: 'service.unavailable' })
    const scopes = useScopeStore()
    const jobs = useJobsStore()
    await flushPromises()
    expect(scopes.scopes.status).toBe('unavailable')
    expect(scopes.scopes.data.items).toEqual([])
    expect(jobs.list.status).toBe('unavailable')
    expect(jobs.results.assets.status).toBe('unavailable')
    expect(jobs.canSubmit).toBe(false)
  })

  it('keeps an editable scan draft while submit remains disabled', async () => {
    const wrapper = mount(PortScanView, { global: { plugins: [i18n()], stubs: { RouterLink: true } } })
    const textarea = wrapper.find('textarea')
    await textarea.setValue('authorized.invalid')
    await nextTick()
    expect(useJobsStore().scanDraft.targets).toBe('authorized.invalid')
    expect(wrapper.find('button[type="submit"]').attributes('disabled')).toBeDefined()
    expect(wrapper.text()).toContain('Service not connected')
    wrapper.unmount()
  })
})

describe('global scope and job stores', () => {
  it('loads global jobs without an active scope and preserves them when scope changes', async () => {
    const services = connected()
    services.scopes.list = vi.fn(async () => page([scope('scope'), scope('second')]))
    configureServices(services)
    const jobs = useJobsStore()
    const scopes = useScopeStore()
    await flushPromises()
    expect(scopes.scopeId).toBe('')
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
    jobs.scanDraft.targets = 'authorized.invalid'
    jobs.scanDraft.confirmed = true
    scopes.select('second')
    expect(jobs.scanDraft.targets).toBe('authorized.invalid')
    expect(jobs.scanDraft.confirmed).toBe(false)
    expect(jobs.detail.data?.id).toBe('a')
    expect(jobs.selectedJobId).toBe('a')
  })

  it('rejects invalid scope drafts without sending a command', async () => {
    const services = connected()
    configureServices(services)
    const scopes = useScopeStore()
    Object.assign(scopes.draft, scopeDraft(), { expiresAt: '2025-01-01T00:00' })
    await scopes.create()
    expect(services.scopes.create).not.toHaveBeenCalled()
    expect(scopes.saveError?.code).toBe('scope.invalid')
    expect(scopes.draft.name).toBe('Created')
  })

  it('retains selected scope in the Element Plus selector when paging past it', async () => {
    const services = connected()
    configureServices(services)
    const scopes = useScopeStore()
    scopes.initialize()
    await flushPromises()
    scopes.select('scope')
    services.scopes.list = vi.fn(async () => page([scope('other')], 2))
    await scopes.load(2)
    const wrapper = mount(ScopePanel, { global: { plugins: [i18n()] } })
    await nextTick()
    expect(scopes.options.map((item) => item.id)).toEqual(['scope', 'other'])
    expect(scopes.scopeId).toBe('scope')
    wrapper.unmount()
  })

  it('does not select a saved scope after the user changes selection and returns', async () => {
    const services = connected()
    const pending = deferred<TargetScope>()
    services.scopes.list = vi.fn(async () => page([scope('scope'), scope('other')]))
    services.scopes.create = vi.fn(() => pending.promise)
    configureServices(services)
    const scopes = useScopeStore()
    await scopes.load()
    scopes.select('scope')
    Object.assign(scopes.draft, scopeDraft())
    const request = scopes.create()
    scopes.select('other')
    scopes.select('scope')
    scopes.draft.name = 'A newer draft'
    pending.resolve(scope('created'))
    await request
    expect(scopes.scopeId).toBe('scope')
    expect(scopes.draft.name).toBe('A newer draft')
  })

  it('ignores an old scope response after a newer list request', async () => {
    const services = connected()
    const old = deferred<Page<TargetScope>>()
    services.scopes.list = vi.fn((query) =>
      query.page === 1 ? old.promise : Promise.resolve(page([scope('new')], 2)),
    )
    configureServices(services)
    const scopes = useScopeStore()
    const first = scopes.load(1)
    const second = scopes.load(2)
    await second
    old.resolve(page([scope('old')]))
    await first
    expect(scopes.scopes.data.items.map((item) => item.id)).toEqual(['new'])
    expect(scopes.scopes.data.page).toBe(2)
  })

  it('creates a global scope and selects the returned scope', async () => {
    const services = connected()
    services.scopes.create = vi.fn(async (input) => ({ ...scope('created'), name: input.name }))
    configureServices(services)
    const scopes = useScopeStore()
    await scopes.load()
    Object.assign(scopes.draft, {
      name: 'Created',
      expressions: 'host.invalid',
      authorization: 'approved',
      validFrom: '2026-01-01T00:00',
      expiresAt: '2999-01-01T00:00',
      allowedOperations: 'recon.portscan',
    })
    await scopes.create()
    expect(services.scopes.create).toHaveBeenCalledWith({
      name: 'Created',
      expressions: ['host.invalid'],
      authorization: 'approved',
      validFrom: new Date('2026-01-01T00:00').toISOString(),
      expiresAt: new Date('2999-01-01T00:00').toISOString(),
      riskLevel: 'L2',
      allowedOperations: ['recon.portscan'],
    })
    expect(scopes.scopeId).toBe('created')
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

describe('commands and cancellation', () => {
  it.each(['revoked', 'expired', 'future', 'operation'] as const)(
    'requires an active authorized scope (%s)',
    async (condition) => {
      const { scopes, jobs } = await readyScan(connected())
      const selected = scopes.currentScope!
      if (condition === 'revoked') selected.status = 'revoked'
      if (condition === 'expired') selected.expiresAt = '2000-01-01T00:00:00Z'
      if (condition === 'future') selected.validFrom = '2998-01-01T00:00:00Z'
      if (condition === 'operation') selected.allowedOperations = ['inventory.read']
      expect(jobs.canSubmit).toBe(false)
    },
  )

  it('rechecks expiry when submitting even if the eligibility value was cached', async () => {
    const services = connected()
    const { scopes, jobs } = await readyScan(services)
    scopes.currentScope!.expiresAt = new Date(Date.now() + 1000).toISOString()
    expect(jobs.canSubmit).toBe(true)
    vi.spyOn(Date, 'now').mockReturnValue(Date.now() + 2000)
    await jobs.submitScan()
    expect(services.recon.start).not.toHaveBeenCalled()
  })

  it('keeps a different task opened while submission was pending', async () => {
    const services = connected()
    const pending = deferred<JobSummary>()
    services.recon.start = vi.fn(() => pending.promise)
    const { jobs } = await readyScan(services)
    const request = jobs.submitScan()
    await jobs.loadDetail('other')
    await jobs.loadResults('other')
    pending.resolve(job('submitted', 'queued'))
    await request
    expect(jobs.detail.data?.id).toBe('other')
    expect(jobs.selectedJobId).toBe('other')
    expect(jobs.feedback).toBe('business.scan.submitted')
  })

  it('invalidates authorization confirmation on any scan draft change', async () => {
    const { jobs } = await readyScan(connected())
    expect(jobs.canSubmit).toBe(true)
    jobs.scanDraft.targets = 'changed.invalid'
    expect(jobs.scanDraft.confirmed).toBe(false)
    expect(jobs.canSubmit).toBe(false)
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

  it('ignores a pending command failure after the user changes the scope', async () => {
    const services = connected()
    const pending = deferred<void>()
    services.jobs.cancel = vi.fn(() => pending.promise)
    const { scopes, jobs } = await readyScan(services)
    await jobs.loadDetail('a')
    const request = jobs.cancel('a')
    scopes.select('')
    pending.reject(new Error('old cancellation'))
    await request
    expect(jobs.commandError).toBeNull()
    expect(jobs.detail.data?.id).toBe('a')
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
  it('sends a global scan request with only the selected scope', async () => {
    const services = connected()
    services.recon.connectors = vi.fn(async () =>
      page([
        {
          id: 'connector',
          name: 'Test',
          version: '1',
          status: 'healthy' as const,
          inputKinds: ['text'] as Array<'text' | 'assets'>,
          profileIds: ['profile'],
        },
      ]),
    )
    services.recon.profiles = vi.fn(async () => page([{ id: 'profile', name: 'Profile', description: '' }]))
    configureServices(services)
    const scopes = useScopeStore()
    await scopes.load()
    scopes.select('scope')
    const jobs = useJobsStore()
    await flushPromises()
    Object.assign(jobs.scanDraft, {
      targets: 'authorized.invalid',
      connectorId: 'connector',
      profileId: 'profile',
      reason: 'approved',
      confirmed: true,
    })
    expect(jobs.canSubmit).toBe(true)
    await jobs.submitScan()
    expect(services.recon.start).toHaveBeenCalledWith({
      targetScopeId: 'scope',
      targets: ['authorized.invalid'],
      assetIds: [],
      profileId: 'profile',
      connectorId: 'connector',
      confirmation: { confirmed: true, reason: 'approved' },
    })
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
      throw { code: 'scope.expired', messageKey: 'business.state.error', retryable: false }
    })
    configureServices(services)
    const jobs = useJobsStore()
    await jobs.loadDetail('a')
    await jobs.cancel('a')
    expect(jobs.detail.data?.status).toBe('running')
    expect(jobs.commandError?.code).toBe('scope.expired')
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
    expect(wrapper.text()).toContain('visible-host.invalid')
    await wrapper.findAll('.el-tabs__item')[1]!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('Unable to load')
    await wrapper.findAll('.el-tabs__item')[2]!.trigger('click')
    await nextTick()
    expect(wrapper.text()).toContain('No records yet')
    wrapper.unmount()
  })
})
