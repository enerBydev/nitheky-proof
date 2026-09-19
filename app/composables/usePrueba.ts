// El estado de la prueba y TODOS los números que la página muestra.
//
// REGLA HEREDADA (la razón de ser del repo): la página no calcula nada por
// su cuenta — importa el MISMO motor que los tests verifican y el SQL
// documenta. Si esta página mostrara números distintos a los tests, sería
// una página rota, no otra versión.
//
// Lo que SÍ vive aquí (y no en el motor): los textos en inglés. El motor
// emite códigos y números (`direccion_opuesta`, fracciones, metros); la
// traducción a palabras es asunto de la capa que enseña, no de la que decide.
// La v1 incumplía esto: la UI en inglés mostraba los strings en español del
// motor (hallazgo C2 de la auditoría).
import { computed } from 'vue'
import { proyectar, haversine, longitudPolilinea, type Polilinea } from 'motor/geoespacial'
import { buscarConductores, type RutaConductor, type Rechazo } from 'motor/matching'
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
  CORREDOR_MZ,
  CORREDOR_AO,
} from 'motor/escenarios'

export type EscenarioId = 'A' | 'B' | 'L1' | 'L2'

export interface DefinicionEscenario {
  id: EscenarioId
  etiqueta: string
  esperado: 'match' | 'reject'
  descripcion: string
  pais: 'mz' | 'ao'
  peticion: () => ReturnType<typeof pasajeroZimpetoMarracuene>
  centro: [number, number]
  zoom: number
}

const ESCENARIOS: DefinicionEscenario[] = [
  {
    id: 'A',
    etiqueta: 'A — Zimpeto → Marracuene',
    esperado: 'match',
    descripcion: 'Driver Maputo→Marracuene. Zimpeto lies along the route, direction compatible.',
    pais: 'mz',
    peticion: pasajeroZimpetoMarracuene,
    centro: [-25.85, 32.6],
    zoom: 10,
  },
  {
    id: 'B',
    etiqueta: 'B — Zimpeto → Maputo',
    esperado: 'reject',
    descripcion: 'Driver Maputo→Marracuene. The passenger travels the opposite direction.',
    pais: 'mz',
    peticion: pasajeroZimpetoMaputo,
    centro: [-25.85, 32.6],
    zoom: 10,
  },
  {
    id: 'L1',
    etiqueta: 'Luanda — Cacuaco → Viana',
    esperado: 'match',
    descripcion: 'Country-neutral: same engine, Angola, zero reconfiguration.',
    pais: 'ao',
    peticion: pasajeroCacuacoViana,
    centro: [-8.885, 13.33],
    zoom: 12,
  },
  {
    id: 'L2',
    etiqueta: 'Luanda — Viana → Luanda centre',
    esperado: 'reject',
    descripcion: 'Opposite direction in Angola: also rejected.',
    pais: 'ao',
    peticion: pasajeroVianaLuanda,
    centro: [-8.885, 13.33],
    zoom: 12,
  },
]

/** Nombres con cara humana: el identificador es del motor, la cara es de la UI. */
const NOMBRES: Record<string, string> = {
  'drv-amelia': 'Amélia',
  'drv-tomas': 'Tomás',
  'drv-isabel': 'Isabel',
  'drv-joaquim': 'Joaquim',
}

/** La traducción de los códigos de rechazo del motor a la lengua de la página. */
const MOTIVO_EN: Record<Rechazo['motivo'], string> = {
  sin_plazas: 'no seats left',
  fuera_de_corredor: 'outside the route corridor',
  direccion_opuesta: 'opposite direction along the route',
  ventana_incompatible: 'departure windows do not overlap',
  desvio_excesivo: 'detour exceeds the accepted maximum',
}

