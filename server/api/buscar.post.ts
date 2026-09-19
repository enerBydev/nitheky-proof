// /api/buscar — LA consulta del matching, expuesta.
//
// Dos modos, y el response siempre dice cuál corrió:
//   · memoria  → motor/ (la misma aritmética que los 18 tests verifican)
//   · postgres → buscar_conductores() de sql/02 (corredor + dirección +
//                desvío + ventanas + plazas + ranking EN la base)
//
// La validación de entrada es zod: un 400 que dice QUÉ campo falló, no un
// 500 que no dice nada (regla de errores de la casa, doc 10 de ALoNNo).
import { z } from 'zod'
import { buscarConductores } from '../../motor/matching.ts'
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
} from '../../motor/escenarios.ts'
import { sql, bdConfigurada } from '../utils/bd'

const Punto = z.object({ lat: z.number().min(-90).max(90), lon: z.number().min(-180).max(180) })

const EsquemaBuscar = z
  .object({
    escenario: z.enum(['A', 'B', 'L1', 'L2']).optional(),
    recogida: Punto.optional(),
    destino: Punto.optional(),
    ventana: z.object({ inicio: z.number().int(), fin: z.number().int() }).optional(),
    plazas: z.number().int().min(1).max(8).default(1),
    corredorM: z.number().int().min(100).max(10_000).default(1500),
    desvioMaxM: z.number().int().min(100).max(20_000).default(3000),
  })
  .refine((v) => v.escenario || (v.recogida && v.destino && v.ventana), {
    message: 'either "escenario" or recogida+destino+ventana are required',
  })

const FABRICAS = {
  A: pasajeroZimpetoMarracuene,
  B: pasajeroZimpetoMaputo,
  L1: pasajeroCacuacoViana,
  L2: pasajeroVianaLuanda,
} as const

interface FilaPostgis {
  conductor_id: string
  nombre: string
  recogida_dist_m: number
  destino_dist_m: number
  fraccion_recogida: number
  fraccion_destino: number
  desvio_m: number
  solape_min: number
  puntuacion: number
}

export default defineEventHandler(async (event) => {
  const cuerpo = await readValidatedBody(event, (b) => EsquemaBuscar.parse(b))

  const peticion = cuerpo.escenario
    ? {
        ...FABRICAS[cuerpo.escenario](),
        plazas: cuerpo.plazas,
        corredorM: cuerpo.corredorM,
        desvioMaxM: cuerpo.desvioMaxM,
      }
    : {
        recogida: cuerpo.recogida!,
        destino: cuerpo.destino!,
        ventana: cuerpo.ventana!,
        plazas: cuerpo.plazas,
        corredorM: cuerpo.corredorM,
        desvioMaxM: cuerpo.desvioMaxM,
      }

  // ── modo PostGIS: la consulta de sql/02, tal cual ─────────────────────
  if (bdConfigurada()) {
    try {
      const filas = await sql<FilaPostgis>(
        `select * from buscar_conductores(
           st_setsrid(st_makepoint($1, $2), 4326)::geography,
           st_setsrid(st_makepoint($3, $4), 4326)::geography,
           tstzrange(to_timestamp($5), to_timestamp($6)),
           $7, $8, $9)`,
        [
          peticion.recogida.lon,
          peticion.recogida.lat,
          peticion.destino.lon,
          peticion.destino.lat,
          peticion.ventana.inicio / 1000,
          peticion.ventana.fin / 1000,
          peticion.plazas,
          peticion.corredorM,
          peticion.desvioMaxM,
        ],
      )
      return {
        modo: 'postgres',
        matches: filas.map((f) => ({
          conductorId: f.conductor_id,
          recogidaDistM: f.recogida_dist_m,
          destinoDistM: f.destino_dist_m,
          fraccionRecogida: f.fraccion_recogida,
          fraccionDestino: f.fraccion_destino,
          desvioM: f.desvio_m,
          esperaMin: f.solape_min,
          puntuacion: f.puntuacion,
        })),
        rechazados: [],
        nota_rechazados: 'the SQL path returns matches only; run motor mode for per-driver rejection reasons',
      }
    } catch (e) {
      // La base existe pero no responde o no está sembrada: se dice, y se
      // cae al motor — con el aviso en el response, nunca en silencio.
      const r = buscarConductores(conductoresMozambique(), peticion)
      return {
        modo: 'memoria (postgres falló)',
        detalle_error: (e as Error).message,
        ...r,
      }
    }
  }

  // ── modo memoria: el motor, tal cual los tests ─────────────────────────
  const r = buscarConductores(conductoresMozambique(), peticion)
  return { modo: 'memoria', ...r }
})
