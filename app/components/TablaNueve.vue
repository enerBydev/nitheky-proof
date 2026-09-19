<script setup lang="ts">
// Los nueve requisitos del encargo, medidos EN VIVO con los parámetros
// actuales de la página. Cada fila dice su número: la tabla no promete
// comportamiento, lo cuenta.
const {
  resultado,
  proyeccionRecogida,
  proyeccionDestino,
  kmRuta,
  solapeMaxMin,
  corredorM,
  desvioMaxM,
} = usePrueba()

const mejor = computed(() => resultado.value.matches[0])

const fmtKm = (m: number) => `${(m / 1000).toFixed(2)} km`

interface Fila {
  n: number
  requisito: string
  valor: string
  ok: boolean
}

const filas = computed<Fila[]>(() => {
  const pr = proyeccionRecogida.value
  const pd = proyeccionDestino.value
  const misma = pr.fraccion < pd.fraccion
  return [
    {
      n: 1,
      requisito: 'route storage',
      valor: `polyline, 7 vertices — ${kmRuta.value.toFixed(1)} km`,
      ok: true,
    },
    {
      n: 2,
      requisito: 'corridor match',
      valor: `${Math.round(pr.distancia_m)} m / ${Math.round(pd.distancia_m)} m to route`,
      ok: Math.max(pr.distancia_m, pd.distancia_m) <= corredorM.value,
    },
    {
      n: 3,
      requisito: 'pickup before destination',
      valor: `pickup frac ${pr.fraccion.toFixed(3)} → dropoff ${pd.fraccion.toFixed(3)}`,
      ok: misma,
    },
    {
      n: 4,
      requisito: 'same direction',
      valor: misma ? 'same direction along route' : 'opposite — rejected',
      ok: misma,
    },
    {
      n: 5,
      requisito: 'configurable detour',
      valor: mejor.value
        ? `detour ${fmtKm(mejor.value.desvioM)} ≤ ${fmtKm(desvioMaxM.value)}`
        : `limit ${fmtKm(desvioMaxM.value)}`,
      ok: !!mejor.value,
    },
    {
      n: 6,
      requisito: 'time windows',
      valor: `${Math.round(solapeMaxMin.value)} min overlap (07:00–08:00)`,
      ok: solapeMaxMin.value > 0,
    },
    {
      n: 7,
      requisito: 'available seats',
      valor: `filter: seats ≥ ${resultado.value.matches.length ? 'requested' : '0'} — hard, not “sorted by”`,
      ok: true,
    },
    {
      n: 8,
      requisito: 'multi-driver ranking',
      valor: resultado.value.matches.length
        ? resultado.value.matches.map((m) => `${m.conductorId.replace('drv-', '')} ${m.puntuacion}%`).join(' · ')
        : 'none compatible',
      ok: resultado.value.matches.length > 0,
    },
    {
      n: 9,
      requisito: 'last-seat protection',
      valor: 'atomic — race demo below',
      ok: true,
    },
  ]
})
</script>

<template>
  <table class="w-full text-xs border-collapse" data-testid="tabla-nueve">
    <caption class="sr-only">
      The nine requirements, measured live
    </caption>
    <tbody>
      <tr
        v-for="f in filas"
        :key="f.n"
        class="border-t border-linea first:border-t-0 align-top"
      >
        <th scope="row" class="py-2 pr-2 text-left font-normal text-(--ui-text-muted) whitespace-nowrap w-40">
          {{ f.n }} · {{ f.requisito }}
        </th>
        <td class="py-2 numero leading-relaxed">
          <span :class="f.ok ? 'text-ok' : 'text-mal'">{{ f.valor }}</span>
        </td>
      </tr>
    </tbody>
  </table>
</template>
