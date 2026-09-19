// E2E · la API fullstack, por HTTP de verdad, contra el servidor Nitro.
// Los mismos números que los tests unitarios del motor — pero esta vez
// atravesando la validación zod, el router de Nitro y el JSON.

import { expect, test } from '@playwright/test'

test.describe('api', () => {
  test('salud: dice qué está vivo y en qué modo', async ({ request }) => {
    const r = await request.get('/api/salud')
    expect(r.ok()).toBeTruthy()
    const d = await r.json()
    expect(d.ok).toBe(true)
    expect(['memoria', 'postgres']).toContain(d.modo_bd)
  })

  test('escenarios: los cuatro del encargo con sus coordenadas', async ({ request }) => {
    const r = await request.get('/api/escenarios')
    expect(r.ok()).toBeTruthy()
    const d = await r.json()
    expect(d.escenarios).toHaveLength(4)
    expect(d.escenarios.map((e: { id: string }) => e.id)).toEqual(['A', 'B', 'L1', 'L2'])
  })

  test('buscar A: 2 matches, Amélia primera con 91.4 (los números del motor)', async ({
    request,
  }) => {
    const r = await request.post('/api/buscar', { data: { escenario: 'A' } })
    expect(r.ok()).toBeTruthy()
    const d = await r.json()
    expect(d.modo).toBe('memoria')
    expect(d.matches).toHaveLength(2)
    expect(d.matches[0].conductorId).toBe('drv-amelia')
    expect(d.matches[0].puntuacion).toBe(91.4)
    expect(d.matches[0].desvioM).toBe(0)
  })

  test('buscar B: cero matches y el rechazo con su motivo', async ({ request }) => {
    const r = await request.post('/api/buscar', { data: { escenario: 'B' } })
    expect(r.ok()).toBeTruthy()
    const d = await r.json()
    expect(d.matches).toHaveLength(0)
    const motivos = d.rechazados.map((x: { rechazo: { motivo: string } }) => x.rechazo.motivo)
    expect(motivos).toContain('direccion_opuesta')
  })

  test('buscar L1: la neutralidad de país por la API', async ({ request }) => {
    const r = await request.post('/api/buscar', { data: { escenario: 'L1' } })
    const d = await r.json()
    expect(d.matches).toHaveLength(1)
    expect(d.matches[0].conductorId).toBe('drv-joaquim')
  })

  test('buscar con petición personalizada: los parámetros se respetan', async ({ request }) => {
    const r = await request.post('/api/buscar', {
      data: {
        recogida: { lat: -25.8457, lon: 32.5656 },
        destino: { lat: -25.7422, lon: 32.6489 },
        ventana: { inicio: 1_798_642_800_000, fin: 1_798_642_800_000 + 3_600_000 },
        plazas: 1,
        corredorM: 1500,
        desvioMaxM: 3000,
      },
    })
    const d = await r.json()
    expect(d.matches.length).toBeGreaterThanOrEqual(2)
  })

  test('buscar inválido: 400 que dice qué falló, no un 500 mudo', async ({ request }) => {
    const r = await request.post('/api/buscar', { data: { plazas: 99 } })
    expect(r.status()).toBe(400)
  })

  test('carrera: 100 carreras, cero dobles, invariante en true', async ({ request }) => {
    const r = await request.post('/api/carrera', { data: { carreras: 100 } })
    expect(r.ok()).toBeTruthy()
    const d = await r.json()
    expect(d.dobles).toBe(0)
    expect(d.justas).toBe(100)
    expect(d.invariante).toBe(true)
    expect(d.plazas_despues).toBe(0)
  })

  test('reservar la última plaza dos veces: la segunda devuelve false', async ({ request }) => {
    await request.post('/api/reiniciar')
    const r1 = await request.post('/api/reservar', {
      data: { rutaId: 'drv-tomas', pasajeroId: 'e2e-ana', plazas: 1 },
    })
    const d1 = await r1.json()
    expect(d1.ok).toBe(true)
    const r2 = await request.post('/api/reservar', {
      data: { rutaId: 'drv-tomas', pasajeroId: 'e2e-bruno', plazas: 1 },
    })
    const d2 = await r2.json()
    expect(d2.ok).toBe(false)
    await request.post('/api/reiniciar')
  })
})
