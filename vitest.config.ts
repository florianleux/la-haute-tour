import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

/**
 * Plain Vitest, no Nuxt environment: these tests exercise Nitro handlers and
 * server utils. Running them under the Nuxt environment would inject the *app*
 * auto-imports (a `useRuntimeConfig` that needs a Nuxt instance) into server
 * code. No component render tests: a screen's logic lives in a pure function
 * or a composable, and is tested there.
 */
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
  resolve: {
    alias: {
      '~~': fileURLToPath(new URL('.', import.meta.url)),
    },
  },
})
