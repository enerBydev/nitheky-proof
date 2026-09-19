// LOS DOS ESCENARIOS DEL ENCARGO, palabra por palabra:
//
//   Match:   Driver Maputo→Marracuene + Passenger Zimpeto→Marracuene
//   Reject:  Driver Maputo→Marracuene + Passenger Zimpeto→Maputo
//
// Cada aserción lleva su numero medido al lado. Si algo falla, la salida dice
// exactamente QUÉ cantidad no cuadra — no un "expected true, received false".

import { test } from "node:test";
import assert from "node:assert/strict";

import { buscarConductores, evaluar } from "../motor/matching.ts";
import { proyectar, haversine, longitudPolilinea } from "../motor/geoespacial.ts";
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  ZIMPETO,
  MARRACUENE,
  MAPUTO_CENTRO,
  CORREDOR_MZ,
} from "../motor/escenarios.ts";

test("la ruta existe y mide lo que tiene que medir", () => {
  const km = longitudPolilinea(CORREDOR_MZ) / 1000;
  assert.ok(km > 28 && km < 32, `el corredor mide ${km.toFixed(2)} km; lo esperado ~30`);
});

test("Zimpeto cae en la mitad de la ruta (fracción ~0.53)", () => {
  const p = proyectar(ZIMPETO, CORREDOR_MZ);
  assert.ok(Math.abs(p.fraccion - 0.526) < 0.01, `fracción de Zimpeto: ${p.fraccion.toFixed(3)}`);
  assert.equal(Math.round(p.distancia_m), 0, "Zimpeto es vértice de la ruta: distancia 0");
});

test("ESCENARIO A · Zimpeto→Marracuene ENCUENTRA conductores", () => {
  const { matches } = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene());
  assert.ok(matches.length >= 2, `deben sobrevivir ≥2 conductores; sobreviven ${matches.length}`);
  assert.ok(
    matches.every((m) => m.fraccionRecogida < m.fraccionDestino),
    "todos los matches van en la misma dirección"
  );
  const mejor = matches[0];
  assert.equal(mejor.conductorId, "drv-amelia", `el mejor es ${mejor.conductorId}`);
  assert.equal(Math.round(mejor.desvioM), 0, "Zimpeto y Marracuene son vértices: desvío 0 m");
  console.log("   ranking A:", matches.map((m) => `${m.conductorId} ${m.puntuacion}%`).join(" · "));
});

test("ESCENARIO B · Zimpeto→Maputo se RECHAZA por dirección opuesta", () => {
  const conductores = conductoresMozambique().filter((c) => c.id.startsWith("drv-") && (c.id === "drv-amelia" || c.id === "drv-tomas" || c.id === "drv-isabel"));
  for (const c of conductores) {
    const r = evaluar(c, pasajeroZimpetoMaputo());
    assert.equal("motivo" in r, true, `${c.id} debe rechazar`);
    if ("motivo" in r) {
      assert.equal(r.motivo, "direccion_opuesta", `${c.id}: ${r.motivo} — ${r.detalle}`);
    }
  }
  // Y el numero que lo decide, a la vista:
  const pr = proyectar(ZIMPETO, CORREDOR_MZ);
  const pd = proyectar(MAPUTO_CENTRO, CORREDOR_MZ);
  console.log(
    `   recogida frac ${pr.fraccion.toFixed(3)} ≥ destino frac ${pd.fraccion.toFixed(3)} → hacia atrás`
  );
});

test("ninguna parte del motor sabe en qué país está", async () => {
  // La unica geografía que conoce el motor son las coordenadas de las rutas.
  // Este test existe para que quede dicho: no hay ni un nombre de ciudad,
  // país, prefijo o divisa en el código del motor — solo números. La
  // geografía NOMBRADA vive en escenarios.ts, que es dato, no lógica.
  const fs = await import("node:fs");
  const path = await import("node:path");
  const ficheros = ["matching.ts", "geoespacial.ts", "reserva.ts"].map((f) =>
    path.join(import.meta.dirname, "..", "motor", f)
  );
  const prohibido = /mozambique|angola|maputo|marracuene|zimpeto|luanda|mzn|ao\b/i;
  for (const f of ficheros) {
    const texto = fs.readFileSync(f, "utf8");
    const enCodigo = texto
      .split("\n")
      .filter((l) => !l.trim().startsWith("//"))
      .join("\n");
    assert.ok(!prohibido.test(enCodigo), `${path.basename(f)} contiene nombres de países en código`);
  }
});

test("distancias de referencia (para contrastar con el SQL)", () => {
  const d = (a: { lat: number; lon: number }, b: { lat: number; lon: number }) =>
    (haversine(a, b) / 1000).toFixed(2);
  console.log(`   Maputo→Zimpeto ${d(MAPUTO_CENTRO, ZIMPETO)} km (recto)`);
  console.log(`   Zimpeto→Marracuene ${d(ZIMPETO, MARRACUENE)} km (recto)`);
  console.log(`   Maputo→Marracuene ${d(MAPUTO_CENTRO, MARRACUENE)} km (recto)`);
});
