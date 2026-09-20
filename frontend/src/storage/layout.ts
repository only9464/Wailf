import { defaultLayout, features } from '../features/registry'
import { listKeys, readJson } from './browser'

export interface LayoutGroup {
  id: string
  name: string
  icon: string
  items: string[]
}

export interface Layout {
  version: 1
  layoutId: string
  groups: LayoutGroup[]
  hidden: string[]
  customNames?: Record<string, string>
}

export const LAYOUT_PREFIX = 'wailf.layout.'
export const ACTIVE_LAYOUT_KEY = `${LAYOUT_PREFIX}active`
export const UNASSIGNED_GROUP = 'unassigned'
export type LayoutError = 'invalid' | 'version' | 'duplicate' | 'storage' | 'lastLayout'
export type LayoutValidation = { ok: true; layout: Layout } | { ok: false; error: LayoutError }

export function cloneLayout(layout: Layout): Layout {
  return JSON.parse(JSON.stringify(layout)) as Layout
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function isId(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[a-zA-Z0-9][a-zA-Z0-9._-]{0,79}$/.test(value) &&
    !['__proto__', 'constructor', 'prototype'].includes(value)
  )
}

function isText(value: unknown, max = 120): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= max
}

/** Only v1 has a defined schema. Unknown versions must never be guessed or rewritten. */
export function validateLayout(payload: unknown): LayoutValidation {
  let candidate = payload
  if (typeof candidate === 'string') {
    if (candidate.length > 256_000) return { ok: false, error: 'invalid' }
    try {
      candidate = JSON.parse(candidate)
    } catch {
      return { ok: false, error: 'invalid' }
    }
  }
  if (!isRecord(candidate)) return { ok: false, error: 'invalid' }
  if (candidate.version !== 1) return { ok: false, error: 'version' }
  if (
    !isId(candidate.layoutId) ||
    candidate.layoutId === 'active' ||
    !Array.isArray(candidate.groups) ||
    candidate.groups.length > 100
  ) {
    return { ok: false, error: 'invalid' }
  }
  const groups: LayoutGroup[] = []
  const groupIds = new Set<string>()
  const itemIds = new Set<string>()
  for (const group of candidate.groups) {
    if (
      !isRecord(group) ||
      !isId(group.id) ||
      !isText(group.name) ||
      !isText(group.icon, 80) ||
      !Array.isArray(group.items) ||
      group.items.length > 1000 ||
      !group.items.every(isId)
    ) {
      return { ok: false, error: 'invalid' }
    }
    if (
      groupIds.has(group.id) ||
      group.items.some((id) => itemIds.has(id)) ||
      new Set(group.items).size !== group.items.length
    )
      return { ok: false, error: 'duplicate' }
    groupIds.add(group.id)
    group.items.forEach((id) => itemIds.add(id))
    groups.push({ id: group.id, name: group.name, icon: group.icon, items: [...group.items] })
  }
  const hidden = candidate.hidden ?? []
  if (!Array.isArray(hidden) || hidden.length > 1000 || !hidden.every(isId))
    return { ok: false, error: 'invalid' }
  if (new Set(hidden).size !== hidden.length) return { ok: false, error: 'duplicate' }
  let customNames: Record<string, string> | undefined
  if (candidate.customNames !== undefined) {
    if (!isRecord(candidate.customNames)) return { ok: false, error: 'invalid' }
    customNames = {}
    for (const [key, value] of Object.entries(candidate.customNames)) {
      if ((key !== '$layout' && !isId(key)) || !isText(value, 80)) return { ok: false, error: 'invalid' }
      customNames[key] = value
    }
  }
  const known = new Set(features.map((feature) => feature.id))
  const unassigned = groups.find((group) => group.id === UNASSIGNED_GROUP)
  const unassignedItems = [...(unassigned?.items ?? [])]
  for (const group of groups) {
    if (group.id === UNASSIGNED_GROUP) continue
    const unknown = group.items.filter((id) => !known.has(id))
    unassignedItems.push(...unknown)
    group.items = group.items.filter((id) => known.has(id))
  }
  // Newly registered and omitted features stay available for arranging in settings.
  for (const feature of features) if (!itemIds.has(feature.id)) unassignedItems.push(feature.id)
  for (const id of hidden) if (!itemIds.has(id) && !known.has(id)) unassignedItems.push(id)
  const normalizedGroups = groups.filter((group) => group.id !== UNASSIGNED_GROUP)
  if (unassignedItems.length > 0)
    normalizedGroups.push({
      id: UNASSIGNED_GROUP,
      name: 'nav.group.unassigned',
      icon: 'boxes',
      items: [...new Set(unassignedItems)],
    })
  return {
    ok: true,
    layout: {
      version: 1,
      layoutId: candidate.layoutId,
      groups: normalizedGroups,
      hidden: [...hidden],
      ...(customNames ? { customNames } : {}),
    },
  }
}

export function loadLayouts(): { layouts: Layout[]; activeId: string } {
  const layouts: Layout[] = []
  for (const key of listKeys(LAYOUT_PREFIX)) {
    if (key === ACTIVE_LAYOUT_KEY) continue
    const result = validateLayout(readJson<unknown>(key, null))
    if (result.ok && key === `${LAYOUT_PREFIX}${result.layout.layoutId}`) layouts.push(result.layout)
    else console.warn(`[layout] Ignoring invalid saved layout: ${key}`)
  }
  if (layouts.length === 0) layouts.push(cloneLayout(defaultLayout))
  const requested = readJson<unknown>(ACTIVE_LAYOUT_KEY, 'default')
  const activeId =
    typeof requested === 'string' && layouts.some((layout) => layout.layoutId === requested)
      ? requested
      : layouts[0].layoutId
  return { layouts, activeId }
}
