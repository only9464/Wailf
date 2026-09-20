import { computed, reactive, ref } from 'vue'
import { defineStore } from 'pinia'
import { emptyPage, getServices, normalizeError, queryState, setQueryError } from '../services'
import type { DomainError, TargetScope } from '../services/types'

const split = (value: string) =>
  value
    .split(/[\n,]+/)
    .map((item) => item.trim())
    .filter(Boolean)
const newDraft = () => ({
  name: '',
  expressions: '',
  authorization: '',
  validFrom: '',
  expiresAt: '',
  riskLevel: 'L2',
  allowedOperations: 'recon.portscan',
})

export const useScopeStore = defineStore('scopes', () => {
  const scopes = reactive(queryState(emptyPage<TargetScope>()))
  const scopeId = ref('')
  const selectedScope = ref<TargetScope | null>(null)
  const draft = reactive(newDraft())
  const saving = ref(false)
  const saveError = ref<DomainError | null>(null)
  const available = computed(() => getServices().scopes.available)
  const currentScope = computed(
    () =>
      scopes.data.items.find((item) => item.id === scopeId.value) ??
      (selectedScope.value?.id === scopeId.value ? selectedScope.value : null),
  )
  const options = computed(() =>
    currentScope.value && !scopes.data.items.some((item) => item.id === currentScope.value?.id)
      ? [currentScope.value, ...scopes.data.items]
      : scopes.data.items,
  )
  const validDraft = computed(
    () =>
      !!draft.name.trim() &&
      !!split(draft.expressions).length &&
      !!draft.authorization.trim() &&
      !!split(draft.allowedOperations).length &&
      Number.isFinite(Date.parse(draft.validFrom)) &&
      Date.parse(draft.expiresAt) > Date.parse(draft.validFrom),
  )
  let listGeneration = 0,
    selectionGeneration = 0,
    initialized = false

  async function load(page = 1) {
    const generation = ++listGeneration
    scopes.status = 'loading'
    scopes.error = null
    scopes.data = emptyPage(page)
    try {
      const data = await getServices().scopes.list({ page, pageSize: 20, sort: 'name', direction: 'asc' })
      if (generation !== listGeneration) return
      scopes.data = data
      const selected = data.items.find((item) => item.id === scopeId.value)
      if (selected) selectedScope.value = selected
      scopes.status = data.items.length ? 'ready' : 'empty'
    } catch (error) {
      if (generation === listGeneration) setQueryError(scopes, error)
    }
  }
  function select(id: string) {
    if (scopeId.value === id) return
    ++selectionGeneration
    selectedScope.value = options.value.find((item) => item.id === id) ?? null
    scopeId.value = selectedScope.value?.id ?? ''
    saveError.value = null
  }
  function initialize() {
    if (initialized) return
    initialized = true
    void load()
  }
  async function create() {
    if (saving.value || !available.value) return
    if (!validDraft.value) {
      saveError.value = normalizeError({
        code: 'scope.invalid',
        messageKey: 'business.scope.invalidDraft',
        retryable: false,
      })
      return
    }
    const selection = selectionGeneration
    const submittedDraft = JSON.stringify(draft)
    saving.value = true
    saveError.value = null
    try {
      const result = await getServices().scopes.create({
        name: draft.name.trim(),
        expressions: split(draft.expressions),
        authorization: draft.authorization.trim(),
        validFrom: new Date(draft.validFrom).toISOString(),
        expiresAt: new Date(draft.expiresAt).toISOString(),
        riskLevel: draft.riskLevel,
        allowedOperations: split(draft.allowedOperations),
      })
      if (JSON.stringify(draft) === submittedDraft) Object.assign(draft, newDraft())
      await load()
      if (selection !== selectionGeneration) return
      selectedScope.value = result
      scopeId.value = result.id
      ++selectionGeneration
    } catch (error) {
      if (selection === selectionGeneration) saveError.value = normalizeError(error)
    } finally {
      saving.value = false
    }
  }
  return {
    scopes,
    scopeId,
    currentScope,
    options,
    draft,
    validDraft,
    available,
    saving,
    saveError,
    initialize,
    load,
    select,
    create,
  }
})
