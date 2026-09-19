<script setup lang="ts">
// Los cuatro escenarios del encargo, como botones con su veredicto esperado.
// Hallazgo H6 de la auditoría: la v1 apretaba el texto; estos respiran y el
// resultado esperado es un badge de color, no texto flotando a la derecha.
const { escenarios, escenario } = usePrueba()
</script>

<template>
  <div class="flex flex-col gap-2">
    <button
      v-for="e in escenarios"
      :key="e.id"
      :data-testid="`escenario-${e.id}`"
      type="button"
      class="text-left rounded-lg border px-3 py-3 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-oro"
      :class="
        escenario === e.id
          ? 'border-oro bg-amber-950/40'
          : 'border-linea bg-panel hover:border-oro/60'
      "
      :aria-pressed="escenario === e.id"
      @click="escenario = e.id"
    >
      <span class="flex items-center justify-between gap-2">
        <b class="text-sm">{{ e.etiqueta }}</b>
        <UBadge
          size="sm"
          variant="subtle"
          :color="e.esperado === 'match' ? 'success' : 'error'"
          :icon="e.esperado === 'match' ? 'i-lucide-check' : 'i-lucide-x'"
          :label="e.esperado === 'match' ? 'expects match' : 'expects reject'"
        />
      </span>
      <small class="block text-(--ui-text-muted) text-xs mt-1.5 leading-relaxed">
        {{ e.descripcion }}
      </small>
    </button>
  </div>
</template>
