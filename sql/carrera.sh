#!/usr/bin/env bash
# NITHEKY · La carrera por la última plaza, con DOS SESIONES reales de psql.
#
# Requisitos 9: dos pasajeros, una plaza, el mismo instante. El invariante:
# exactamente uno gana, la base nunca queda en negativo, nunca hay dos
# reservas para la misma plaza.
#
# Uso:
#   PGPASSWORD=nitheky sql/carrera.sh
#   # repetir mil veces:
#   for i in $(seq 1 1000); do PGPASSWORD=nitheky sql/carrera.sh >/dev/null; done; \
#     psql postgresql://nitheky:nitheky@localhost:5432/nitheky -X -c \
#     "select count(*) from reservas where conductor_id='drv-tomas';"   # → 1

set -euo pipefail

URL="${DATABASE_URL:-postgresql://nitheky:${PGPASSWORD:-nitheky}@localhost:5432/nitheky}"

# Tomás arranca con 1 plaza (semilla de 01). Si la carrera ya corrió antes,
# se re-siembra para que sea siempre contra la ÚLTIMA plaza.
psql "$URL" -X -qAt <<'SQL'
  delete from reservas where conductor_id = 'drv-tomas';
  update conductores set plazas = 1 where id = 'drv-tomas';
SQL

# DOS pasajeros A LA VEZ — el & de bash los lanza en el mismo milisegundo.
# La función reservar_plaza es atómica (update condicional), así que uno
# recibe true y el otro false. SIEMPRE. Ejecútelo las veces que quiera.
psql "$URL" -X -qAt -c "select reservar_plaza('drv-tomas','pasajero-ana',1);" &
psql "$URL" -X -qAt -c "select reservar_plaza('drv-tomas','pasajero-bruno',1);" &
wait

echo "--- estado final (plazas de Tomás / reservas vivas) ---"
psql "$URL" -X -qAt -c "select plazas from conductores where id='drv-tomas';"
psql "$URL" -X -qAt -c "select pasajero_id from reservas where conductor_id='drv-tomas';"

# EL INVARIENTE SE COMPRUEBA, no se promete:
PLAZAS=$(psql "$URL" -X -qAt -c "select plazas from conductores where id='drv-tomas';")
RESERVAS=$(psql "$URL" -X -qAt -c "select count(*) from reservas where conductor_id='drv-tomas';")
if [ "$PLAZAS" = "0" ] && [ "$RESERVAS" = "1" ]; then
  echo "✔ carrera limpia: una plaza, un ganador, cero sobreventas"
else
  echo "✘ INVARIANTE ROTO: plazas=$PLAZAS reservas=$RESERVAS" >&2
  exit 1
fi
