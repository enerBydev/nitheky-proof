// /api/reiniciar — re-siembra las plazas del almacén en memoria para volver
// a disparar la carrera contra la ÚLTIMA plaza. El equivalente PostGIS es la
// primera frase de sql/carrera.sh.
import { reiniciarAlmacen } from '../utils/almacen'

export default defineEventHandler(() => {
  reiniciarAlmacen()
  return { ok: true, detalle: 'seats re-seeded from motor/escenarios.ts' }
})
