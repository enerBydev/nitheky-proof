// NITHEKY · configuración Nuxt 4.
//
// Las decisiones de este fichero no son gusto: vienen del banco de pruebas del
// ecosistema medido en septiembre 2026 y documentado en ALoNNo (docs 10 y 22):
//
//   · @nuxt/ui 4.11 entra (con su verde de fábrica corregido en app.config.ts,
//     en el MISMO commit que la instalación — medido: si no, la primera
//     captura confunde)
//   · Leaflet 1.9 sí, MapLibre no: WebGL no se puede verificar en el navegador
//     del arnés y pesa 5,5x más. La página es .client.vue
//   · @nuxt/icon con serverBundle de lucide: sin esto, cada SSR hace fetch a
//     jsdelivr por la colección ENTERA de iconos
//   · devtools encendido: no llega a producción y es con lo que se audita
//
import { fileURLToPath } from 'node:url'

const ruta = (p: string) => fileURLToPath(new URL(p, import.meta.url))

export default defineNuxtConfig({
  compatibilityDate: '2026-09-01',

  modules: ['@nuxt/ui', '@nuxtjs/leaflet', '@nuxt/eslint'],

  css: ['~/assets/css/main.css'],

  devtools: { enabled: true },

  // El motor puro vive en la raíz del repo, fuera de app/, para que sea el
  // MISMO código que importan los tests y el SQL documenta. Alias: importarlo
  // como `motor/matching` desde cualquier capa.
  alias: {
    motor: ruta('./motor'),
  },

  // GitHub Pages sirve el proyecto bajo /nitheky-proof/; en local y Docker,
  // raíz. Se sobreescribe con NUXT_APP_BASE_URL en el job de Pages.
  app: {
    baseURL: process.env.NUXT_APP_BASE_URL || '/',
    head: {
      htmlAttrs: { lang: 'en', class: 'dark' },
      title: 'NITHEKY — same-direction matching · technical proof',
      meta: [
        {
          name: 'description',
          content:
            'Route-corridor matching proof: Maputo→Marracuene, Zimpeto pickup, direction validation, configurable detour, time windows, seats, ranking, atomic last-seat reservation. Nuxt 4 fullstack, reproducible.',
        },
        { name: 'theme-color', content: '#0d0e10' },
      ],
    },
  },

  // El tema oscuro es la marca de la demo; no es un modo, es el único modo.
  colorMode: { preference: 'dark', fallback: 'dark' },

  icon: {
    serverBundle: { collections: ['lucide'] },
    clientBundle: { scan: true },
  },

  fonts: {
    // Sin <link> a Google Fonts: el módulo auto-aloja. Un fetch a
    // fonts.googleapis.com es una transferencia a EE. UU. que un cliente
    // alemán tiene derecho a no querer pagar (medido en doc 10).
    defaults: { weights: [400, 500, 600, 700] },
  },

  routeRules: {
    // Prerender: la portada que se va a abrir cien veces no tiene que
    // renderizarse cien veces (regla del banco de pruebas, paso 8).
    '/': { prerender: true },
    '/requisitos': { prerender: true },
  },

  typescript: {
    strict: true,
    // El motor importa con extensión .ts explícita (es su contrato: correr
    // con node --experimental y con Vite tal cual); esto lo permite en
    // typecheck sin tocar el motor.
    tsConfig: {
      compilerOptions: {
        allowImportingTsExtensions: true,
        noEmit: true,
      },
    },
  },

  nitro: {
    prerender: {
      crawlLinks: true,
      routes: ['/', '/requisitos'],
    },
  },
})
