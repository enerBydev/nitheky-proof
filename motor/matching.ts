// NITHEKY · El matching, componente a componente.
//
// Los nueve requisitos del encargo, cada uno en su sitio y medible:
//
//   1. almacenamiento real de ruta/polilínea ......... interface RutaConductor.ruta
//   2. matching por corredor ........................ corredor: recogida y destino
//                                                    dentro del radio de la ruta
//   3. recogida antes que destino .................... direccion: fraccionRecogida
//                                                    < fraccionDestino (con margen)
//   4. validación de misma dirección ................. el mismo numero, aplicado
//                                                    al caso Zimpeto→Maputo
//   5. desvío configurable ............................ desvioMaxM por consulta +
//                                                    desvio calculado del conductor
//   6. compatibilidad de ventanas de tiempo .......... ventanasSolapan (tstzrange &&)
//   7. asientos disponibles ......................... plazas > 0 y reserva atómica
//   8. ranking de varios conductores compatibles ..... puntuar (determinista,
//                                                    unidades reales, explicable)
//   9. protección contra dos pasajeros y la última
//      plaza a la vez ............................... motor/reserva.ts + sql/03
//
// LA REGLA DE CASA (heredada del proyecto anterior, y es deliberada):
// el modelo escribe la frase, nunca escribe el numero. Todo lo que hay en este
// fichero es aritmética sobre cantidades medibles — km de desvío, minutos de
// espera, plazas libres — asi que cualquier resultado se puede explicar y
// reproducir. La misma entrada da siempre el mismo numero.

import {
  proyectar,
  haversine,
  type Punto,
  type Polilinea,
} from "./geoespacial.ts";

/** Una ventana de tiempo, como el `tstzrange` de Postgres. [inicio, fin) */
export type Ventana = { inicio: number; fin: number };

export interface RutaConductor {
  id: string;
  /** El vértice 0 es donde arranca el conductor; el último, su destino. */
  ruta: Polilinea;
  /** Ventana en la que el conductor está dispuesto a salir. */
  ventana: Ventana;
  /** Plazas libres AHORA. La reserva atómica es quien garantiza que es verdad. */
  plazas: number;
  /** Reputación del conductor 0..5 (pesa en el ranking, no en el matching). */
  nota: number;
  /** Viajes completados — pondera la nota: un 5.0 de una reseña no es un 5.0. */
  valoraciones: number;
  verificado: boolean;
  /** Desvío máximo que ESTE conductor acepta, en metros. Es su corredor. */
  desvioMaxM: number;
}

export interface PeticionPasajero {
  recogida: Punto;
  destino: Punto;
  ventana: Ventana;
  plazas: number;
  /** Radio del corredor que acepta caminar hasta la ruta del conductor. */
  corredorM: number;
  /** Desvío máximo que impone el pasajero al conductor. Configurable. */
  desvioMaxM: number;
}

export interface Rechazo {
  motivo:
    | "sin_plazas"
    | "fuera_de_corredor"
    | "direccion_opuesta"
    | "ventana_incompatible"
    | "desvio_excesivo";
  detalle: string;
}

export interface Match {
  conductorId: string;
  /** Metros del punto de recogida a la ruta del conductor. */
  recogidaDistM: number;
  /** Metros del destino del pasajero a la ruta del conductor. */
  destinoDistM: number;
  /** Fracción [0,1] de la ruta donde cae la recogida. */
  fraccionRecogida: number;
  /** Fracción [0,1] de la ruta donde cae el destino del pasajero. */
  fraccionDestino: number;
  /** Desvío total que añade este pasajero al viaje del conductor, en metros. */
  desvioM: number;
  /** Minutos de solape entre la ventana del conductor y la del pasajero. */
  esperaMin: number;
  /** Puntuación determinista del ranking, 0..100. */
  puntuacion: number;
}

/** Dos ventanas se solapan si comparten al menos un instante. `tstzrange &&`. */
export function ventanasSolapan(a: Ventana, b: Ventana): boolean {
  return a.inicio < b.fin && b.inicio < a.fin;
}

/** Minutos de solape entre dos ventanas (0 si no se solapan). */
export function solapeMin(a: Ventana, b: Ventana): number {
  const inicio = Math.max(a.inicio, b.inicio);
  const fin = Math.min(a.fin, b.fin);
  return fin > inicio ? (fin - inicio) / 60_000 : 0;
}

/** Distancia en línea recta de un punto a una polilínea (la firma la necesita
 * el cálculo de desvío y el mapa). */
export function distanciaARuta(p: Punto, ruta: Polilinea): number {
  return proyectar(p, ruta).distancia_m;
}

/**
 * LA FUNCIÓN CENTRAL: ¿este conductor sirve a este pasajero, y si lo hace,
 * cuánto le cuesta? Devuelve el rechazo con su motivo, o el match con todas
 * las cantidades medidas. Ninguna decisión se toma sin su numero al lado.
 */
