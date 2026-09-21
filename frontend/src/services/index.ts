import type { DomainError, FrontendServices, Page, QueryState } from './types'
export const unavailableError = (): DomainError => ({
  code: 'service.unavailable',
  messageKey: 'business.state.unavailable',
  detail: {},
  requestId: '',
  retryable: false,
})
const unavailable = async (): Promise<never> => {
  throw unavailableError()
}
export function createUnavailableServices(): FrontendServices {
  return {
    jobs: { available: false, list: unavailable, get: unavailable, cancel: unavailable },
    recon: {
      available: false,
      connectors: unavailable,
      profiles: unavailable,
      start: unavailable,
      assets: unavailable,
      services: unavailable,
      artifacts: unavailable,
      audit: unavailable,
      exportArtifact: unavailable,
      exportAssets: unavailable,
    },
  }
}
let services = createUnavailableServices()
export function configureServices(next: FrontendServices) {
  services = next
}
export function getServices() {
  return services
}
export function normalizeError(value: unknown): DomainError {
  if (value && typeof value === 'object' && 'code' in value && 'messageKey' in value) {
    const item = value as Partial<DomainError>
    return {
      code: String(item.code),
      messageKey: String(item.messageKey),
      detail: item.detail && typeof item.detail === 'object' ? item.detail : {},
      requestId: typeof item.requestId === 'string' ? item.requestId : '',
      retryable: item.retryable === true,
    }
  }
  return {
    code: 'service.failed',
    messageKey: 'business.state.error',
    detail: {},
    requestId: '',
    retryable: true,
  }
}
export function emptyPage<T>(page = 1): Page<T> {
  return { items: [], total: 0, page, pageSize: 20 }
}
export function queryState<T>(data: T): QueryState<T> {
  return { status: 'context', data, error: null }
}
export function setQueryError<T>(state: QueryState<T>, error: unknown) {
  state.error = normalizeError(error)
  state.status = state.error.code === 'service.unavailable' ? 'unavailable' : 'error'
}
