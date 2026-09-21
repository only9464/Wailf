<script setup lang="ts">
import { nextTick, onMounted } from 'vue'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from './ui/sheet'
const props = defineProps<{ title: string; description?: string; returnFocus?: HTMLElement | null }>()
const emit = defineEmits<{ close: [] }>()
let previousFocus: HTMLElement | null = null
onMounted(() => { previousFocus = props.returnFocus ?? document.activeElement as HTMLElement })
function restoreFocus(event: Event) {
  event.preventDefault()
  void nextTick(() => previousFocus?.isConnected && previousFocus.focus())
}
</script>
<template>
  <Sheet :open="true" @update:open="value => { if (!value) emit('close') }">
    <SheetContent class="business-sheet" @close-auto-focus="restoreFocus" @escape-key-down="emit('close')">
      <SheetHeader class="overlay-header"><SheetTitle>{{ title }}</SheetTitle><SheetDescription v-if="description">{{ description }}</SheetDescription></SheetHeader>
      <div class="overlay-body"><slot /></div>
    </SheetContent>
  </Sheet>
</template>
