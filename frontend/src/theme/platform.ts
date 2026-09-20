import { isRecord } from './tokenRegistry'
import type { PlatformDescriptor, PlatformId, PlatformResourceId, TokenValue } from './types'

const nativeIds = ['windows', 'darwin', 'linux', 'android', 'ios'] as const
function descriptor(id: PlatformId): PlatformDescriptor {
  const native = nativeIds.includes(id as (typeof nativeIds)[number])
  const mobile = id === 'android' || id === 'ios'
  return {
    id,
    rawOS: null,
    labelKey: `platform.${id}`,
    source: native ? 'wails' : id === 'web' ? 'browser' : 'fallback',
    runtimeMode: native ? (mobile ? 'mobile' : 'desktop') : id === 'web' ? 'browser' : 'unknown',
    formFactor: native ? (mobile ? 'mobile' : 'desktop') : 'unknown',
    tokenSetId: native ? (`platform.${id}` as PlatformResourceId) : 'default',
    resourceIds: native ? [`platform.${id}` as PlatformResourceId] : [],
    hooks: {
      material: id === 'windows' ? 'acrylic' : 'none',
      rootBackground: id === 'windows' ? 'transparent' : 'opaque',
      safeArea: mobile ? 'env' : 'none',
      titlebar: id === 'darwin' ? 'custom' : native && !mobile ? 'native' : 'none',
      draggable: id === 'darwin',
      motion: 'system',
    },
  }
}
export const platforms: Record<PlatformId, PlatformDescriptor> = Object.fromEntries(
  [...nativeIds, 'web', 'unknown'].map((id) => [id, descriptor(id as PlatformId)]),
) as Record<PlatformId, PlatformDescriptor>
export const platformTokens: Partial<Record<PlatformId, Record<string, TokenValue>>> = {
  windows: {
    'font.family.ui': '"Segoe UI", system-ui, sans-serif',
    'layout.radius.sm': '4px',
    'layout.radius.md': '6px',
  },
  darwin: {
    'font.family.ui': '-apple-system, BlinkMacSystemFont, sans-serif',
    'layout.radius.sm': '6px',
    'layout.radius.md': '10px',
  },
  linux: { 'font.family.ui': '"Noto Sans", system-ui, sans-serif' },
  android: {
    'font.family.ui': '"Noto Sans", system-ui, sans-serif',
    'layout.radius.md': '12px',
    'layout.density': 1.15,
  },
  ios: {
    'font.family.ui': '-apple-system, BlinkMacSystemFont, sans-serif',
    'layout.radius.md': '12px',
    'layout.density': 1.15,
  },
}
const aliases: Record<string, PlatformId> = {
  windows: 'windows',
  win32: 'windows',
  darwin: 'darwin',
  macos: 'darwin',
  'mac os x': 'darwin',
  linux: 'linux',
  android: 'android',
  ios: 'ios',
}
export function normalizeEnvironment(value: unknown): PlatformDescriptor {
  if (!isRecord(value)) return platforms.unknown
  if (isRecord(value.PlatformInfo) && value.PlatformInfo.mode === 'server')
    return { ...platforms.web, source: 'wails', runtimeMode: 'server' }
  const values = [value.OS, isRecord(value.OSInfo) ? value.OSInfo.ID : null]
  const raw = values.find((item) => typeof item === 'string') as string | undefined
  const id =
    values
      .map((item) => (typeof item === 'string' ? aliases[item.trim().toLowerCase()] : undefined))
      .find(Boolean) ?? 'unknown'
  const rawOS = raw ? [...raw.replace(/[\u0000-\u001f\u007f-\u009f]/gu, '')].slice(0, 32).join('') : null
  return { ...platforms[id], rawOS }
}
