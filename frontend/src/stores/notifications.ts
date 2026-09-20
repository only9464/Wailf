import { defineStore } from 'pinia'
import { ref, computed } from 'vue'

export interface Notification {
  id: number
  key: string
  values: Record<string, string | number>
  kind: 'info' | 'success' | 'error'
  time: string
  read: boolean
}
export const useNotificationStore = defineStore('notifications', () => {
  const entries = ref<Notification[]>([])
  let nextId = 0
  const unread = computed(() => entries.value.filter((entry) => !entry.read).length)
  function push(key: string, kind: Notification['kind'] = 'info', values: Notification['values'] = {}) {
    entries.value.unshift({ id: ++nextId, key, kind, values, time: new Date().toISOString(), read: false })
    entries.value = entries.value.slice(0, 100)
  }
  function markRead() {
    entries.value.forEach((entry) => {
      entry.read = true
    })
  }
  function clear() {
    entries.value = []
  }
  return { entries, unread, push, markRead, clear }
})
