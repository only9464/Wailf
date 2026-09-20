import type { ThemeDefinition, TokenGradient, TokenValue } from './types'

export const lightTokens: Record<string, TokenValue> = {
  'color.canvas': '#f6f7f9',
  'color.surface.default': '#ffffff',
  'color.surface.elevated': '#ffffff',
  'color.surface.glass': '#f0f2f5',
  'color.surface.glassStrong': '#e9edf2',
  'color.border.subtle': '#dce0e5',
  'color.text.primary': '#20242b',
  'color.text.muted': '#667080',
  'color.action.primary': '#2463d4',
  'color.action.secondary': '#e9effa',
  'color.focus.ring': '#3974df',
  'color.status.danger': '#b43342',
  'color.status.success': '#22724b',
  'color.status.warning': '#946200',
  'effect.gradient.primary': {
    kind: 'linear',
    angle: 135,
    stops: [
      { color: '#2463d4', position: 0 },
      { color: '#5785dc', position: 1 },
    ],
  },
  'effect.shadow.action': 'none',
  'layout.radius.sm': '5px',
  'layout.radius.md': '8px',
  'layout.density': 1,
  'font.family.ui': 'system-ui, sans-serif',
  'motion.duration.fast': '140ms',
  'accessibility.color-scheme': 'light',
}
export const darkTokens: Record<string, TokenValue> = {
  ...lightTokens,
  'color.canvas': '#17191d',
  'color.surface.default': '#202329',
  'color.surface.elevated': '#292d34',
  'color.surface.glass': '#252930',
  'color.surface.glassStrong': '#30353e',
  'color.border.subtle': '#3a4049',
  'color.text.primary': '#edf0f5',
  'color.text.muted': '#aab3c2',
  'color.action.primary': '#8db3ff',
  'color.action.secondary': '#2a3c59',
  'color.focus.ring': '#95b9ff',
  'color.status.danger': '#ff9ba7',
  'color.status.success': '#8bd7af',
  'color.status.warning': '#ebc56a',
  'accessibility.color-scheme': 'dark',
}

export const validId = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[a-z0-9][a-z0-9._-]{0,63}$/.test(value) &&
  !['constructor', '__proto__', 'prototype'].includes(value)
export const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value &&
  typeof value === 'object' &&
  !Array.isArray(value) &&
  (Object.getPrototypeOf(value) === Object.prototype || Object.getPrototypeOf(value) === null)
export const byteLength = (value: string) => new TextEncoder().encode(value).length
const safeText = (value: string) => !/[\u0000-\u001f\u007f-\u009f<>]/u.test(value)
export function validColor(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false
  if (/^#(?:[a-f\d]{3}|[a-f\d]{4}|[a-f\d]{6}|[a-f\d]{8})$/i.test(value)) return true
  const match = value.match(
    /^(rgb|rgba)\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/,
  )
  return (
    !!match &&
    match.slice(2, 5).every((part) => Number(part) <= 255) &&
    (match[1] === 'rgba' ? match[5] !== undefined : match[5] === undefined)
  )
}
function validGradient(value: unknown): value is TokenGradient {
  if (
    !isRecord(value) ||
    value.kind !== 'linear' ||
    typeof value.angle !== 'number' ||
    !Number.isFinite(value.angle) ||
    value.angle < -360 ||
    value.angle > 360 ||
    !Array.isArray(value.stops) ||
    value.stops.length < 2 ||
    value.stops.length > 5
  )
    return false
  if (Object.keys(value).some((key) => !['kind', 'angle', 'stops'].includes(key))) return false
  let previous = -1
  return value.stops.every((stop) => {
    if (
      !isRecord(stop) ||
      Object.keys(stop).some((key) => !['color', 'position'].includes(key)) ||
      !validColor(stop.color) ||
      typeof stop.position !== 'number' ||
      !Number.isFinite(stop.position) ||
      stop.position < 0 ||
      stop.position > 1 ||
      stop.position < previous
    )
      return false
    previous = stop.position
    return true
  })
}
interface TokenRule {
  key: string
  type: string
  defaultValue: TokenValue
  userEditable: boolean
  aliases: string[]
  valid: (value: unknown) => boolean
}
export const tokenRegistry: Record<string, TokenRule> = Object.fromEntries(
  Object.entries(lightTokens).map(([key, defaultValue]) => {
    let type = 'enum'
    let valid: (value: unknown) => boolean = (value) => typeof value === 'string' && value === defaultValue
    if (key.startsWith('color.')) {
      type = 'color'
      valid = validColor
    } else if (key.startsWith('layout.radius.')) {
      type = 'length'
      valid = (value) =>
        typeof value === 'string' &&
        /^(?:\d|[12]\d|3[0-2])(?:\.\d{1,2})?px$/.test(value) &&
        parseFloat(value) <= 32
    } else if (key === 'layout.density') {
      type = 'number'
      valid = (value) => typeof value === 'number' && Number.isFinite(value) && value >= 0.8 && value <= 1.4
    } else if (key === 'effect.gradient.primary') {
      type = 'gradient'
      valid = validGradient
    } else if (key === 'motion.duration.fast') {
      type = 'length'
      valid = (value) => typeof value === 'string' && /^\d{1,3}ms$/.test(value) && parseFloat(value) <= 500
    } else if (key === 'font.family.ui')
      valid = (value) =>
        typeof value === 'string' &&
        [
          'system-ui, sans-serif',
          '"Segoe UI", system-ui, sans-serif',
          '-apple-system, BlinkMacSystemFont, sans-serif',
          '"Noto Sans", system-ui, sans-serif',
        ].includes(value)
    else if (key === 'accessibility.color-scheme')
      valid = (value) => value === 'dark' || value === 'light' || value === 'normal'
    return [key, { key, type, defaultValue, userEditable: true, aliases: [], valid }]
  }),
)

export function validateTheme(input: unknown): ThemeDefinition | null {
  if (
    !isRecord(input) ||
    input.version !== 1 ||
    !validId(input.id) ||
    typeof input.name !== 'string' ||
    !input.name.trim() ||
    input.name !== input.name.normalize('NFC') ||
    [...input.name].length > 64 ||
    !safeText(input.name) ||
    !['platform', 'default'].includes(String(input.base)) ||
    !isRecord(input.tokens)
  )
    return null
  // Unknown fields are stripped, but they still count toward the input size cap.
  // A pathological deeply nested/cyclic caller object must not escape validation as an exception.
  try {
    if (byteLength(JSON.stringify(input)) > 65536 || Object.keys(input.tokens).length > 256) return null
  } catch {
    return null
  }
  const tokens: Record<string, TokenValue> = {}
  for (const [key, value] of Object.entries(input.tokens)) {
    if (
      !Object.hasOwn(tokenRegistry, key) ||
      !tokenRegistry[key]!.valid(value) ||
      (typeof value === 'string' && value.length > 2048)
    )
      return null
    tokens[key] = value as TokenValue
  }
  return { version: 1, id: input.id, name: input.name, base: input.base as ThemeDefinition['base'], tokens }
}

export function tokenProperty(key: string): string | null {
  return Object.hasOwn(tokenRegistry, key) ? `--wailf-${key.replace(/\./g, '-')}` : null
}
export function serializeToken(key: string, value: TokenValue): string | null {
  if (!Object.hasOwn(tokenRegistry, key) || !tokenRegistry[key]!.valid(value)) return null
  if (typeof value !== 'object') return String(value)
  return `linear-gradient(${value.angle}deg, ${value.stops.map((stop) => `${stop.color} ${stop.position * 100}%`).join(', ')})`
}
