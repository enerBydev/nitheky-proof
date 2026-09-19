// REQUISITO 9 · dos pasajeros, la última plaza, a la vez.
//
// El test NO es "reservo dos veces y la segunda falla" — eso no demuestra
// nada, eso es una cola. El test es que AMBAS peticiones se disparan AL
// MISMO TIEMPO, con su latencia entrelazada, 1.000 carreras seguidas.
// Si en una sola carrera se venden dos plazas, el test lo encuentra.
// (Puerto de node:test a Vitest, sin tocar UNA sola aserción.)

import { describe, expect, it } from 'vitest'

import { MotorReserva } from 'motor/reserva'
import { conductoresMozambique } from 'motor/escenarios'

const CARRERAS = 1000

describe('la última plaza', () => {
  it(`se vende UNA vez en ${CARRERAS} carreras simultáneas`, async () => {
    let dobles = 0
    let justas = 0

    for (let i = 0; i < CARRERAS; i++) {
      const motor = new MotorReserva([{ ...conductoresMozambique()[1]!, plazas: 1 }])

      const [r1, r2] = await Promise.all([
        motor.reservar('drv-tomas', 'pasajero-ana', 1),
        motor.reservar('drv-tomas', 'pasajero-bruno', 1),
      ])

      const exitos = [r1, r2].filter(Boolean).length
      if (exitos === 2) dobles++
      if (exitos === 1) justas++

      // Invariantes, carrera a carrera:
      expect(exitos).toBeLessThanOrEqual(1)
      expect(motor.plazasDe('drv-tomas')).toBe(0)
      const reservas = motor.reservasDe('drv-tomas')
      expect(reservas.length).toBe(exitos)
      if (exitos === 1) {
        const ganador = (r1 ?? r2)!.pasajeroId
        expect(['pasajero-ana', 'pasajero-bruno']).toContain(ganador)
      }
    }

    expect(dobles, 'NUNCA se venden dos veces la última plaza').toBe(0)
    expect(justas, 'siempre gana exactamente una').toBe(CARRERAS)
  })

  it('tres pasajeros, dos plazas: entran dos y solo dos', async () => {
    const motor = new MotorReserva([{ ...conductoresMozambique()[0]!, plazas: 2 }])
    const rs = await Promise.all([
      motor.reservar('drv-amelia', 'p1', 1),
      motor.reservar('drv-amelia', 'p2', 1),
      motor.reservar('drv-amelia', 'p3', 1),
    ])
    const exitos = rs.filter(Boolean).length
    expect(exitos).toBe(2)
    expect(motor.plazasDe('drv-amelia')).toBe(0)
    const ids = new Set(rs.filter(Boolean).map((r) => r!.pasajeroId))
    expect(ids.size).toBe(2) // los dos ganadores son personas distintas
  })

  it('una reserva de 2 plazas contra 1 libre se rechaza entera (sin vender media)', async () => {
    const motor = new MotorReserva([{ ...conductoresMozambique()[1]!, plazas: 1 }])
    const r = await motor.reservar('drv-tomas', 'grupo-familiar', 2)
    expect(r).toBeNull()
    expect(motor.plazasDe('drv-tomas')).toBe(1) // la plaza libre sigue libre
  })
})
