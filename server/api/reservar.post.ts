// /api/reservar — LA reserva atómica de la última plaza, expuesta.
//
// Postgres: `reservar_plaza()` de sql/03 (update condicional + CHECK).
// Memoria:  motor/reserva.ts (la sección crítica con candado de escritura).
// En ambos casos la condición y la escritura viajan JUNTAS: leer "queda 1"
// y escribir "0" no puede intercalarse.
import { z } from 'zod'
import { almacenActual } from '../utils/almacen'
import { sql, bdConfigurada } from '../utils/bd'

const EsquemaReservar = z.object({
  rutaId: z.string().min(1),
  pasajeroId: z.string().min(1),
  plazas: z.number().int().min(1).max(8).default(1),
})

export default defineEventHandler(async (event) => {
  const { rutaId, pasajeroId, plazas } = await readValidatedBody(
    event,
    (b) => EsquemaReservar.parse(b),
  )

  if (bdConfigurada()) {
    try {
      const filas = await sql<{ ok: boolean }>(
        'select reservar_plaza($1, $2, $3) as ok',
        [rutaId, pasajeroId, plazas],
      )
      return { modo: 'postgres', ok: filas[0]?.ok === true }
    } catch (e) {
      return {
        modo: 'memoria (postgres falló)',
        detalle_error: (e as Error).message,
        ok: null as boolean | null,
      }
    }
  }

  const reserva = await almacenActual().reservar(rutaId, pasajeroId, plazas)
  return { modo: 'memoria', ok: !!reserva, reserva }
})
