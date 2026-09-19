// REQUISITO 9 · dos pasajeros, la última plaza, a la vez.
//
// El test NO es "reservo dos veces y la segunda falla" — eso no demuestra
// nada, eso es una cola. El test es que AMBAS peticiones se disparan AL
// MISMO TIEMPO, con su latencia entrelazada, 1.000 carreras seguidas.
// Si en una sola carrera se venden dos plazas, el test lo encuentra.
//
// La versión SQL de la misma carrera (dos sesiones psql concurrentes)
// está en sql/03-reserva.sql y docs/REPRODUCIR.md.

import { test } from "node:test";
import assert from "node:assert/strict";

import { MotorReserva } from "../motor/reserva.ts";
import { conductoresMozambique } from "../motor/escenarios.ts";

const CARRERAS = 1_000;

test(`la última plaza se vende UNA vez en ${CARRERAS} carreras simultáneas`, async () => {
  let dobles = 0;
  let justas = 0;

  for (let i = 0; i < CARRERAS; i++) {
    // Un conductor con UNA plaza, cada carrera. drv-tomas es el del test.
    const motor = new MotorReserva([
      { ...conductoresMozambique()[1], plazas: 1 },
    ]);

    // DOS pasajeros, a la vez, para la misma plaza.
    const [r1, r2] = await Promise.all([
      motor.reservar("drv-tomas", "pasajero-ana", 1),
      motor.reservar("drv-tomas", "pasajero-bruno", 1),
    ]);

    const exitos = [r1, r2].filter(Boolean).length;
    if (exitos === 2) dobles++;
    if (exitos === 1) justas++;

    // Invariantes, carrera a carrera:
    assert.ok(exitos <= 1, `carrera ${i}: se vendieron ${exitos} plazas de una`);
    assert.equal(motor.plazasDe("drv-tomas"), 0, `carrera ${i}: quedan ${motor.plazasDe("drv-tomas")} plazas en negativo o de más`);
    const reservas = motor.reservasDe("drv-tomas");
    assert.equal(reservas.length, exitos);
    if (exitos === 1) {
      const ganador = (r1 ?? r2)!.pasajeroId;
      assert.ok(["pasajero-ana", "pasajero-bruno"].includes(ganador));
    }
  }

  console.log(`   ${justas} carreras con un ganador · ${dobles} con dos (deben ser 0)`);
  assert.equal(dobles, 0, "NUNCA se venden dos veces la última plaza");
  assert.equal(justas, CARRERAS, "siempre gana exactamente una");
});

test("tres pasajeros, dos plazas: entran dos y solo dos", async () => {
  const motor = new MotorReserva([
    { ...conductoresMozambique()[0], plazas: 2 },
  ]);
  const rs = await Promise.all([
    motor.reservar("drv-amelia", "p1", 1),
    motor.reservar("drv-amelia", "p2", 1),
    motor.reservar("drv-amelia", "p3", 1),
  ]);
  const exitos = rs.filter(Boolean).length;
  assert.equal(exitos, 2, `entraron ${exitos}, debían entrar 2`);
  assert.equal(motor.plazasDe("drv-amelia"), 0);
  const ids = new Set(rs.filter(Boolean).map((r) => r!.pasajeroId));
  assert.equal(ids.size, 2, "los dos ganadores son personas distintas");
});

test("una reserva de 2 plazas contra 1 libre se rechaza entera (sin vender media)", async () => {
  const motor = new MotorReserva([
    { ...conductoresMozambique()[1], plazas: 1 },
  ]);
  const r = await motor.reservar("drv-tomas", "grupo-familiar", 2);
  assert.equal(r, null, "no hay plazas para el grupo");
  assert.equal(motor.plazasDe("drv-tomas"), 1, "la plaza libre sigue libre");
});
