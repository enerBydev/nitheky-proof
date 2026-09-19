<script setup lang="ts">
// El shell: cabecera con la identidad, pie con la declaración de honestidad.
// Nada de navegación compleja: son dos páginas y el argumento es una sola.
const { data: salud } = await useFetch('/api/salud')
const motorVivo = computed(() => salud.value?.modo_bd === 'postgres')
</script>

<template>
  <div class="min-h-screen flex flex-col bg-carbon text-(--ui-text)">
    <header
      class="border-b border-linea px-4 py-5 sm:px-8 flex flex-wrap gap-4 items-baseline justify-between"
    >
      <div>
        <h1 class="text-xl font-bold tracking-wide">
          NITHEKY <span class="text-oro">· same-direction matching</span>
        </h1>
        <p class="text-sm text-(--ui-text-muted) mt-1 max-w-2xl">
          Technical proof — route corridor, direction validation, atomic last-seat reservation.
          Nuxt 4 fullstack: the math on this page is the same module the test suite verifies.
        </p>
      </div>
      <nav class="flex items-center gap-4 text-sm">
        <UBadge
          v-if="salud"
          :icon="motorVivo ? 'i-lucide-database' : 'i-lucide-cpu'"
          :color="motorVivo ? 'success' : 'neutral'"
          variant="subtle"
          :label="motorVivo ? 'PostGIS live' : 'in-memory engine'"
        />
        <UButton
          to="/requisitos"
          variant="link"
          color="neutral"
          icon="i-lucide-list-checks"
          label="the nine requirements"
        />
        <UButton
          to="https://github.com/enerBydev/nitheky-proof"
          target="_blank"
          variant="link"
          color="neutral"
          icon="i-lucide-github"
          label="repository"
        />
      </nav>
    </header>

    <main class="flex-1">
      <NuxtPage />
    </main>

    <footer class="border-t border-linea px-4 py-5 sm:px-8 text-sm text-(--ui-text-muted)">
      <p class="max-w-4xl">
        <strong class="text-(--ui-text)">What is demo and what is reusable.</strong>
        Demo: the seed drivers and this page. Reusable as-is:
        <span class="numero">motor/</span> (the matching arithmetic, zero dependencies) and
        <span class="numero">sql/</span> (PostGIS schema + query + atomic reservation — the parts
        that cannot be “added later”). Every number on this page is computed by the same module
        the test suite verifies. Nothing here is a promise of behaviour — it is the behaviour.
      </p>
    </footer>
  </div>
</template>