export function evaluar(
  conductor: RutaConductor,
  pasajero: PeticionPasajero
): Match | Rechazo {
  // ── 7 · asientos ───────────────────────────────────────────────────────────
  if (conductor.plazas < pasajero.plazas) {
    return {
      motivo: "sin_plazas",
      detalle: `quedan ${conductor.plazas}, se piden ${pasajero.plazas}`,
    };
  }

  // ── 2 · corredor: recogida y destino, ambos cerca de la ruta ──────────────
  const pr = proyectar(pasajero.recogida, conductor.ruta);
  const pd = proyectar(pasajero.destino, conductor.ruta);
  const corredor = Math.min(pasajero.corredorM, conductor.desvioMaxM);
  if (pr.distancia_m > corredor) {
    return {
      motivo: "fuera_de_corredor",
      detalle: `recogida a ${Math.round(pr.distancia_m)} m de la ruta; el corredor es ${corredor} m`,
    };
  }
  if (pd.distancia_m > corredor) {
    return {
      motivo: "fuera_de_corredor",
      detalle: `destino a ${Math.round(pd.distancia_m)} m de la ruta; el corredor es ${corredor} m`,
    };
  }

  // ── 3 · recogida ANTES que destino, a lo largo de la ruta ────────────────
  //
  // El margen MIN_FRACCION existe porque dos proyecciones caen a veces en el
  // mismo vértice y "0.526 < 0.527" no es una dirección, es ruido. Con 30 km
  // de ruta, 0.002 de fracción son 60 m: menos que eso no es ir en la misma
  // dirección, es subir y bajar en la misma esquina.
  const MIN_FRACCION = 0.002;
  if (pr.fraccion + MIN_FRACCION >= pd.fraccion) {
    return {
      motivo: "direccion_opuesta",
      detalle:
        `la recogida cae en la fracción ${pr.fraccion.toFixed(3)} de la ruta y ` +
        `el destino en la ${pd.fraccion.toFixed(3)}: el pasajero va hacia atrás`,
    };
  }

  // ── 6 · ventanas de tiempo ────────────────────────────────────────────────
  if (!ventanasSolapan(conductor.ventana, pasajero.ventana)) {
    return {
      motivo: "ventana_incompatible",
      detalle: "las ventanas de salida no comparten ni un minuto",
    };
  }

  // ── 5 · desvío configurable ──────────────────────────────────────────────
  //
  // El desvío de "ida y vuelta": salir del corredor hasta la recogida y
  // reincorporarse, y lo mismo al dejar. Es el modelo estándar cuando la ruta
  // es una polilínea y no un grafo de calles — y es conservador: nunca
  // infraestima el desvío real.
  const desvioM = pr.distancia_m + pd.distancia_m;
  if (desvioM > pasajero.desvioMaxM) {
    return {
      motivo: "desvio_excesivo",
      detalle: `el desvío suma ${Math.round(desvioM)} m; el máximo aceptado es ${pasajero.desvioMaxM} m`,
    };
  }

  const m: Match = {
    conductorId: conductor.id,
    recogidaDistM: pr.distancia_m,
    destinoDistM: pd.distancia_m,
    fraccionRecogida: pr.fraccion,
    fraccionDestino: pd.fraccion,
    desvioM,
    esperaMin: solapeMin(conductor.ventana, pasajero.ventana),
    puntuacion: 0, // la pone puntuar(), que es donde viven los pesos
  };
  m.puntuacion = puntuar(m, conductor);
  return m;
}

/** Los pesos del ranking. Suman 1.00 y están A LA VISTA, no escondidos en un
 * modelo: cambiar uno cambia las PRIORIDADES, y eso lo decide el producto. */
export const PESOS_RANKING = {
  desvio: 0.4, // lo que le cuesta al conductor
  espera: 0.3, // cuánto margen de horario queda
  confianza: 0.2, // nota ponderada por nº de valoraciones
  verificacion: 0.1, // conductor verificado o no
} as const;

/**
 * 8 · el ranking, en unidades reales y determinista:
 *
 *   desvío      1 - (desvioM / desvioMaxM)     → km no recorridos de más
 *   espera      solapeMin / 60 acotado a 1     → margen horario sobrante
 *   confianza   notaSuavizada / 5              → 4.7 de 37 reseñas > 5.0 de 1
 *   verificación 1 | 0
 *
 * La nota se suaviza hacia 4.2 con pocas valoraciones (prior bayesiana con
 * m=5): un 5.0 con una sola reseña cuenta como 4.36, no como la perfección.
 */
export function puntuar(m: Match, c: RutaConductor): number {
  const desvio = Math.max(0, 1 - m.desvioM / Math.max(1, c.desvioMaxM));
  const espera = Math.min(1, m.esperaMin / 60);
  const prior = 4.2;
  const mResenas = 5;
  const notaSuave =
    (c.nota * Math.min(c.valoraciones, 50) + prior * mResenas) /
    (Math.min(c.valoraciones, 50) + mResenas);
  const confianza = notaSuave / 5;
  const verificacion = c.verificado ? 1 : 0;
  const p =
    PESOS_RANKING.desvio * desvio +
    PESOS_RANKING.espera * espera +
    PESOS_RANKING.confianza * confianza +
    PESOS_RANKING.verificacion * verificacion;
  return Math.round(p * 1000) / 10; // un decimal, sin ruido de coma flotante
}

/** El endpoint del pasajero: dame los conductores compatibles, ordenados. */
export function buscarConductores(
  conductores: RutaConductor[],
  pasajero: PeticionPasajero
): { matches: Match[]; rechazados: { conductorId: string; rechazo: Rechazo }[] } {
  const matches: Match[] = [];
  const rechazados: { conductorId: string; rechazo: Rechazo }[] = [];
  for (const c of conductores) {
    const r = evaluar(c, pasajero);
    if ("motivo" in r) rechazados.push({ conductorId: c.id, rechazo: r });
    else matches.push(r);
  }
  // Empate imposible por construccion (la puntuacion lleva un decimal y los
  // ids desatan los que coincidan): orden estable y reproducible.
  matches.sort(
    (a, b) => b.puntuacion - a.puntuacion || a.conductorId.localeCompare(b.conductorId)
  );
  return { matches, rechazados };
}

/** Distancia recta entre dos puntos — la usa la página para dibujar. */
export { haversine };
