<script setup lang="ts">
// La ficha del conductor compatible. Hallazgos H2 (el score es el número
// héroe de la página, no 18px en una esquina) y H8 (la confianza enterrada
// en 12px gris): score a 28px en oro, confianza como badges legibles.
import type { Match } from 'motor/matching'

const props = defineProps<{ match: Match }>()

const { nombreDe, conductorDe } = usePrueba()

const conductor = computed(() => conductorDe(props.match.conductorId))
const nombre = computed(() => nombreDe(props.match.conductorId))

const fmtKm = (m: number) => `${(m / 1000).toFixed(2)} km`

/** La ventana de salida del conductor, en HH:MM UTC — del dato, no pintada. */
const ventana = computed(() => {
  const v = conductor.value?.ventana
  if (!v) return ''
  const hhmm = (ms: number) => new Date(ms).toISOString().slice(11, 16)
  return `${hhmm(v.inicio)}–${hhmm(v.fin)} UTC`
})
</script>

<template>
  <article class="bg-panel border border-linea rounded-xl p-4" :data-testid="`tarjeta-${match.conductorId}`">
    <div class="flex items-start justify-between gap-4">
      <div class="min-w-0">
        <h3 class="font-semibold text-sm flex flex-wrap items-center gap-1.5">
          {{ nombre }}
          <UBadge
            v-if="conductor?.verificado"
            icon="i-lucide-badge-check"
            color="success"
            variant="subtle"
            size="sm"
            label="verified"
          />
          <UBadge
            v-else
            icon="i-lucide-help-circle"
            color="neutral"
            variant="subtle"
            size="sm"
            label="unverified"
          />
          <span class="numero text-(--ui-text-muted) text-xs">★{{ conductor?.nota }} ({{ conductor?.valoraciones }})</span>
        </h3>
        <p class="numero text-(--ui-text-muted) text-xs mt-0.5">
          {{ match.conductorId }} · window {{ ventana }}
        </p>
      </div>
      <!-- EL número de la página: la puntuación del ranking (req 8) -->
      <div class="text-right shrink-0" data-testid="score">
        <span class="numero text-3xl font-bold text-oro leading-none">{{ match.puntuacion }}%</span>
        <span class="block text-[10px] uppercase tracking-wider text-(--ui-text-muted) mt-1">
          match score
        </span>
      </div>
    </div>

    <div class="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
      <div class="bg-panel2 rounded-lg px-2.5 py-2">
        <div class="text-[10px] uppercase tracking-wider text-(--ui-text-muted)">pickup → route</div>
        <div class="numero text-sm mt-0.5">{{ Math.round(match.recogidaDistM) }} m</div>
      </div>
      <div class="bg-panel2 rounded-lg px-2.5 py-2">
        <div class="text-[10px] uppercase tracking-wider text-(--ui-text-muted)">detour</div>
        <div class="numero text-sm mt-0.5">{{ fmtKm(match.desvioM) }}</div>
      </div>
      <div class="bg-panel2 rounded-lg px-2.5 py-2">
        <div class="text-[10px] uppercase tracking-wider text-(--ui-text-muted)">window overlap</div>
        <div class="numero text-sm mt-0.5">{{ Math.round(match.esperaMin) }} min</div>
      </div>
      <div class="bg-panel2 rounded-lg px-2.5 py-2">
        <div class="text-[10px] uppercase tracking-wider text-(--ui-text-muted)">seats left</div>
        <div class="numero text-sm mt-0.5">{{ conductor?.plazas }}</div>
      </div>
    </div>

    <p class="numero text-(--ui-text-muted) text-xs mt-3">
      fractions {{ match.fraccionRecogida.toFixed(3) }} → {{ match.fraccionDestino.toFixed(3) }}
      · score = 0.4·detour + 0.3·wait + 0.2·trust + 0.1·verified
    </p>
  </article>
</template>
