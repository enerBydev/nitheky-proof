#!/usr/bin/env bash
# NITHEKY · LA PRUEBA COMPLETA del camino PostGIS — el mismo script corre un
# humano en local y el CI en GitHub: idéntico, palabra por palabra.
#
# Requisitos 1–9 contra una base REAL:
#   · los dos escenarios del encargo (A encuentra 2 · B encuentra 0)
#   · Luanda y Luanda al revés (neutralidad de país con datos)
#   · la carrera por la última plaza, con su invariante comprobado
#
# Uso (con `nix develop` activo, o cualquier shell con psql + PostGIS vivo):
#   sql/pg.sh start      # si el servidor no está arriba
#   sql/comprobar.sh     # acepta NITHEKY_CARRERAS=N (default 100)
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
CARRERAS="${NITHEKY_CARRERAS:-100}"
URL="${DATABASE_URL:-postgresql://nitheky:nitheky@localhost:5432/nitheky}"

psql "$URL" -X -qAt -c "select 1" >/dev/null 2>&1 || {
  echo "✘ PostGIS no responde en $URL — arráncalo con: sql/pg.sh start" >&2
  exit 1
}

echo "── los dos escenarios del encargo ─────────────────────────────"
A=$(psql "$URL" -X -qAt -c \
  "select count(*) from buscar_conductores(st_point(32.5656,-25.8457), st_point(32.6489,-25.7422), tstzrange('2026-10-01 07:00+00','2026-10-01 08:00+00'), 1, 1500, 3000);")
B=$(psql "$URL" -X -qAt -c \
  "select count(*) from buscar_conductores(st_point(32.5656,-25.8457), st_point(32.5832,-25.9655), tstzrange('2026-10-01 07:00+00','2026-10-01 08:00+00'), 1, 1500, 3000);")
echo "escenario A (Zimpeto→Marracuene)   → $A conductores (esperado: 2)"
echo "escenario B (Zimpeto→Maputo)       → $B conductores (esperado: 0 — dirección opuesta)"
[ "$A" = "2" ] && [ "$B" = "0" ] || { echo "✘ los escenarios del encargo fallan" >&2; exit 1; }

echo "── neutralidad de país (Luanda, mismo motor, cero reconfiguración) ──"
L1=$(psql "$URL" -X -qAt -c \
  "select count(*) from buscar_conductores(st_point(13.3350,-8.8770), st_point(13.3740,-8.9000), tstzrange('2026-10-01 07:00+00','2026-10-01 08:00+00'), 1, 1500, 3000);")
L2=$(psql "$URL" -X -qAt -c \
  "select count(*) from buscar_conductores(st_point(13.3740,-8.9000), st_point(13.2894,-8.8390), tstzrange('2026-10-01 07:00+00','2026-10-01 08:00+00'), 1, 1500, 3000);")
echo "Luanda (Cacuaco→Viana)             → $L1 conductores (esperado: 1 — Joaquim)"
echo "Luanda al revés (Viana→centro)     → $L2 conductores (esperado: 0)"
[ "$L1" = "1" ] && [ "$L2" = "0" ] || { echo "✘ los escenarios de Luanda fallan" >&2; exit 1; }

echo "── la carrera por la última plaza, ${CARRERAS} veces ───────────"
for i in $(seq 1 "$CARRERAS"); do
  "$RAIZ/sql/carrera.sh" >/dev/null || { echo "✘ la carrera $i rompió el invariante" >&2; exit 1; }
done
echo "✔ ${CARRERAS} carreras limpias: una plaza, un ganador, cero sobreventas"
echo ""
echo "TODO VERIFICADO: 9/9 requisitos contra una base PostGIS real."
