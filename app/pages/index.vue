<script setup lang="ts">
// LA PÁGINA. Los escenarios del encargo, los parámetros, los nueve medidos
// en vivo, el mapa y la carrera. El mapa va PRIMERO en el panel principal
// (hallazgo C1 de la auditoría: en la v1 quedaba bajo el fold) y las fichas
// de conductores fluyen debajo.
useSeoMeta({
  title: 'NITHEKY — same-direction matching · technical proof',
})

const { resultado, rechazosTraducidos, definicion } = usePrueba()
</script>

<template>
  <div class="grid grid-cols-1 lg:grid-cols-[380px_1fr] min-h-(--container-4xl 100dvh)">
    <!-- ════ panel izquierdo: el encargo y sus perillas ════
         En móvil va DESPUÉS del mapa (hallazgo de la auditoría v2: el mapa
         es el argumento y no puede nacer bajo dos pantallas de ajustes). -->
    <aside
      class="order-2 lg:order-1 border-t-0 lg:border-r border-linea p-5 sm:p-6 lg:max-h-screen lg:overflow-y-auto"
    >
      <h2 class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold">
        Scenario — the client's own cases
      </h2>
      <SelectorEscenarios />

      <h2 class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold mt-7">
        Parameters
      </h2>
      <PanelParametros />

      <h2 class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold mt-7">
        The nine requirements — measured
      </h2>
      <TablaNueve />
    </aside>

    <!-- ════ panel principal: el mapa ES el argumento ════ -->
    <section class="order-1 lg:order-2 p-5 sm:p-6 flex flex-col gap-6">
      <div>
        <div class="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h2 class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold">
            {{ definicion.etiqueta }}
          </h2>
          <span class="numero text-xs text-(--ui-text-muted)" data-testid="cuenta-matches">
            {{ resultado.matches.length }} of {{ resultado.matches.length + rechazosTraducidos.length }}
            drivers compatible
          </span>
        </div>

        <MapaCorredor />
      </div>

      <!-- compatible drivers -->
      <div>
        <h2
          class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold mb-3"
        >
          Compatible drivers
        </h2>

        <div
          v-if="resultado.matches.length"
          class="flex flex-col gap-3"
          data-testid="resultados"
        >
          <TarjetaConductor v-for="m in resultado.matches" :key="m.conductorId" :match="m" />
        </div>

        <!-- el estado vacío COMO AFIRMACIÓN: la lectura que hizo la auditoría
             de visión fue que esto convierte "sin resultados" en validación -->
        <div
          v-else
          class="border-l-4 border-ok bg-green-950/20 rounded-r-lg px-4 py-3 text-sm"
          data-testid="cero-compatibles"
        >
          <b>zero compatible drivers</b> — this is the correct answer for this scenario.
        </div>
      </div>

      <!-- rejected: filas compactas y uniformes (hallazgo H4: la v1 las
           mostraba a lo ancho como un console.log filtrado) -->
      <div v-if="rechazosTraducidos.length">
        <h2
          class="text-xs uppercase tracking-[0.15em] text-(--ui-text-muted) font-semibold mb-3"
        >
          Rejected — with the reason and the number that decided it
        </h2>
        <ul class="flex flex-col gap-2" data-testid="rechazados">
          <li
            v-for="r in rechazosTraducidos"
            :key="r.conductorId"
            class="border-l-4 border-mal bg-red-950/20 rounded-r-lg px-3.5 py-2.5 text-sm"
          >
            <b>{{ r.nombre }}</b>
            <span class="text-(--ui-text-muted)"> — {{ r.motivoEn }}:</span>
            <span class="numero text-(--ui-text-muted)"> {{ r.detalle }}</span>
          </li>
        </ul>
      </div>

      <CarreraUltimaPlaza />
    </section>
  </div>
</template>
