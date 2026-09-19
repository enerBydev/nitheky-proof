// NITHEKY · La reserva de la última plaza: la parte que NO se puede dejar
// "para la versión de producción".
//
// EL FALLO QUE SE DEMUESTRA AQUÍ (requisito 9 del encargo): dos pasajeros
// piden la última plaza a la vez. Sin protección, ambos leen "queda 1",
// ambos decrementan, y el conductor sale de Maputo con dos pasajeros
// reservando el mismo asiento — el clásico double-booking de las demos.
//
// LA SOLUCIÓN tiene dos capas y las dos son necesarias:
//
//   A · ATÓMICA CONDICIONAL. La escritura y la condición van JUNTAS:
//        UPDATE rutas SET plazas = plazas - 1 WHERE id = $1 AND plazas > 0
//      En Postgres esa frase es una sola operación con bloqueo de fila: no
//      existe el "leer 1, pensar, escribir 0" entre medias. Si devuelve
//      cero filas, alguien llegó antes — y ese alguien fue válido.
//
//   B · CHECK EN EL ESQUEMA. `CHECK (plazas >= 0)` como red de seguridad:
//      aunque un bug futuro saltara la capa A, la base no acepta -1. La
//      base de datos es la última línea de defensa, no la primera.
//
// Esta versión en memoria reproduce la carrera con el INTERLEAVING REAL:
// dos peticiones concurrentes cuyo código se ejecuta entrelazado por el
// bucle de eventos de JavaScript — exactamente el escenario de dos
// peticiones HTTP llegando a la vez. La sección crítica la cierra una
// PROMESA encadenada (el equivalente del bloqueo de fila), así que el
// segundo escritor ve el estado DESPUÉS del primero, no antes.
//
// La versión SQL con las DOS capas está en sql/03-reserva.sql, y el test
// tests/carrera.ts la dispara 2.000 veces seguidas para que nadie tenga
// que creerse que funciona por buena suerte.

import type { RutaConductor } from "./matching.ts";

export interface Reserva {
  id: string;
  rutaId: string;
  pasajeroId: string;
  plazas: number;
  /** Milisegundos desde epoch — el orden real de llegada, para depurar. */
  t: number;
}

/** El almacén en memoria. `candado` es la cola de escritura: cada reserva
 * espera a que la anterior haya terminado su deCREMENTO condicional. */
export class MotorReserva {
  private rutas: Map<string, RutaConductor>;
  private reservas: Reserva[] = [];
  private candado: Promise<unknown> = Promise.resolve();

  constructor(rutas: RutaConductor[]) {
    this.rutas = new Map(rutas.map((r) => [r.id, { ...r }]));
  }

  /**
   * LA RESERVA. Devuelve la reserva si había plaza y null si no.
   *
   * La condición (`plazas >= pedidas`) y la escritura (`plazas -= pedidas`)
   * ocurren DENTRO de la sección crítica — el equivalente exacto del UPDATE
   * condicional de Postgres. El `setTimeout(0)` fuerza al bucle de eventos
   * a dar una vuelta antes de leer: sin él, la carrera no se llega a
   * producir y el test no demuestra nada.
   */
  async reservar(
    rutaId: string,
    pasajeroId: string,
    plazas = 1
  ): Promise<Reserva | null> {
    const miTurno = this.candado;
    let liberar!: () => void;
    this.candado = new Promise<void>((r) => (liberar = r));
    await miTurno;

    // ── dentro de la sección crítica ─────────────────────────────────────
    // El await de abajo es lo que hace la carrera REAL: mientras este
    // pasajero "piensa" (su latencia de red), otro puede colarse. El
    // candado NO se suelta durante la latencia — igual que un bloqueo de
    // fila en Postgres sobrevive al commit lento.
    await new Promise((r) => setTimeout(r, Math.random() * 3));
    const ruta = this.rutas.get(rutaId);
    let reserva: Reserva | null = null;
    if (ruta && ruta.plazas >= plazas && ruta.plazas > 0) {
      ruta.plazas -= plazas;
      reserva = {
        id: `res-${this.reservas.length + 1}`,
        rutaId,
        pasajeroId,
        plazas,
        t: Date.now(),
      };
      this.reservas.push(reserva);
    }
    // ── fuera de la sección crítica ─────────────────────────────────────
    liberar();
    return reserva;
  }

  /** Estado para inspección y aserciones. */
  plazasDe(rutaId: string): number {
    return this.rutas.get(rutaId)?.plazas ?? -1;
  }

  reservasDe(rutaId: string): Reserva[] {
    return this.reservas.filter((r) => r.rutaId === rutaId);
  }
}
