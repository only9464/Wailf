/** Domain summaries used by the frontend adapter. They are not a wire protocol. */
export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled' | 'interrupted'
export const JOB_STATUSES: JobStatus[] = [
  'queued',
  'running',
  'succeeded',
  'failed',
  'cancelled',
  'interrupted',
]
export interface DomainError {
  code: string
  messageKey: string
  detail: Record<string, unknown>
  requestId: string
  retryable: boolean
}
export interface Page<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
}
export interface ListQuery {
  page: number
  pageSize: number
  sort: string
  direction: 'asc' | 'desc'
}
export interface JobSummary {
  id: string
  domain: string
  type: string
  status: JobStatus
  progress: number | null
  requestSummary: string
  createdAt: string
  updatedAt: string
  error?: DomainError
}
export interface AssetSummary {
  id: string
  kind: string
  value: string
  source: string
  tags: string[]
  lastSeenAt: string
}
export interface ServiceSummary {
  id: string
  assetValue: string
  port: number
  protocol: string
  service: string
  source: string
  observedAt: string
}
export interface ArtifactSummary {
  id: string
  name: string
  mediaType: string
  size: number
  hash: string
  source: string
  status: 'writing' | 'available' | 'expired' | 'deleted' | 'quarantined'
  createdAt: string
}
export interface AuditSummary {
  id: string
  actor: string
  entry: string
  action: string
  result: string
  createdAt: string
  requestId: string
}
export interface ConnectorSummary {
  id: string
  name: string
  version: string
  status: 'healthy' | 'unhealthy' | 'unknown'
  inputKinds: Array<'text' | 'assets'>
  profileIds: string[]
}
export interface ScanProfile {
  id: string
  name: string
  description: string
}
export interface StartScanInput {
  targets: string[]
  assetIds: string[]
  profileId: string
  connectorId: string
}
export interface JobQuery extends ListQuery {
  status?: JobStatus
}
export interface ResultQuery extends ListQuery {
  jobId: string
}
export type QueryStatus = 'context' | 'loading' | 'ready' | 'empty' | 'unavailable' | 'error'
export interface QueryState<T> {
  status: QueryStatus
  data: T
  error: DomainError | null
}
export interface JobService {
  available: boolean
  list(query: JobQuery): Promise<Page<JobSummary>>
  get(jobId: string): Promise<JobSummary>
  cancel(jobId: string): Promise<void>
}
export interface ReconService {
  available: boolean
  connectors(query: ListQuery): Promise<Page<ConnectorSummary>>
  profiles(query: ListQuery): Promise<Page<ScanProfile>>
  start(input: StartScanInput): Promise<JobSummary>
  assets(query: ResultQuery): Promise<Page<AssetSummary>>
  services(query: ResultQuery): Promise<Page<ServiceSummary>>
  artifacts(query: ResultQuery): Promise<Page<ArtifactSummary>>
  audit(query: ResultQuery): Promise<Page<AuditSummary>>
  exportArtifact(artifactId: string): Promise<void>
  exportAssets(query: ResultQuery): Promise<void>
}
export interface FrontendServices {
  jobs: JobService
  recon: ReconService
}