export function usePrueba() {
  // Estado COMPARTIDO entre todos los componentes de la página (useState de
  // Nuxt: seguro en SSR — un ref de módulo se contaminaría entre peticiones).
  // La v1 de este composable usaba refs locales: cada componente vivía en su
  // propio mundo y el selector cambiaba un estado que nadie más veía.
  const escenario = useState<EscenarioId>('nitheky:escenario', () => 'A')
  const corredorM = useState<number>('nitheky:corredorM', () => 1500)
  const desvioMaxM = useState<number>('nitheky:desvioMaxM', () => 3000)
  const plazasPedidas = useState<number>('nitheky:plazas', () => 1)

  const definicion = computed(
    () => ESCENARIOS.find((e) => e.id === escenario.value) ?? ESCENARIOS[0]!,
  )

  const peticion = computed(() => ({
    ...definicion.value.peticion(),
    corredorM: corredorM.value,
    desvioMaxM: desvioMaxM.value,
    plazas: plazasPedidas.value,
  }))

  const conductores = computed<RutaConductor[]>(() => conductoresMozambique())

  const resultado = computed(() => buscarConductores(conductores.value, peticion.value))

  const ruta = computed<Polilinea>(() =>
    definicion.value.pais === 'mz' ? CORREDOR_MZ : CORREDOR_AO,
  )

  const proyeccionRecogida = computed(() => proyectar(peticion.value.recogida, ruta.value))
  const proyeccionDestino = computed(() => proyectar(peticion.value.destino, ruta.value))

  const kmRuta = computed(() => longitudPolilinea(ruta.value) / 1000)

  /** Solo los conductores del corredor del escenario: los de Maputo no
   * dicen nada en Luanda y al revés (regla de la v1, que era correcta). */
  const conductoresDelPais = computed(() =>
    resultado.value.rechazados.filter((r) =>
      escenario.value.startsWith('L') ? r.conductorId === 'drv-joaquim' : r.conductorId !== 'drv-joaquim',
    ),
  )

  /** La fila de rechazo EN INGLÉS con SUS números: las fracciones y metros
   * que el motor midió, traducidos por la capa de presentación. */
  const rechazosTraducidos = computed(() =>
    conductoresDelPais.value.map((r) => ({
      conductorId: r.conductorId,
      nombre: NOMBRES[r.conductorId] ?? r.conductorId,
      motivo: r.rechazo.motivo,
      motivoEn: MOTIVO_EN[r.rechazo.motivo]!,
      detalle: traducirDetalle(r.rechazo, r.conductorId),
    })),
  )

  function traducirDetalle(rechazo: Rechazo, conductorId: string): string {
    const c = conductores.value.find((x) => x.id === conductorId)
    switch (rechazo.motivo) {
      case 'direccion_opuesta': {
        const pr = proyeccionRecogida.value
        const pd = proyeccionDestino.value
        return `pickup falls at fraction ${pr.fraccion.toFixed(3)} of the route, dropoff at ${pd.fraccion.toFixed(3)} — the passenger travels backwards`
      }
      case 'sin_plazas':
        return `${c?.plazas ?? 0} seats left, ${peticion.value.plazas} requested`
      case 'fuera_de_corredor': {
        const pr = proyeccionRecogida.value
        const pd = proyeccionDestino.value
        const peor = Math.max(pr.distancia_m, pd.distancia_m)
        return `${Math.round(peor)} m from the route; the corridor is ${corredorM.value} m`
      }
      case 'ventana_incompatible':
        return 'the departure windows share not a single minute'
      case 'desvio_excesivo': {
        const d = proyeccionRecogida.value.distancia_m + proyeccionDestino.value.distancia_m
        return `the detour adds ${Math.round(d)} m; the accepted maximum is ${desvioMaxM.value} m`
      }
    }
  }

  /** El punto de la ruta en una fracción del arco — para dibujar las líneas
   * punteadas de la proyección. Con haversine del motor, no con la
   * aproximación plana de la v1: el pie dibujado es el pie medido. */
  function puntoEnFraccion(frac: number): [number, number] {
    const r = ruta.value
    const tramos: number[] = []
    let total = 0
    for (let i = 0; i < r.length - 1; i++) {
      const d = haversine(r[i]!, r[i + 1]!)
      tramos.push(d)
      total += d
    }
    const objetivo = frac * total
    let acum = 0
    for (let i = 0; i < tramos.length; i++) {
      if (acum + tramos[i]! >= objetivo) {
        const t = (objetivo - acum) / tramos[i]!
        return [r[i]!.lat + (r[i + 1]!.lat - r[i]!.lat) * t, r[i]!.lon + (r[i + 1]!.lon - r[i]!.lon) * t]
      }
      acum += tramos[i]!
    }
    return [r.at(-1)!.lat, r.at(-1)!.lon]
  }

  function nombreDe(id: string): string {
    return NOMBRES[id] ?? id
  }

  function conductorDe(id: string): RutaConductor | undefined {
    return conductores.value.find((c) => c.id === id)
  }

  /** Solape máximo de ventanas con los conductores del país (req 6 en vivo). */
  const solapeMaxMin = computed(() => {
    const delPais = conductores.value.filter((c) =>
      escenario.value.startsWith('L') ? c.id === 'drv-joaquim' : c.id !== 'drv-joaquim',
    )
    let max = 0
    for (const c of delPais) {
      const inicio = Math.max(c.ventana.inicio, peticion.value.ventana.inicio)
      const fin = Math.min(c.ventana.fin, peticion.value.ventana.fin)
      if (fin > inicio) max = Math.max(max, (fin - inicio) / 60_000)
    }
    return max
  })

  return {
    // estado
    escenario,
    corredorM,
    desvioMaxM,
    plazasPedidas,
    escenarios: ESCENARIOS,
    // derivados
    definicion,
    peticion,
    resultado,
    ruta,
    proyeccionRecogida,
    proyeccionDestino,
    kmRuta,
    rechazosTraducidos,
    solapeMaxMin,
    // utilidades
    puntoEnFraccion,
    nombreDe,
    conductorDe,
  }
}
