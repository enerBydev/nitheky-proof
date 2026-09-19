<script setup lang="ts">
// Los parámetros configurables del matching (requisitos 5 y 7): corredor,
// desvío y plazas pedidas. Hallazgos H5 (thumbs diminutos, contraste) y el
// móvil (etiqueta y valor a 10 cm de distancia): USlider con etiqueta y valor
// en la MISMA línea, tracks con relleno visible y foco accesible.
const { corredorM, desvioMaxM, plazasPedidas } = usePrueba()
</script>

<template>
  <div class="flex flex-col gap-5">
    <div>
      <div class="flex items-baseline justify-between mb-2">
        <label for="corredor" class="text-sm text-(--ui-text-muted)">corridor radius</label>
        <b class="numero text-sm">{{ corredorM }} m</b>
      </div>
      <USlider
        id="corredor"
        v-model="corredorM"
        data-testid="slider-corredor"
        :min="500"
        :max="4000"
        :step="100"
      />
    </div>

    <div>
      <div class="flex items-baseline justify-between mb-2">
        <label for="desvio" class="text-sm text-(--ui-text-muted)">max detour</label>
        <b class="numero text-sm">{{ desvioMaxM }} m</b>
      </div>
      <USlider
        id="desvio"
        v-model="desvioMaxM"
        data-testid="slider-desvio"
        :min="500"
        :max="8000"
        :step="100"
      />
    </div>

    <div>
      <div class="flex items-baseline justify-between mb-2">
        <label for="plazas" class="text-sm text-(--ui-text-muted)">seats requested</label>
        <b class="numero text-sm">{{ plazasPedidas }}</b>
      </div>
      <USlider
        id="plazas"
        v-model="plazasPedidas"
        data-testid="slider-plazas"
        :min="1"
        :max="4"
        :step="1"
      />
    </div>

    <p class="numero text-(--ui-text-muted) text-xs">
      driver window &amp; passenger window: 07:00–08:00 UTC, Oct 1 2026 · overlap required
    </p>
  </div>
</template>
