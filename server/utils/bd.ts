// La base de datos es OPCIONAL por diseño: la demo vive sin ella (GitHub
// Pages, pruebas locales rápidas) y se vuelve PostGIS en cuanto existe
// DATABASE_URL. El modo activo lo declara /api/salud — nunca se pretende.
import { Pool } from 'pg'

let _pool: Pool | null = null

export function bdConfigurada(): boolean {
  // Una URL vacía o en blanco no es una base: entornos que exportan la
  // variable "por si acaso" no deben activar el modo postgres por accidente.
  return !!process.env.DATABASE_URL?.trim()
}

export function pool(): Pool | null {
  if (!bdConfigurada()) return null
  if (!_pool) {
    _pool = new Pool({ connectionString: process.env.DATABASE_URL, max: 10 })
  }
  return _pool
}

/** Una consulta, tipada. El que la llama decide qué hacer si no hay base. */
export async function sql<T>(texto: string, parametros: unknown[] = []): Promise<T[]> {
  const p = pool()
  if (!p) throw new Error('DATABASE_URL no está configurada')
  const r = await p.query(texto, parametros as never[])
  return r.rows as T[]
}
