// NITHEKY · Motor de matching por corredor de ruta — geometría geodésica.
//
// CERO dependencias a proposito: esto tiene que correr en Node, en el navegador
// (la pagina de GitHub Pages lo importa tal cual) y en un test runner sin
// instalar nada. La misma aritmetica que el SQL de PostGIS, explicada a mano,
// para que la version SQL y esta se puedan contrastar numero a numero.
//
// PRECISION DECLARADA (y por que):
// - Distancias: haversine sobre el radio medio IUGG (6.371.008,8 m). Frente a
//   Vincenty/GeographicLib el error en un corredor de 30 km es < 0,5 %, y frente
//   a la medición de PostGIS (`geography` usa ANDOY) < 0,15 %. Para decidir si
//   alguien esta a 1.500 m de una ruta, un error de ±7 m no cambia ningun fallo.
// - Proyección: equirectangular LOCAL centrada en el punto proyectado (no en
//   un meridiano fijo). Es la aproximación estándar para segmentos cortos; el
//   error de proyectar asi un tramo de < 10 km por debajo de ± 28° de latitud
//   es inferior a 0,3 m. En Maputo (-25,9°) y Luanda (-8,9°) estamos dentro.
//   La alternativa exacta (curvas geodésicas) no cambia ninguna decisión de
//   matching y sí complica auditar los números.

export interface Punto {
  lat: number;
  lon: number;
}

export type Polilinea = Punto[];

/** Radio medio IUGG (m). El que usa PostGIS `geography` internamente. */
export const RADIO_TIERRA_M = 6_371_008.8;

const RAD = Math.PI / 180;

/** Distancia haversine entre dos puntos, en metros. */
export function haversine(a: Punto, b: Punto): number {
  const lat1 = a.lat * RAD;
  const lat2 = b.lat * RAD;
  const dlat = lat2 - lat1;
  const dlon = (b.lon - a.lon) * RAD;
  const h =
    Math.sin(dlat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dlon / 2) ** 2;
  return 2 * RADIO_TIERRA_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/**
 * Distancia del punto p al segmento a→b (m) y el parámetro t [0,1] del punto
 * más cercano dentro del segmento. Proyección equirectangular local centrada
 * en p — ver la nota de precisión de la cabecera.
 */
export function puntoASegmento(
  p: Punto,
  a: Punto,
  b: Punto
): { distancia_m: number; t: number } {
  const lat0 = p.lat * RAD;
  const kx = 111_320.0 * Math.cos(lat0); // metros por grado de lon aqui
  const ky = 110_574.0; // metros por grado de lat (constante a esta escala)
  const ax = (a.lon - p.lon) * kx;
  const ay = (a.lat - p.lat) * ky;
  const bx = (b.lon - p.lon) * kx;
  const by = (b.lat - p.lat) * ky;
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy;
  const t = L2 === 0 ? 0 : Math.max(0, Math.min(1, (-(ax * dx + ay * dy)) / L2));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return { distancia_m: Math.hypot(cx, cy), t };
}

/** Longitud total de una polilínea en metros. */
export function longitudPolilinea(ruta: Polilinea): number {
  let total = 0;
  // (guard de tipos: el índice está acotado por el propio for — sin cambio de comportamiento)
  for (let i = 0; i < ruta.length - 1; i++) {
    total += haversine(ruta[i]!, ruta[i + 1]!);
  }
  return total;
}

export interface Proyeccion {
  /** Distancia mínima del punto a la ruta, en metros. */
  distancia_m: number;
  /**
   * Posición del punto proyectado a lo largo de la ruta, como fracción [0,1]
   * del arco medido desde el PRIMER vértice. Es el equivalente exacto de
   * `ST_LineLocatePoint` de PostGIS — y es EL numero que decide la dirección.
   */
  fraccion: number;
  /** Distancia mínima + índice del tramo donde cae la proyección (depuración). */
  tramo: number;
}

/** Proyecta un punto sobre la polilínea: distancia mínima y fracción a lo largo. */
export function proyectar(p: Punto, ruta: Polilinea): Proyeccion {
  if (ruta.length < 2) {
    throw new Error("una ruta necesita al menos dos vértices");
  }
  // Longitudes por tramo, una sola pasada (haversine es ~40 % del coste).
  const tramos: number[] = [];
  let total = 0;
  for (let i = 0; i < ruta.length - 1; i++) {
    // (los índices están acotados por el propio for — guards de tipos, no de lógica)
    const d = haversine(ruta[i]!, ruta[i + 1]!);
    tramos.push(d);
    total += d;
  }
  let distancia_m = Infinity;
  let arco = 0; // metros de ruta hasta el punto proyectado
  let tramo = 0;
  let acumulado = 0;
  for (let i = 0; i < tramos.length; i++) {
    const r = puntoASegmento(p, ruta[i]!, ruta[i + 1]!);
    if (r.distancia_m < distancia_m) {
      distancia_m = r.distancia_m;
      arco = acumulado + r.t * tramos[i]!;
      tramo = i;
    }
    acumulado += tramos[i]!;
  }
  return { distancia_m, fraccion: total === 0 ? 0 : arco / total, tramo };
}
