// EL RESTO DE LOS NUEVE: cada requisito con su propio fallo demostrable.
// Un test por requisito, y cada uno con el numero que lo decide.

import { test } from "node:test";
import assert from "node:assert/strict";

import {
  evaluar,
  buscarConductores,
  type RutaConductor,
} from "../motor/matching.ts";
import { proyectar } from "../motor/geoespacial.ts";
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
  CACUACO,
  VIANA,
  CORREDOR_AO,
  JUEVES_7H,
} from "../motor/escenarios.ts";

const H = 3_600_000;
const recogidaZ = () => pasajeroZimpetoMarracuene().recogida; // Zimpeto
const destinoM = () => pasajeroZimpetoMarracuene().destino; // Marracuene

test("req 1+2 · la ruta es una polilínea y el corredor se mide contra ella", () => {
  const conductores = conductoresMozambique();
  // Un punto a ~3 km al oeste de la EN1 (campo abierto, nada de ruta):
  const lejos = { lat: -25.8457, lon: 32.5370 };
  const dr = proyectar(lejos, conductores[0].ruta);
  assert.ok(
    dr.distancia_m > 1_500,
    `el punto lejano está a ${Math.round(dr.distancia_m)} m de la ruta (>1500)`
  );
});

test("req 2 · fuera del corredor se rechaza con la distancia exacta", () => {
  const conductores = conductoresMozambique();
  const pasajeroLejos = {
    ...pasajeroZimpetoMarracuene(),
    recogida: { lat: -25.8457, lon: 32.5370 }, // ~3 km al oeste de la EN1
  };
  const r = evaluar(conductores[0], pasajeroLejos);
  assert.ok("motivo" in r && r.motivo === "fuera_de_corredor", JSON.stringify(r));
  if ("motivo" in r) console.log(`   ${r.detalle}`);
});

test("req 3 · recogida y destino invertidos = dirección opuesta", () => {
  const conductores = conductoresMozambique();
  const invertido = {
    ...pasajeroZimpetoMarracuene(),
    recogida: destinoM(), // Marracuene primero
    destino: recogidaZ(), // Zimpeto después: hacia atrás
  };
  const r = evaluar(conductores[0], invertido);
  assert.ok("motivo" in r && r.motivo === "direccion_opuesta", JSON.stringify(r));
});

test("req 4 · misma dirección: la validación es sobre la RUTA, no sobre el punto", () => {
  // El caso del encargo: Zimpeto→Maputo. Zimpeto está EN la ruta (0 m) y
  // Maputo también (0.7 km). Lo que falla no es la distancia: es la fracción.
  const conductores = conductoresMozambique();
  const haciaMaputo = {
    ...pasajeroZimpetoMarracuene(),
    destino: { lat: -25.9655, lon: 32.5832 },
  };
  for (const c of conductores.filter((x) => x.id !== "drv-joaquim")) {
    const r = evaluar(c, haciaMaputo);
    assert.ok("motivo" in r && r.motivo === "direccion_opuesta", `${c.id}: ${JSON.stringify(r)}`);
  }
});

test("req 5 · el desvío es configurable y se mide", () => {
  const conductores = conductoresMozambique();
  // Recogida a ~1.5 km al oeste de la ruta y destino desviado ~1.7 km:
  // desvío ~3.2 km. Con tope 5 km entra, con tope 1 km no.
  const peticion = {
    ...pasajeroZimpetoMarracuene(),
    recogida: { lat: -25.8438, lon: 32.5512 },
    destino: { lat: -25.7450, lon: 32.6340 },
  };
  const acepta = evaluar(conductores[0], { ...peticion, desvioMaxM: 5_000 });
  assert.ok(!("motivo" in acepta), `con tope 5 km debe aceptar: ${JSON.stringify(acepta)}`);
  if (!("motivo" in acepta)) {
    assert.ok(acepta.desvioM > 2_000, `desvío medido: ${Math.round(acepta.desvioM)} m`);
    console.log(
      `   desvío medido: ${(acepta.desvioM / 1000).toFixed(2)} km · score ${acepta.puntuacion}%`
    );
  }
  const rechaza = evaluar(conductores[0], { ...peticion, desvioMaxM: 1_000 });
  assert.ok("motivo" in rechaza && rechaza.motivo === "desvio_excesivo");
});

test("req 6 · ventanas que no se tocan se rechazan", () => {
  const conductores = conductoresMozambique();
  const incompatible = {
    ...pasajeroZimpetoMarracuene(),
    ventana: { inicio: JUEVES_7H + 5 * H, fin: JUEVES_7H + 6 * H }, // mediodía
  };
  const r = evaluar(conductores[0], incompatible);
  assert.ok("motivo" in r && r.motivo === "ventana_incompatible");
  // E Isabel (sale 2h después) TAMPOCO: su ventana termina a +4h.
  const rIsabel = evaluar(conductores[2], incompatible);
  assert.ok("motivo" in rIsabel && rIsabel.motivo === "ventana_incompatible");
});

test("req 7 · sin plazas no hay match, y lo dice", () => {
  const lleno: RutaConductor = { ...conductoresMozambique()[1], plazas: 0 };
  const r = evaluar(lleno, pasajeroZimpetoMarracuene());
  assert.ok("motivo" in r && r.motivo === "sin_plazas");
});

test("req 8 · el ranking ordena por desvío, espera y confianza — y es estable", () => {
  const { matches } = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene());
  assert.ok(matches.length >= 2);
  // Amelia (ventana 45', 41 reseñas, verificado) > Tomás (ventana larga, 9 reseñas).
  assert.equal(matches[0].conductorId, "drv-amelia");
  assert.equal(matches[1].conductorId, "drv-tomas");
  assert.ok(matches[0].puntuacion > matches[1].puntuacion);
  // Determinista: la misma entrada, el mismo orden, cien veces.
  for (let i = 0; i < 100; i++) {
    const otra = buscarConductores(conductoresMozambique(), pasajeroZimpetoMarracuene());
    assert.deepEqual(
      otra.matches.map((m) => m.conductorId),
      matches.map((m) => m.conductorId)
    );
  }
  // Isabel (sale a +2h) queda fuera por ventana.
  const ids = matches.map((m) => m.conductorId);
  assert.ok(!ids.includes("drv-isabel"), "isabel sale demasiado tarde");
  console.log("   orden:", matches.map((m) => `${m.conductorId} ${m.puntuacion}%`).join(" · "));
});

test("req 1-9 · NEUTRALIDAD DE PAÍS: Luanda funciona con el mismo código", () => {
  const conductores = conductoresMozambique(); // incluye drv-joaquim (Luanda→Viana)
  const { matches } = buscarConductores(conductores, pasajeroCacuacoViana());
  assert.equal(matches.length, 1, "solo el conductor de Luanda sirve a Cacuaco→Viana");
  assert.equal(matches[0].conductorId, "drv-joaquim");
  const pc = proyectar(CACUACO, CORREDOR_AO);
  const pv = proyectar(VIANA, CORREDOR_AO);
  assert.ok(pc.fraccion < pv.fraccion, `Cacuaco ${pc.fraccion.toFixed(3)} < Viana ${pv.fraccion.toFixed(3)}`);
  // Y la dirección opuesta en Luanda también se rechaza:
  const { matches: m2 } = buscarConductores(conductores, pasajeroVianaLuanda());
  assert.equal(m2.length, 0, "Viana→Luanda centro va hacia atrás: nadie lo sirve");
});
