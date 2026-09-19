import { defineConfig, devices } from '@playwright/test'

// E2E contra el SERVIDOR REAL (nuxi preview del build de producción):
// páginas, mapa, carrera, y los endpoints de la API por HTTP de verdad.
// Firefox es el motor primario (misma regla del arnés del ecosistema);
// Chromium como segundo. MapLibre no está en juego: Leaflet no usa WebGL.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL: process.env.E2E_BASE_URL || 'http://127.0.0.1:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'node .output/server/index.mjs',
    url: 'http://127.0.0.1:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { PORT: '4173', NITRO_PORT: '4173', DATABASE_URL: '' },
  },
  projects: [
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'chromium', use: { ...devices['Desktop Chromium'] } },
  ],
})
