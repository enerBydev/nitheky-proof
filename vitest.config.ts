import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

// Los tests unitarios SOLO tocan el motor: cero dependencias, cero Nuxt.
// Los endpoints se prueban en E2E (Playwright contra el servidor real de
// Nitro) — un endpoint "testeado" sin servidor real no está testeado.
export default defineConfig({
  test: {
    include: ['tests/unit/**/*.test.ts'],
    environment: 'node',
    reporters: ['default'],
  },
  resolve: {
    alias: {
      motor: fileURLToPath(new URL('./motor', import.meta.url)),
    },
  },
})
