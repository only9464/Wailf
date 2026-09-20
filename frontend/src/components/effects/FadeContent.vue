<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { gsap } from 'gsap'

/**
 * Adapted from Vue Bits FadeContent (MIT + Commons Clause), kept local so the
 * workbench does not depend on a remote component registry at runtime.
 * Decorative only: reduced motion and animation failure leave content visible.
 */
const props = withDefaults(defineProps<{ duration?: number; delay?: number }>(), {
  duration: 0.45,
  delay: 0,
})
const root = ref<HTMLElement>()
onMounted(() => {
  if (!root.value || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  try {
    gsap.fromTo(root.value, { opacity: 0, y: 5 }, { opacity: 1, y: 0, duration: props.duration, delay: props.delay })
  } catch {
    if (root.value) root.value.style.opacity = '1'
  }
})
</script>
<template><div ref="root"><slot /></div></template>
