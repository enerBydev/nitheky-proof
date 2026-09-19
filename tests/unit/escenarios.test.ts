// LOS DOS ESCENARIOS DEL ENCARGO, palabra por palabra:
//
//   Match:   Driver Maputo→Marracuene + Passenger Zimpeto→Marracuene
//   Reject:  Driver Maputo→Marracuene + Passenger Zimpeto→Maputo
//
// Cada aserción lleva su numero medido al lado. Si algo falla, la salida dice
// exactamente QUÉ cantidad no cuadra — no un "expected true, received false".
//
// (Puerto de node:test a Vitest, sin tocar UNA sola aserción.)

import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

import { buscarConductores, evaluar } from 'motor/matching'
import { proyectar, haversine, longitudPolilinea } from 'motor/geoespacial'
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  ZIMPETO,
  MARRACUENE,
  MAPUTO_CENTRO,
  CORREDOR_MZ,
} from 'motor/escenarios'

describe('los escenarios del encargo', () => {
  it('la ruta existe y mide lo que tiene que medir', () => {
    const km = longitudPolilinea(CORREDOR_MZ) / 1000
    expect(km).toBeGreaterThan(28)
    expect(km).toBeLessThan(32)
  })

  it('Zimpeto cae en la mitad de la ruta (fracción ~0.53)', () => {
    const p = proyectar(ZIMPETO, CORREDOR_MZ)
    expect(Math.abs(p.fraccion - 0.526)).toBeLessThan(0.01)
    expect(Math.round(p.distancia_m)).toBe(0) // Zimpeto es vértice de la ruta
  })

  it('ESCENARIO A · Zimpeto→Marracuene ENCUENTRA conductores', () => {
    const { matches } = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene())
    expect(matches.length).toBeGreaterThanOrEqual(2)
    for (const m of matches) {
      expect(m.fraccionRecogida).toBeLessThan(m.fraccionDestino)
    }
    expect(matches[0]!.conductorId).toBe('drv-amelia')
    expect(Math.round(matches[0]!.desvioM)).toBe(0) // vértices: desvío 0 m
  })

  it('ESCENARIO B · Zimpeto→Maputo se RECHAZA por dirección opuesta', () => {
    const conductores = conductoresMozambique().filter((c) => c.id !== 'drv-joaquim')
    for (const c of conductores) {
      const r = evaluar(c, pasajeroZimpetoMaputo())
      expect('motivo' in r, `${c.id} debe rechazar`).toBe(true)
      if ('motivo' in r) {
        expect(r.motivo, `${c.id}: ${r.motivo} — ${r.detalle}`).toBe('direccion_opuesta')
      }
    }
    const pr = proyectar(ZIMPETO, CORREDOR_MZ)
    const pd = proyectar(MAPUTO_CENTRO, CORREDOR_MZ)
    // recogida frac 0.526 ≥ destino frac 0.000 → hacia atrás
    expect(pr.fraccion).toBeGreaterThanOrEqual(pd.fraccion)
  })

  it('ninguna parte del motor sabe en qué país está', () => {
    // La unica geografía que conoce el motor son las coordenadas de las rutas.
    // Este test existe para que quede dicho: no hay ni un nombre de ciudad,
    // país, prefijo o divisa en el código del motor — solo números. La
    // geografía NOMBRADA vive en escenarios.ts, que es dato, no lógica.
    const dirMotor = fileURLToPath(new URL('../../motor', import.meta.url))
    const prohibido = /mozambique|angola|maputo|marracuene|zimpeto|luanda|mzn|ao\b/i
    for (const f of ['matching.ts', 'geoespacial.ts', 'reserva.ts']) {
      const texto = readFileSync(join(dirMotor, f), 'utf8')
      const enCodigo = texto
        .split('\n')
        .filter((l) => !l.trim().startsWith('//'))
        .join('\n')
      expect(enCodigo.match(prohibido), `${f} contiene nombres de países en código`).toBeNull()
    }
  })

  it('distancias de referencia (para contrastar con el SQL)', () => {
    const d = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
      (haversine(a, b) / 1000).toFixed(2)
    // Los valores de la v1, verificados contra el SQL: 13.44 · 14.21 · 25.69
    expect(d(MAPUTO_CENTRO, ZIMPETO)).toBe('13.44')
    expect(d(ZIMPETO, MARRACUENE)).toBe('14.21')
    expect(d(MAPUTO_CENTRO, MARRACUENE)).toBe('25.69')
  })
})
