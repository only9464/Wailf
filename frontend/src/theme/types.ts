export type PlatformId = 'windows' | 'darwin' | 'linux' | 'android' | 'ios' | 'web' | 'unknown'
export type PlatformResourceId = `platform.${Exclude<PlatformId, 'web' | 'unknown'>}`
export interface PlatformHooks {
  material: 'acrylic' | 'none'
  rootBackground: 'transparent' | 'opaque'
  safeArea: 'env' | 'none'
  titlebar: 'native' | 'custom' | 'none'
  draggable: boolean
  motion: 'system' | 'reduced'
}
export interface PlatformDescriptor {
  id: PlatformId
  rawOS: string | null
  labelKey: string
  source: 'wails' | 'browser' | 'fallback'
  runtimeMode: 'desktop' | 'mobile' | 'server' | 'browser' | 'unknown'
  formFactor: 'desktop' | 'mobile' | 'unknown'
  tokenSetId: 'default' | PlatformResourceId
  resourceIds: readonly PlatformResourceId[]
  hooks: PlatformHooks
}
export interface TokenGradient {
  kind: 'linear'
  angle: number
  stops: readonly { color: string; position: number }[]
}
export type TokenValue = string | number | TokenGradient
export interface ThemeDefinition {
  version: 1
  id: string
  name: string
  base: 'platform' | 'default'
  tokens: Record<string, TokenValue>
}
export interface ThemeSelection {
  version: 1
  mode: 'platform' | 'custom'
  customId: string | null
}
export interface ThemeBundle {
  kind: 'wailf-theme-bundle'
  version: 1
  themes: ThemeDefinition[]
}
export interface ThemeImportResult {
  acceptedIds: string[]
  rejectedIds: string[]
  conflictIds: string[]
  committed: boolean
  usedFallback: boolean
  diagnostics: string[]
}
export interface ThemeExportResult {
  payload: string | null
  usedFallback: boolean
  diagnostics: string[]
}
export interface PlatformDetectionResult {
  platform: PlatformDescriptor
  usedFallback: boolean
  diagnostics: string[]
}
export interface ThemeInitResult extends PlatformDetectionResult {
  source: 'platform' | 'custom' | 'fallback'
}
export interface ResolvedTheme {
  tokens: Record<string, TokenValue>
  userTokens: Record<string, TokenValue>
  hooks: PlatformHooks
  base: 'platform' | 'default'
  platform: PlatformDescriptor
}
