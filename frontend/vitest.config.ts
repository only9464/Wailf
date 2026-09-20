import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'
export default defineConfig({
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  plugins: [vue()],
  test: { environment: 'happy-dom', include: ['src/**/*.test.ts'], restoreMocks: true, clearMocks: true },
})
