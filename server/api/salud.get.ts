// /api/salud — la convención de la casa (misma sonda que la demo anterior
// de ALoNNo): dice QUÉ está vivo, no solo que el proceso respira.
// `modo_bd` es la honestidad hecha endpoint: "memoria" o "postgres", y si
// dice postgres es porque un `select 1` acaba de contestar.
import { sql, bdConfigurada } from '../utils/bd'

export default defineEventHandler(async () => {
  let modo_bd: 'postgres' | 'memoria' = 'memoria'
  let detalle_bd = 'in-memory engine (no DATABASE_URL)'

  if (bdConfigurada()) {
    try {
      await sql('select 1')
      modo_bd = 'postgres'
      detalle_bd = 'PostGIS reachable — matching and reservations run in the database'
    } catch (e) {
      detalle_bd = `DATABASE_URL is set but unreachable: ${(e as Error).message}`
    }
  }

  return {
    ok: true,
    app: 'nitheky-proof',
    version: '2.0.0',
    motor: 'motor/ — same module the test suite verifies',
    modo_bd,
    detalle_bd,
    ts: new Date().toISOString(),
  }
})
