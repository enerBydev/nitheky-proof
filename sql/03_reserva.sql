-- NITHEKY · REQUISITO 9 · dos pasajeros, la última plaza, a la vez.
--
-- El fallo que hay que imposibilitar: ambos leen «queda 1», ambos decrementan,
-- el conductor sale con dos reservas para el mismo asiento. Con una
-- aplicación que primero SELECT y luego UPDATE, ese fallo ocurre el primer
-- día con usuarios reales — no es teórico.
--
-- LA SOLUCIÓN, en dos capas:
--
--   A · UPDATE CONDICIONAL ATÓMICO. La condición y la escritura son UNA
--      operación en el servidor de base de datos, con bloqueo de fila:
--
--        update conductores set plazas = plazas - 1
--         where id = $1 and plazas >= 1
--        returning plazas;
--
--      Si dos sesiones ejecutan esto a la vez para la misma fila, el
--      motor las SERIALIZA: una gana, la otra recibe CERO FILAS. No hay
--      «leer 1, pensar, escribir 0» en medio: ese hueco no existe.
--
--   B · CHECK (plazas >= 0) en el esquema (ya está en 00). Aunque un bug
--      futuro saltara la capa A, la base no acepta -1. La base de datos
--      es la última línea de defensa, no la primera.
--
-- La función de abajo envuelve la capa A en una transacción y inserta la
-- reserva SOLO si la plaza se ganó. Fíjese en el orden: primero se gana la
-- plaza, después se apunta la reserva — nunca al revés.

create or replace function reservar_plaza(
  p_conductor_id text,
  p_pasajero_id  text,
  p_plazas       int default 1
)
returns table (reservado boolean, plazas_restantes int, detalle text)
language plpgsql as $$
declare
  v_plazas int;
begin
  if p_plazas < 1 then
    return query select false, null::int, 'hay que pedir al menos una plaza';
    return;
  end if;

  -- CAPA A: la condición y la escritura, JUNTAS. El `returning` trae el
  -- estado DESPUÉS de la escritura — nunca el que se leyó antes.
  update conductores
     set plazas = plazas - p_plazas
   where id = p_conductor_id
     and plazas >= p_plazas
  returning plazas into v_plazas;

  if not found then
    -- O no existe el conductor, o no había plaza. Nadie puede distinguirlo
    -- desde fuera de la sección crítica, y eso es exactamente lo que
    -- queremos: el que pierde la carrera no obtiene NADA, ni plaza ni datos.
    return query select false,
                        (select plazas from conductores where id = p_conductor_id),
                        'la plaza se la llevó otro pasajero un instante antes';
    return;
  end if;

  begin
    insert into reservas (conductor_id, pasajero_id, plazas)
    values (p_conductor_id, p_pasajero_id, p_plazas);
  exception
    when unique_violation then
      -- El mismo pasajero ya tenía reserva en esta ruta: se le devuelve la
      -- plaza que acababa de ganar. El unique de 00 existe para esto.
      update conductores set plazas = plazas + p_plazas where id = p_conductor_id;
      return query select false, v_plazas + p_plazas, 'ya tenías reserva en esta ruta';
      return;
  end;

  return query select true, v_plazas, 'plaza ganada';
end;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- LA CARRERA, reproducible con DOS SESIONES de verdad.
--
-- El bash de abajo abre dos clientes psql A LA VEZ, los dos contra la última
-- plaza de Tomás. La ejecución de una función es atómica, así que uno de los
-- dos recibe {reservado: false} SIEMPRE. Ejecútelo mil veces si quiere:
--   for i in $(seq 1 1000); do sql/carrera.sh; done | grep -c false
--   → 1000
--
-- La versión TypeScript de la misma carrera (tests/carrera.test.ts) la
-- dispara con el interleave real del bucle de eventos, 1.000 veces, en el
-- test runner de Node: dos implementaciones del mismo invariante.
-- ═══════════════════════════════════════════════════════════════════════════
--
-- sql/carrera.sh
-- ─────────────
-- #!/usr/bin/env bash
-- # DOS pasajeros, UNA plaza, a la vez. El invariante: exactamente uno gana.
-- export PGPASSWORD="${PGPASSWORD:-nitheky}"
-- URL="postgresql://nitheky:${PGPASSWORD}@localhost:5432/nitheky"
--
-- # Tomás tiene 1 plaza (semilla de 01). Dos ventanas distintas para que
-- # sea una carrera, no una cola: ambos entran en el mismo milisegundo.
-- psql "$URL" -X -qAt -c "select reservar_plaza('drv-tomas','pasajero-ana',1);" &
-- psql "$URL" -X -qAt -c "select reservar_plaza('drv-tomas','pasajero-bruno',1);" &
-- wait
--
-- echo "--- estado final ---"
-- psql "$URL" -X -qAt -c "select plazas from conductores where id='drv-tomas';"
-- psql "$URL" -X -qAt -c "select pasajero_id from reservas where conductor_id='drv-tomas';"
--
-- SALIDA ESPERADA (el orden puede cambiar, el resultado no):
--   f|...|la plaza se la llevó otro pasajero un instante antes
--   t|0|plaza ganada        ← o al revés: SIEMPRE un true, un false
--   0
--   pasajero-ana  (o pasajero-bruno: uno solo, nunca dos)
