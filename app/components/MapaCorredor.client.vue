<script setup lang="ts">
// El mapa es EL argumento de la demo (hallazgo C1: en la v1 quedaba bajo el
// fold). Teselas Esri World Light Gray: el único proveedor sin clave que
// entrega la tesela LIMPIA — CARTO responde 200 con «API KEY REQUIRED»
// impreso encima (el sexto «200 mentiroso», medido en el banco de pruebas).
// Fondo gris → la ruta dorada es lo único con color de la pantalla.
const { definicion, ruta, peticion, proyeccionRecogida, proyeccionDestino, corredorM, puntoEnFraccion } =
  usePrueba()

const ORIGEN_CENTRO: Record<string, [number, number]> = {
  A: [-25.85, 32.6],
  B: [-25.85, 32.6],
  L1: [-8.885, 13.33],
  L2: [-8.885, 13.33],
}

const centro = computed(() => ORIGEN_CENTRO[definicion.value.id] ?? [-25.85, 32.6])
const zoom = computed(() => (definicion.value.pais === 'mz' ? 10 : 12))

const coords = computed(() => ruta.value.map((p) => [p.lat, p.lon] as [number, number]))

const lineaRecogida = computed(() => {
  const pie = puntoEnFraccion(proyeccionRecogida.value.fraccion)
  return [
    [peticion.value.recogida.lat, peticion.value.recogida.lon] as [number, number],
    pie,
  ]
})

const lineaDestino = computed(() => {
  const pie = puntoEnFraccion(proyeccionDestino.value.fraccion)
  return [
    [peticion.value.destino.lat, peticion.value.destino.lon] as [number, number],
    pie,
  ]
})
</script>

<template>
  <div class="mapa-contenedor" data-testid="mapa">
    <ClientOnly>
      <LMap
        :key="definicion.id"
        :zoom="zoom"
        :center="centro"
        :use-global-leaflet="false"
        style="height: 100%"
      >
        <LTileLayer
          url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}"
          attribution="Esri, HERE, Garmin, OpenStreetMap"
          layer-type="base"
          name="gris"
        />

        <!-- el corredor visual: el radio sobre cada vértice, VIVO contra el slider -->
        <LCircle
          v-for="(p, i) in ruta"
          :key="`corredor-${i}`"
          :lat-lng="[p.lat, p.lon]"
          :radius="corredorM"
          color="#d4a017"
          :weight="0.5"
          :opacity="0.35"
          :fill-opacity="0.04"
        />

        <!-- la ruta del conductor: la polilínea REAL contra la que se mide todo -->
        <LPolyline :lat-lngs="coords" color="#d4a017" :weight="4" :opacity="0.95" />

        <!-- las proyecciones: la distancia que decide el corredor y el desvío -->
        <LPolyline
          :lat-lngs="lineaRecogida"
          color="#4a90d9"
          :dash-array="'4 6'"
          :weight="1.5"
        />
        <LPolyline
          :lat-lngs="lineaDestino"
          color="#3fb27f"
          :dash-array="'4 6'"
          :weight="1.5"
        />

        <LCircleMarker
          :lat-lng="[peticion.recogida.lat, peticion.recogida.lon]"
          :radius="7"
          color="#4a90d9"
          fill-color="#4a90d9"
          :fill-opacity="0.9"
        >
          <LTooltip :options="{ permanent: true, direction: 'left' }">pickup</LTooltip>
        </LCircleMarker>
        <LCircleMarker
          :lat-lng="[peticion.destino.lat, peticion.destino.lon]"
          :radius="7"
          color="#3fb27f"
          fill-color="#3fb27f"
          :fill-opacity="0.9"
        >
          <LTooltip :options="{ permanent: true, direction: 'right' }">destination</LTooltip>
        </LCircleMarker>
      </LMap>

      <!-- estado de carga real: un esqueleto con la silueta del mapa (hallazgo M5) -->
      <template #fallback>
        <div class="w-full h-full flex items-center justify-center bg-panel2">
          <USkeleton class="w-full h-full rounded-none" />
        </div>
      </template>
    </ClientOnly>

    <div
      class="absolute bottom-2 left-2 z-[500] bg-carbon/85 border border-linea rounded-md px-2.5 py-1.5 text-xs numero"
      aria-hidden="true"
    >
      — route · ● pickup · ▲ destination
    </div>
  </div>
</template>
