// El almacén en memoria del servidor: el estado de plazas entre peticiones.
//
// Es el gemelo de la tabla `conductores` de PostGIS: mismas plazas, mismos
// ids, la misma semilla. Cuando DATABASE_URL existe, los endpoints escriben
// contra Postgres y este almacén no se usa — /api/salud dice cuál está vivo.
//
// EL GETTER ES DINÁMICO a propósito: `reiniciarAlmacen()` sustituye la
// instancia en globalThis, y si los endpoints capturaran la instancia vieja
// en un import estático, la re-siembra no surtiría efecto. (Fallo real,
// encontrado por el E2E que reserva dos veces en dos proyectos seguidos.)
import { MotorReserva } from '../../motor/reserva.ts'
import { conductoresMozambique } from '../../motor/escenarios.ts'

const global_ = globalThis as unknown as { __nithekyAlmacen?: MotorReserva }

function crear(): MotorReserva {
  return new MotorReserva(conductoresMozambique())
}

/** El almacén vivo AHORA — singleton por proceso, reemplazable. */
export function almacenActual(): MotorReserva {
  global_.__nithekyAlmacen ??= crear()
  return global_.__nithekyAlmacen
}

/** Re-siembra las plazas (el equivalente del `update conductores set plazas…`
 * de sql/carrera.sh): para re-disparar la carrera contra la última plaza. */
export function reiniciarAlmacen(): void {
  global_.__nithekyAlmacen = crear()
}
