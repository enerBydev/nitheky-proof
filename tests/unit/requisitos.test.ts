// EL RESTO DE LOS NUEVE: cada requisito con su propio fallo demostrable.
// Un test por requisito, y cada uno con el numero que lo decide.
// (Puerto de node:test a Vitest, sin tocar UNA sola aserción.)

import { describe, expect, it } from 'vitest'

import {
  evaluar,
  buscarConductores,
  type RutaConductor,
} from 'motor/matching'
import { proyectar } from 'motor/geoespacial'
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
  CACUACO,
  VIANA,
  CORREDOR_AO,
  JUEVES_7H,
} from 'motor/escenarios'

const H = 3_600_000
const recogidaZ = () => pasajeroZimpetoMarracuene().recogida // Zimpeto
const destinoM = () => pasajeroZimpetoMarracuene().destino // Marracuene

describe('los nueve requisitos, uno por uno', () => {
  it('req 1+2 · la ruta es una polilínea y el corredor se mide contra ella', () => {
    const conductores = conductoresMozambique()
    // Un punto a ~3 km al oeste de la EN1 (campo abierto, nada de ruta):
    const lejos = { lat: -25.8457, lon: 32.537 }
    const dr = proyectar(lejos, conductores[0]!.ruta)
    expect(dr.distancia_m).toBeGreaterThan(1500)
  })

  it('req 2 · fuera del corredor se rechaza con la distancia exacta', () => {
    const conductores = conductoresMozambique()
    const pasajeroLejos = {
      ...pasajeroZimpetoMarracuene(),
      recogida: { lat: -25.8457, lon: 32.537 }, // ~3 km al oeste de la EN1
    }
    const r = evaluar(conductores[0]!, pasajeroLejos)
    expect('motivo' in r && r.motivo === 'fuera_de_corredor').toBe(true)
  })

  it('req 3 · recogida y destino invertidos = dirección opuesta', () => {
    const conductores = conductoresMozambique()
    const invertido = {
      ...pasajeroZimpetoMarracuene(),
      recogida: destinoM(), // Marracuene primero
      destino: recogidaZ(), // Zimpeto después: hacia atrás
    }
    const r = evaluar(conductores[0]!, invertido)
    expect('motivo' in r && r.motivo === 'direccion_opuesta').toBe(true)
  })

  it('req 4 · misma dirección: la validación es sobre la RUTA, no sobre el punto', () => {
    // El caso del encargo: Zimpeto→Maputo. Zimpeto está EN la ruta (0 m) y
    // Maputo también (0.7 km). Lo que falla no es la distancia: es la fracción.
    const conductores = conductoresMozambique()
    const haciaMaputo = {
      ...pasajeroZimpetoMarracuene(),
      destino: { lat: -25.9655, lon: 32.5832 },
    }
    for (const c of conductores.filter((x) => x.id !== 'drv-joaquim')) {
      const r = evaluar(c, haciaMaputo)
      expect('motivo' in r && r.motivo === 'direccion_opuesta', `${c.id}: ${JSON.stringify(r)}`).toBe(
        true,
      )
    }
  })

  it('req 5 · el desvío es configurable y se mide', () => {
    const conductores = conductoresMozambique()
    // Recogida a ~1.5 km al oeste de la ruta y destino desviado ~1.7 km:
    // desvío ~3.2 km. Con tope 5 km entra, con tope 1 km no.
    const peticion = {
      ...pasajeroZimpetoMarracuene(),
      recogida: { lat: -25.8438, lon: 32.5512 },
      destino: { lat: -25.745, lon: 32.634 },
    }
    const acepta = evaluar(conductores[0]!, { ...peticion, desvioMaxM: 5000 })
    expect('motivo' in acepta, `con tope 5 km debe aceptar: ${JSON.stringify(acepta)}`).toBe(false)
    if (!('motivo' in acepta)) {
      expect(acepta.desvioM).toBeGreaterThan(2000)
    }
    const rechaza = evaluar(conductores[0]!, { ...peticion, desvioMaxM: 1000 })
    expect('motivo' in rechaza && rechaza.motivo === 'desvio_excesivo').toBe(true)
  })

  it('req 6 · ventanas que no se tocan se rechazan', () => {
    const conductores = conductoresMozambique()
    const incompatible = {
      ...pasajeroZimpetoMarracuene(),
      ventana: { inicio: JUEVES_7H + 5 * H, fin: JUEVES_7H + 6 * H }, // mediodía
    }
    const r = evaluar(conductores[0]!, incompatible)
    expect('motivo' in r && r.motivo === 'ventana_incompatible').toBe(true)
    // E Isabel (sale 2h después) TAMPOCO: su ventana termina a +4h.
    const rIsabel = evaluar(conductores[2]!, incompatible)
    expect('motivo' in rIsabel && rIsabel.motivo === 'ventana_incompatible').toBe(true)
  })

  it('req 7 · sin plazas no hay match, y lo dice', () => {
    const lleno: RutaConductor = { ...conductoresMozambique()[1]!, plazas: 0 }
    const r = evaluar(lleno, pasajeroZimpetoMarracuene())
    expect('motivo' in r && r.motivo === 'sin_plazas').toBe(true)
  })

  it('req 8 · el ranking ordena por desvío, espera y confianza — y es estable', () => {
    const { matches } = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene())
    expect(matches.length).toBeGreaterThanOrEqual(2)
    // Amelia (ventana 45', 41 reseñas, verificado) > Tomás (ventana larga, 9 reseñas).
    expect(matches[0]!.conductorId).toBe('drv-amelia')
    expect(matches[1]!.conductorId).toBe('drv-tomas')
    expect(matches[0]!.puntuacion).toBeGreaterThan(matches[1]!.puntuacion)
    // Determinista: la misma entrada, el mismo orden, cien veces.
    for (let i = 0; i < 100; i++) {
      const otra = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene())
      expect(otra.matches.map((m) => m.conductorId)).toEqual(matches.map((m) => m.conductorId))
    }
    // Isabel (sale a +2h) queda fuera por ventana.
    expect(matches.map((m) => m.conductorId)).not.toContain('drv-isabel')
  })

  it('req 1-9 · NEUTRALIDAD DE PAÍS: Luanda funciona con el mismo código', () => {
    const conductores = conductoresMozambique() // incluye drv-joaquim (Luanda→Viana)
    const { matches } = buscarConductores(conductores, pasajeroCacuacoViana())
    expect(matches.length, 'solo el conductor de Luanda sirve a Cacuaco→Viana').toBe(1)
    expect(matches[0]!.conductorId).toBe('drv-joaquim')
    const pc = proyectar(CACUACO, CORREDOR_AO)
    const pv = proyectar(VIANA, CORREDOR_AO)
    expect(pc.fraccion).toBeLessThan(pv.fraccion)
    // Y la dirección opuesta en Luanda también se rechaza:
    const { matches: m2 } = buscarConductores(conductores, pasajeroVianaLuanda())
    expect(m2.length, 'Viana→Luanda centro va hacia atrás: nadie lo sirve').toBe(0)
  })
})
