<script setup lang="ts">
// REQUISITO 9 · dos pasajeros, una plaza, el mismo instante.
//
// La carrera se dispara contra la API del servidor cuando existe (el modo
// fullstack de verdad: la reserva atómica ocurre en Nitro) y contra el motor
// en memoria cuando la página es estática (GitHub Pages). Los NÚMEROS son los
// mismos porque el código es el mismo: server/api/carrera.post.ts importa el
// mismo motor/reserva.ts que este componente importa aquí.
//
// Hallazgos de la auditoría que este componente corrige: H1 (el botón huérfano
// arriba a la derecha — ahora es full-width bajo la explicación), M5 (sin
// estados: ahora hay "requesting…" con deshabilitado, y un toast al terminar).
import { MotorReserva } from 'motor/reserva'
import { conductoresMozambique } from 'motor/escenarios'

type EstadoPasajero = 'esperando' | 'pidiendo' | 'gana' | 'pierde'

interface ResultadoPasajero {
  estado: EstadoPasajero
  detalle: string
}

const toast = useToast()

const corriendo = ref(false)
const ana = ref<ResultadoPasajero>({ estado: 'esperando', detalle: 'ready' })
const bruno = ref<ResultadoPasajero>({ estado: 'esperando', detalle: 'ready' })
const invariante = ref<string | null>(null)
const modoServidor = ref<boolean | null>(null)

async function correr() {
  corriendo.value = true
  ana.value = { estado: 'pidiendo', detalle: 'requesting…' }
  bruno.value = { estado: 'pidiendo', detalle: 'requesting…' }
  invariante.value = null

  let exitoAna: unknown = null
  let exitoBruno: unknown = null
  let plazasDespues = -1

  try {
    // 1 · contra la API real del servidor, si está viva
    const r = await $fetch<{
      ganadora: string | null
      plazas_despues: number
      modo: string
    }>('/api/carrera', {
      method: 'POST',
      body: { carreras: 1 },
      timeout: 8_000,
    })
    modoServidor.value = r.modo === 'servidor'
    exitoAna = r.ganadora === 'ana'
    exitoBruno = r.ganadora === 'bruno'
    plazasDespues = r.plazas_despues
  } catch {
    // 2 · la página estática (GitHub Pages): el MISMO motor, en el navegador
    modoServidor.value = false
    const motor = new MotorReserva([{ ...conductoresMozambique()[1]!, plazas: 1 }])
    const [rA, rB] = await Promise.all([
      motor.reservar('drv-tomas', 'ana', 1),
      motor.reservar('drv-tomas', 'bruno', 1),
    ])
    exitoAna = rA
    exitoBruno = rB
    plazasDespues = motor.plazasDe('drv-tomas')
  }

  ana.value = exitoAna
    ? { estado: 'gana', detalle: 'seat held · atomic conditional write committed' }
    : { estado: 'pierde', detalle: 'atomic conditional write returned 0 rows' }
  bruno.value = exitoBruno
    ? { estado: 'gana', detalle: 'seat held · atomic conditional write committed' }
    : { estado: 'pierde', detalle: 'atomic conditional write returned 0 rows' }

  const exitos = [exitoAna, exitoBruno].filter(Boolean).length
  invariante.value =
    exitos === 1
      ? `invariant holds: exactly one winner · seats now ${plazasDespues} · the loser got nothing`
      : `INVARIANT BROKEN: ${exitos} winners`

  toast.add({
    title: exitos === 1 ? 'Exactly one seat sold' : 'INVARIANT BROKEN',
    description:
      exitos === 1
        ? `One reservation committed, one refused. Seats after the write: ${plazasDespues}.`
        : 'Both passengers believe they have the seat. This must never happen.',
    icon: exitos === 1 ? 'i-lucide-lock' : 'i-lucide-octagon-alert',
    color: exitos === 1 ? 'success' : 'error',
  })

  corriendo.value = false
}
</script>

<template>
  <section
    class="bg-panel border border-linea rounded-xl p-4 sm:p-5"
    data-testid="carrera"
    aria-label="Requirement 9 — two passengers, one seat"
  >
    <h2 class="text-base font-semibold">Requirement 9 — two passengers, one seat</h2>
    <p class="text-sm text-(--ui-text-muted) mt-1.5 leading-relaxed">
      Ana and Bruno request Tomás's last available seat at the same instant. The reservation is
      an atomic conditional write: reading “1 seat left” and writing “0” cannot interleave.
      One wins, one is refused — always.
    </p>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
      <div
        v-for="p in [
          { id: 'ana', nombre: 'Ana', r: ana },
          { id: 'bruno', nombre: 'Bruno', r: bruno },
        ]"
        :key="p.id"
        :data-testid="`pasajero-${p.id}`"
        class="border rounded-xl p-3.5 transition-colors"
        :class="[
          p.r.estado === 'gana' ? 'border-ok bg-green-950/20' : '',
          p.r.estado === 'pierde' ? 'border-mal bg-red-950/20' : '',
          p.r.estado === 'esperando' || p.r.estado === 'pidiendo' ? 'border-linea bg-panel2' : '',
        ]"
      >
        <div class="flex items-baseline justify-between">
          <h3 class="text-sm font-semibold">{{ p.nombre }}</h3>
          <span
            :data-testid="`estado-${p.id}`"
            class="numero text-xs font-bold"
            :class="{
              'text-ok': p.r.estado === 'gana',
              'text-mal': p.r.estado === 'pierde',
              'text-(--ui-text-muted)': p.r.estado !== 'gana' && p.r.estado !== 'pierde',
            }"
          >
            {{
              p.r.estado === 'gana'
                ? 'SEAT RESERVED'
                : p.r.estado === 'pierde'
                  ? 'REFUSED'
                  : p.r.estado === 'pidiendo'
                    ? 'REQUESTING…'
                    : '— WAITING'
            }}
          </span>
        </div>
        <p class="numero text-(--ui-text-muted) text-xs mt-2 leading-relaxed">{{ p.r.detalle }}</p>
      </div>
    </div>

    <UButton
      class="mt-4 w-full justify-center"
      size="lg"
      color="primary"
      icon="i-lucide-zap"
      :loading="corriendo"
      :disabled="corriendo"
      data-testid="btn-carrera"
      @click="correr"
    >
      {{ corriendo ? 'racing…' : invariante ? 'Run it again' : 'Run the race' }}
    </UButton>

    <p
      v-if="invariante"
      class="numero text-(--ui-text-muted) text-xs mt-3"
      data-testid="invariante"
    >
      {{ invariante }}
      <UBadge
        class="ml-1"
        size="sm"
        variant="subtle"
        :color="modoServidor ? 'success' : 'neutral'"
        :icon="modoServidor ? 'i-lucide-server' : 'i-lucide-monitor'"
        :label="modoServidor ? 'ran on the server (Nitro API)' : 'ran in your browser (same engine)'"
      />
    </p>

    <p class="numero text-(--ui-text-muted) text-xs mt-2">
      invariant: exactly <b class="text-ok">one</b> reservation · seats never below
      <b class="text-ok">0</b> · no partial writes
    </p>
  </section>
</template>
