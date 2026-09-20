<script setup lang="ts">
import AppShell from './components/AppShell.vue'
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ElConfigProvider } from 'element-plus'
import { elementLocales } from './i18n'
const { locale } = useI18n()
const elementLocale = computed(() => elementLocales[locale.value as keyof typeof elementLocales])
</script>

<template>
  <ElConfigProvider :locale="elementLocale" :z-index="2000"><AppShell /></ElConfigProvider>
</template>
