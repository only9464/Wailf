import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { watch } from 'vue'
import App from './App.vue'
import { router } from './router'
import { i18n } from './i18n'
import { usePreferenceStore } from './stores/preferences'
import { initializeTheme } from './theme'
import './styles/ui.css'

const app = createApp(App)
app.use(createPinia()).use(i18n).use(router)
const preferences = usePreferenceStore()
watch(
  () => preferences.language,
  (language) => {
    i18n.global.locale.value = language
    document.documentElement.lang = language
  },
  { immediate: true },
)
app.mount('#app')
void initializeTheme()
