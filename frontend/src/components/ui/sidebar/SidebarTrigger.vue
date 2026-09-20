<script setup lang="ts">
import type { HTMLAttributes } from 'vue'

import { PanelLeftIcon } from '@lucide/vue'
import { useI18n } from 'vue-i18n'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { useSidebar } from './utils'

const props = defineProps<{
  class?: HTMLAttributes['class']
}>()

const { toggleSidebar, state, isMobile, openMobile } = useSidebar()
const { t } = useI18n()
</script>

<template>
  <Button
    data-sidebar="trigger"
    data-slot="sidebar-trigger"
    variant="ghost"
    size="icon-sm"
    :class="cn('', props.class)"
    :aria-expanded="isMobile ? openMobile : state === 'expanded'"
    @click="toggleSidebar"
  >
    <PanelLeftIcon class="cn-rtl-flip" data-icon="inline-start" />
    <span class="sr-only">{{
      t(
        isMobile
          ? openMobile
            ? 'common.close'
            : 'app.menu'
          : state === 'expanded'
            ? 'app.collapse'
            : 'app.expand',
      )
    }}</span>
  </Button>
</template>
