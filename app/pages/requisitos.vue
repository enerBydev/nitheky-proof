<script setup lang="ts">
// La matriz: cada requisito del encargo, dónde está implementado, qué test
// lo rompería si se quitara, y el número medido. La página que responde a
// "¿esto cumple lo que pedí?" con un solo vistazo — y con enlaces al código.
useSeoMeta({
  title: 'The nine requirements — NITHEKY technical proof',
})

interface Fila {
  n: number
  requisito: string
  implementacion: string
  archivo: string
  test: string
  medido: string
}

const filas: Fila[] = [
  {
    n: 1,
    requisito: 'real route / polyline storage',
    implementacion: '`geography(linestring)` + `Polilinea`',
    archivo: 'sql/00_schema.sql · motor/geoespacial.ts',
    test: '“la ruta existe y mide lo que tiene que medir”',
    medido: '30.00 km corridor, 7 vertices',
  },
  {
    n: 2,
    requisito: 'route-corridor matching',
    implementacion: '`st_dwithin` · `proyectar()`',
    archivo: 'sql/02_matching.sql · motor/geoespacial.ts',
    test: '“fuera del corredor se rechaza con la distancia exacta”',
    medido: 'pickup 0 m, dropoff 0 m from route (scenario A)',
  },
  {
    n: 3,
    requisito: 'pickup before destination',
    implementacion: '`st_linelocatepoint` fractions',
    archivo: 'sql/02_matching.sql · motor/matching.ts',
    test: '“recogida y destino invertidos = dirección opuesta”',
    medido: 'pickup frac 0.526 → dropoff 1.000 ✓',
  },
  {
    n: 4,
    requisito: 'same-direction validation',
    implementacion: 'the same fraction, both ends',
    archivo: 'motor/matching.ts',
    test: '“la validación es sobre la RUTA, no sobre el punto”',
    medido: 'Zimpeto→Maputo: 0.526 ≥ 0.000 → rejected',
  },
  {
    n: 5,
    requisito: 'configurable detour',
    implementacion: '`desvio_max_m` per query and per driver',
    archivo: 'sql/02_matching.sql · motor/matching.ts',
    test: '“el desvío es configurable y se mide”',
    medido: 'out-and-back model: 2.48 km measured, limit adjustable',
  },
  {
    n: 6,
    requisito: 'time-window compatibility',
    implementacion: '`tstzrange &&` · `ventanasSolapan()`',
    archivo: 'sql/02_matching.sql · motor/matching.ts',
    test: '“ventanas que no se tocan se rechazan”',
    medido: 'overlap in minutes, hard filter',
  },
  {
    n: 7,
    requisito: 'available seats',
    implementacion: '`plazas >= requested` — filter, not sort order',
    archivo: 'sql/02_matching.sql · motor/matching.ts',
    test: '“sin plazas no hay match, y lo dice”',
    medido: 'hard reject when 0 left',
  },
  {
    n: 8,
    requisito: 'ranking of compatible drivers',
    implementacion: 'deterministic score, visible weights',
    archivo: 'sql/02_matching.sql · motor/matching.ts `puntuar()`',
    test: '“el ranking ordena por desvío, espera y confianza — y es estable”',
    medido: 'Amélia 91.4% > Tomás 82.6%',
  },
  {
    n: 9,
    requisito: 'last-seat double-booking protection',
    implementacion: 'atomic conditional update + CHECK constraint',
    archivo: 'sql/03_reserva.sql · motor/reserva.ts',
    test: '“la última plaza se vende UNA vez en 1000 carreras”',
    medido: '1,000 concurrent races, 0 double sales',
  },
]
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-8 py-8">
    <h2 class="text-xl font-bold">The nine requirements — where each one lives</h2>
    <p class="text-sm text-(--ui-text-muted) mt-2 max-w-3xl leading-relaxed">
      Every requirement has an implementation, a file you can open, a test that would fail if
      the requirement were removed, and a number it measured. Including the country-neutrality
      one: the engine knows nothing about Mozambique or Angola, and a test reads the motor's
      source to keep it that way.
    </p>

    <UCard class="mt-6" :ui="{ body: 'p-0 sm:p-0' }">
      <div class="overflow-x-auto">
        <table class="w-full text-sm" data-testid="matriz-requisitos">
          <thead>
            <tr class="border-b border-linea text-left text-xs uppercase tracking-wider text-(--ui-text-muted)">
              <th scope="col" class="px-4 py-3">#</th>
              <th scope="col" class="px-4 py-3">requirement</th>
              <th scope="col" class="px-4 py-3">implementation</th>
              <th scope="col" class="px-4 py-3">measured</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in filas" :key="f.n" class="border-b border-linea/60 last:border-b-0 align-top">
              <td class="px-4 py-3 numero text-oro font-bold">{{ f.n }}</td>
              <td class="px-4 py-3">
                <b>{{ f.requisito }}</b>
                <div class="numero text-xs text-(--ui-text-muted) mt-1">{{ f.archivo }}</div>
                <div class="text-xs text-(--ui-text-muted) mt-1">
                  test: “{{ f.test }}”
                </div>
              </td>
              <td class="px-4 py-3 numero text-xs leading-relaxed">{{ f.implementacion }}</td>
              <td class="px-4 py-3 numero text-xs leading-relaxed text-ok">{{ f.medido }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </UCard>

    <div class="grid grid-cols-1 md:grid-cols-2 gap-4 mt-6">
      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-flask-conical" class="text-oro" /> Run the suite
          </h3>
        </template>
        <p class="text-sm text-(--ui-text-muted) leading-relaxed">
          <span class="numero">pnpm install &amp;&amp; pnpm test</span> — the unit suite over the
          same motor this page imports. <span class="numero">pnpm test:e2e</span> — the fullstack
          app against a real server: pages, map, race, and the HTTP API, in Firefox and Chromium.
        </p>
      </UCard>
      <UCard>
        <template #header>
          <h3 class="text-sm font-semibold flex items-center gap-2">
            <UIcon name="i-lucide-database" class="text-oro" /> Run the SQL
          </h3>
        </template>
        <p class="text-sm text-(--ui-text-muted) leading-relaxed">
          <span class="numero">docker compose up</span> brings the Nuxt server and a PostGIS 18
          database. The matching query and the atomic reservation run in the database —
          <NuxtLink to="https://github.com/enerBydev/nitheky-proof/blob/main/docs/REPRODUCIR.md" class="text-oro underline">
            docs/REPRODUCIR.md
          </NuxtLink>
          walks every line.
        </p>
      </UCard>
    </div>
  </div>
</template>
