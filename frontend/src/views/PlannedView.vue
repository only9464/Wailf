<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { features } from '../features/registry'
import UiIcon from '../components/UiIcon.vue'
import FadeContent from '../components/effects/FadeContent.vue'
const route = useRoute()
const { t } = useI18n()
const feature = computed(() => features.find((item) => item.route === route.path))
</script>
<template>
  <div v-if="feature" class="page planned-page">
    <header class="page-header">
      <div>
        <div class="eyebrow">{{ t('planned.eyebrow') }}</div>
        <h1>{{ t(feature.nameKey) }}</h1>
        <p>{{ t(feature.descriptionKey) }}</p>
      </div>
      <span class="badge">{{ t(`common.${feature.status}`) }}</span>
    </header>
    <FadeContent><section class="card planned-card">
      <div class="planned-symbol"><UiIcon :name="feature.icon" :size="40" /></div>
      <h2>{{ t('planned.title') }}</h2>
      <p class="muted">{{ t('planned.description') }}</p>
      <div class="planned-actions">
        <RouterLink class="button primary" to="/recon/portscan"
          ><UiIcon name="radar" />{{ t('planned.back') }}</RouterLink
        ><RouterLink class="button" to="/settings?tab=layout">{{ t('planned.layout') }}</RouterLink>
      </div>
    </section></FadeContent>
    <div class="inline-note"><UiIcon name="info" />{{ t('planned.note') }}</div>
  </div>
</template>
