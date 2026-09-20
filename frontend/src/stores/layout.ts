import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import { defaultLayout } from '../features/registry'
import { transactStorage } from '../storage/browser'
import {
  ACTIVE_LAYOUT_KEY,
  LAYOUT_PREFIX,
  UNASSIGNED_GROUP,
  cloneLayout,
  loadLayouts,
  validateLayout,
  type Layout,
  type LayoutError,
} from '../storage/layout'

export const useLayoutStore = defineStore('layout', () => {
  const initial = loadLayouts()
  const layouts = ref<Layout[]>(initial.layouts)
  const activeId = ref(initial.activeId)
  const active = computed(() => layouts.value.find((layout) => layout.layoutId === activeId.value)!)
  const unassigned = computed(
    () => active.value.groups.find((group) => group.id === UNASSIGNED_GROUP)?.items ?? [],
  )
  const lastError = ref<LayoutError | null>(null)

  function fail(error: LayoutError): false {
    lastError.value = error
    return false
  }
  function persist(layout: Layout, select = true): boolean {
    const validation = validateLayout(layout)
    if (!validation.ok) return fail(validation.error)
    const value = validation.layout
    const entries: Record<string, string> = {
      [`${LAYOUT_PREFIX}${value.layoutId}`]: JSON.stringify(value),
      'wailf.ui.layoutExportVersion': '1',
    }
    if (select) entries[ACTIVE_LAYOUT_KEY] = JSON.stringify(value.layoutId)
    if (!transactStorage(entries)) return fail('storage')
    const index = layouts.value.findIndex((item) => item.layoutId === value.layoutId)
    if (index < 0) layouts.value.push(value)
    else layouts.value[index] = value
    if (select) activeId.value = value.layoutId
    lastError.value = null
    return true
  }
  function mutate(update: (layout: Layout) => boolean | void): boolean {
    const next = cloneLayout(active.value)
    if (update(next) === false) return fail('invalid')
    return persist(next)
  }
  function uniqueId(prefix: string): string {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  }
  function setActive(id: string): boolean {
    if (!layouts.value.some((layout) => layout.layoutId === id)) return fail('invalid')
    if (!transactStorage({ [ACTIVE_LAYOUT_KEY]: JSON.stringify(id) })) return fail('storage')
    activeId.value = id
    lastError.value = null
    return true
  }
  function createLayout(name?: string): boolean {
    const next = cloneLayout(active.value)
    next.layoutId = uniqueId('layout')
    next.customNames = { ...next.customNames }
    if (name?.trim()) next.customNames.$layout = name.trim()
    else delete next.customNames.$layout
    return persist(next)
  }
  function removeLayout(id: string): boolean {
    if (!layouts.value.some((layout) => layout.layoutId === id)) return fail('invalid')
    if (layouts.value.length === 1) return fail('lastLayout')
    const remaining = layouts.value.filter((layout) => layout.layoutId !== id)
    const nextId = activeId.value === id ? remaining[0].layoutId : activeId.value
    if (!transactStorage({ [`${LAYOUT_PREFIX}${id}`]: null, [ACTIVE_LAYOUT_KEY]: JSON.stringify(nextId) }))
      return fail('storage')
    layouts.value = remaining
    activeId.value = nextId
    lastError.value = null
    return true
  }
  function renameLayout(id: string, name: string): boolean {
    const found = layouts.value.find((layout) => layout.layoutId === id)
    if (!found || !name.trim()) return fail('invalid')
    const next = cloneLayout(found)
    next.customNames = { ...next.customNames, $layout: name.trim() }
    return persist(next, false)
  }
  function addGroup(name: string): boolean {
    if (!name.trim()) return fail('invalid')
    return mutate((layout) => {
      const id = uniqueId('group')
      layout.groups.push({ id, name: 'nav.group.custom', icon: 'folder', items: [] })
      layout.customNames = { ...layout.customNames, [id]: name.trim() }
    })
  }
  function removeGroup(id: string): boolean {
    if (id === UNASSIGNED_GROUP) return fail('invalid')
    return mutate((layout) => {
      const index = layout.groups.findIndex((group) => group.id === id)
      if (index < 0) return false
      const [removed] = layout.groups.splice(index, 1)
      let unassignedGroup = layout.groups.find((group) => group.id === UNASSIGNED_GROUP)
      if (!unassignedGroup && removed.items.length) {
        unassignedGroup = { id: UNASSIGNED_GROUP, name: 'nav.group.unassigned', icon: 'boxes', items: [] }
        layout.groups.push(unassignedGroup)
      }
      unassignedGroup?.items.push(...removed.items)
      if (layout.customNames) delete layout.customNames[id]
    })
  }
  function renameGroup(id: string, name: string): boolean {
    if (!name.trim()) return fail('invalid')
    return mutate((layout) => {
      if (!layout.groups.some((group) => group.id === id)) return false
      layout.customNames = { ...layout.customNames, [id]: name.trim() }
    })
  }
  function moveGroup(id: string, delta: number): boolean {
    return mutate((layout) => {
      const index = layout.groups.findIndex((group) => group.id === id)
      const target = index + delta
      if (index < 0 || target < 0 || target >= layout.groups.length || !Number.isInteger(delta)) return false
      const [group] = layout.groups.splice(index, 1)
      layout.groups.splice(target, 0, group)
    })
  }
  function moveItem(itemId: string, groupId: string, index?: number): boolean {
    return mutate((layout) => {
      const target = layout.groups.find((group) => group.id === groupId)
      if (!target || !layout.groups.some((group) => group.items.includes(itemId))) return false
      if (index !== undefined && (!Number.isInteger(index) || index < 0)) return false
      for (const group of layout.groups) group.items = group.items.filter((id) => id !== itemId)
      target.items.splice(
        index === undefined ? target.items.length : Math.min(index, target.items.length),
        0,
        itemId,
      )
    })
  }
  function moveItemBy(itemId: string, delta: number): boolean {
    const group = active.value.groups.find((group) => group.items.includes(itemId))
    if (!group || !Number.isInteger(delta)) return fail('invalid')
    const index = group.items.indexOf(itemId) + delta
    if (index < 0 || index >= group.items.length) return fail('invalid')
    return moveItem(itemId, group.id, index)
  }
  function setHidden(itemId: string, hidden: boolean): boolean {
    return mutate((layout) => {
      if (!layout.groups.some((group) => group.items.includes(itemId))) return false
      layout.hidden = layout.hidden.filter((id) => id !== itemId)
      if (hidden) layout.hidden.push(itemId)
    })
  }
  function importLayout(payload: unknown): boolean {
    const validation = validateLayout(payload)
    if (!validation.ok) return fail(validation.error)
    // Preserve an existing layout when importing a bundle with the same identifier.
    const next = validation.layout
    if (layouts.value.some((layout) => layout.layoutId === next.layoutId))
      next.layoutId = uniqueId('imported')
    return persist(next)
  }
  function exportLayout(): string {
    return JSON.stringify(active.value, null, 2)
  }
  function restoreDefault(): boolean {
    const next = cloneLayout(defaultLayout)
    next.layoutId = activeId.value
    if (active.value.customNames?.$layout) next.customNames = { $layout: active.value.customNames.$layout }
    return persist(next)
  }
  return {
    layouts,
    active,
    activeId,
    unassigned,
    lastError,
    setActive,
    createLayout,
    removeLayout,
    renameLayout,
    addGroup,
    removeGroup,
    renameGroup,
    moveGroup,
    moveItem,
    moveItemBy,
    setHidden,
    importLayout,
    exportLayout,
    restoreDefault,
  }
})
