// /api/carrera — la carrera por la última plaza, DEL LADO DEL SERVIDOR.
//
// Dos pasajeros piden la misma plaza en el MISMO instante; el invariante se
// comprueba, no se promete. La página la usa cuando el servidor está vivo;
// en GitHub Pages (estático) el navegador corre el MISMO motor localmente.
import { z } from 'zod'
import { MotorReserva } from '../../motor/reserva.ts'
import { conductoresMozambique } from '../../motor/escenarios.ts'

const EsquemaCarrera = z.object({
  carreras: z.number().int().min(1).max(5_000).default(1),
})

export default defineEventHandler(async (event) => {
  const { carreras } = await readValidatedBody(event, (b) => EsquemaCarrera.parse(b))

  let dobles = 0
  let justas = 0
  let ganadora: string | null = null
  let plazasDespues = -1

  for (let i = 0; i < carreras; i++) {
    const motor = new MotorReserva([{ ...conductoresMozambique()[1]!, plazas: 1 }])
    const [r1, r2] = await Promise.all([
      motor.reservar('drv-tomas', 'ana', 1),
      motor.reservar('drv-tomas', 'bruno', 1),
    ])
    const exitos = [r1, r2].filter(Boolean).length
    if (exitos === 2) dobles++
    if (exitos === 1) justas++
    if (exitos > 1 || motor.plazasDe('drv-tomas') < 0) {
      // El invariante ROTO se reporta con su carrera: el día que pase, la
      // salida dice exactamente dónde mirar.
      return {
        modo: 'servidor',
        carreras_corridas: i + 1,
        dobles,
        justas,
        invariante: false,
        detalle: `carrera ${i}: ${exitos} plazas vendidas de una`,
      }
    }
    ganadora = r1 ? 'ana' : 'bruno'
    plazasDespues = motor.plazasDe('drv-tomas')
  }

  return {
    modo: 'servidor',
    carreras: carreras,
    dobles,
    justas,
    invariante: dobles === 0 && justas === carreras,
    ganadora,
    plazas_despues: plazasDespues,
  }
})
