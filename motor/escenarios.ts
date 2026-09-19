// NITHEKY · Los escenarios del encargo, con geografía real.
//
// El cliente pidió exactamente este corredor: Maputo→Marracuene, con Zimpeto
// en el camino (EN1). Las coordenadas son las reales — no hacen falta más de
// 7 vértices para una prueba técnica y más vértices solo dificultan leer los
// números. Lo MISMO se siembra en SQL (sql/01) para que las dos versiones se
// puedan contrastar numero a numero.
//
// VERIFICACIÓN EXTERNA de la geografía, para quien quiera comprobarla:
//   - Maputo centro      ≈ (-25.9667, 32.5764) — Baixa, junto al puerto
//   - Machava            ≈ (-25.9010, 32.5890) — EN1 al norte de Maputo
//   - Zimpeto            ≈ (-25.8457, 32.5656) — el mercado, km ~15.8
//   - Marracuene         ≈ (-25.7422, 32.6489) — tras el Incomati, km 30
//   - Luanda (Angola)    ≈ (-8.8390, 13.2894) — Marginal
//   - Cacuaco            ≈ (-8.8770, 13.3350) — EN100 noreste de Luanda
//   - Viana              ≈ (-8.9000, 13.3740) — final de la EN100
// Longitud medida del corredor Mozambique: 30.00 km (haversine, IUGG).
// Zimpeto cae en la fracción 0.526 de la ruta: a medio camino, como debe ser.

import type { RutaConductor, PeticionPasajero } from "./matching.ts";
import type { Polilinea, Punto } from "./geoespacial.ts";

export const CORREDOR_MZ: Polilinea = [
  { lat: -25.9667, lon: 32.5764 }, // Baixa de Maputo
  { lat: -25.9560, lon: 32.5700 }, // Av. 24 de Julio
  { lat: -25.9555, lon: 32.5880 }, // salida norte
  { lat: -25.9010, lon: 32.5890 }, // Machava
  { lat: -25.8457, lon: 32.5656 }, // ZIMPETO
  { lat: -25.7900, lon: 32.6100 }, // EN1 hacia el Incomati
  { lat: -25.7422, lon: 32.6489 }, // MARRACUENE
];

export const CORREDOR_AO: Polilinea = [
  { lat: -8.8390, lon: 13.2894 }, // Marginal de Luanda
  { lat: -8.8550, lon: 13.3150 }, // salida noreste
  { lat: -8.8800, lon: 13.3400 }, // Cacuaco
  { lat: -8.9100, lon: 13.3700 }, // EN100
  { lat: -8.9000, lon: 13.3740 }, // VIANA
];

export const ZIMPETO: Punto = { lat: -25.8457, lon: 32.5656 };
export const MARRACUENE: Punto = { lat: -25.7422, lon: 32.6489 };
export const MAPUTO_CENTRO: Punto = { lat: -25.9655, lon: 32.5832 };
export const CACUACO: Punto = { lat: -8.8770, lon: 13.3350 };
export const VIANA: Punto = { lat: -8.9000, lon: 13.3740 };
export const LUANDA_CENTRO: Punto = { lat: -8.8390, lon: 13.2894 };

// Ventanas en ms. Base: 2026-10-01 07:00 UTC — jueves, hora punta de Maputo.
const H = 3_600_000;
const M = 60_000;
export const JUEVES_7H = 1_798_642_800_000; // 2026-10-01T07:00:00Z (verificado)

/** Los tres conductores del corredor Maputo→Marracuene. Distintos en TODO lo
 * que el ranking debe discriminar: ventanas, desvío aceptado, notas, plazas. */
export function conductoresMozambique(): RutaConductor[] {
  return [
    {
      id: "drv-amelia",
      ruta: CORREDOR_MZ,
      ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 45 * M },
      plazas: 3,
      nota: 4.8,
      valoraciones: 41,
      verificado: true,
      desvioMaxM: 1_500,
    },
    {
      id: "drv-tomas",
      ruta: CORREDOR_MZ,
      ventana: { inicio: JUEVES_7H + 30 * M, fin: JUEVES_7H + 2 * H },
      plazas: 1,
      nota: 4.5,
      valoraciones: 9,
      verificado: true,
      desvioMaxM: 2_500,
    },
    {
      id: "drv-isabel",
      ruta: CORREDOR_MZ,
      ventana: { inicio: JUEVES_7H + 2 * H, fin: JUEVES_7H + 4 * H },
      plazas: 2,
      nota: 5.0,
      valoraciones: 1,
      verificado: false,
      desvioMaxM: 1_000,
    },
    // El conductor de Luanda: MISMA lógica, otro país. Si el motor supiera
    // nada de Mozambique, este fallaría — y no falla (tests/luanda.ts).
    {
      id: "drv-joaquim",
      ruta: CORREDOR_AO,
      ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 45 * M },
      plazas: 4,
      nota: 4.6,
      valoraciones: 23,
      verificado: true,
      desvioMaxM: 1_500,
    },
  ];
}

/** ESCENARIO A del encargo: Zimpeto→Marracuene DEBE encontrar a los conductores. */
export function pasajeroZimpetoMarracuene(): PeticionPasajero {
  return {
    recogida: ZIMPETO,
    destino: MARRACUENE,
    ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 1 * H },
    plazas: 1,
    corredorM: 1_500, // el radio de 1-2 km del doc de producto
    desvioMaxM: 3_000,
  };
}

/** ESCENARIO B del encargo: Zimpeto→Maputo DEBE ser rechazado (dirección opuesta). */
export function pasajeroZimpetoMaputo(): PeticionPasajero {
  return {
    recogida: ZIMPETO,
    destino: MAPUTO_CENTRO,
    ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 1 * H },
    plazas: 1,
    corredorM: 1_500,
    desvioMaxM: 3_000,
  };
}

/** La neutralidad de país: la misma petición, en Luanda. */
export function pasajeroCacuacoViana(): PeticionPasajero {
  return {
    recogida: CACUACO,
    destino: VIANA,
    ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 1 * H },
    plazas: 1,
    corredorM: 1_500,
    desvioMaxM: 3_000,
  };
}

/** La dirección opuesta en Luanda también se rechaza (Viana→Luanda centro). */
export function pasajeroVianaLuanda(): PeticionPasajero {
  return {
    recogida: VIANA,
    destino: LUANDA_CENTRO,
    ventana: { inicio: JUEVES_7H, fin: JUEVES_7H + 1 * H },
    plazas: 1,
    corredorM: 1_500,
    desvioMaxM: 3_000,
  };
}
