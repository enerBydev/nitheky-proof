#!/usr/bin/env bash
# NITHEKY · PostGIS 18 local — SIN Docker. El binario lo trae `nix develop`.
#
# Uso (desde la raíz del repo, con el dev shell del flake activo):
#   sql/pg.sh start    arranca + crea usuario/base + aplica 00→03 (idempotente)
#   sql/pg.sh stop     para el servidor
#   sql/pg.sh status   ¿está vivo?
#   sql/pg.sh reset    borra TODO el dato local y re-siembra desde cero
#
# El dato vive en .pgdata/ (gitignored). Escucha SOLO en 127.0.0.1:5432, con
# auth trust — es una base de desarrollo en la propia máquina, no un servicio;
# el password del URL se mantiene por paridad con el modo producción.
#
# DATABASE_URL resultante (la misma que .env.example):
#   postgresql://nitheky:nitheky@localhost:5432/nitheky
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
DATOS="${NITHEKY_PGDATA:-$RAIZ/.pgdata}"
PUERTO="${NITHEKY_PGPORT:-5432}"
HOST=127.0.0.1
URL="postgresql://nitheky:nitheky@${HOST}:${PUERTO}/nitheky"

listo() { pg_isready -q -h "$HOST" -p "$PUERTO" 2>/dev/null; }

sembrar() {
  local f
  for f in 00_schema 01_seed 02_matching 03_reserva; do
    psql "$URL" -X -v ON_ERROR_STOP=1 -q -f "$RAIZ/sql/$f.sql" >/dev/null
  done
}

case "${1:-start}" in
  start|arrancar|inicio)
    if ! listo; then
      if [ ! -f "$DATOS/PG_VERSION" ]; then
        echo "→ initdb en $DATOS (primera vez)"
        initdb -D "$DATOS" -E UTF8 --no-locale -A trust >/dev/null
      fi
      pg_ctl -D "$DATOS" -o "-p $PUERTO -h $HOST -k /tmp" \
            -l "$DATOS/postgres.log" -w start >/dev/null
    fi
    # usuario y base, idempotentes. nitheky es SUPERUSUARIO a propósito: así
    # funcionaba el POSTGRES_USER del docker-compose que este script reemplaza
    # — `create extension postgis` (00_schema) lo exige. Es una base de
    # desarrollo local en 127.0.0.1 con trust, no un servicio.
    psql -h "$HOST" -p "$PUERTO" -d postgres -tAc \
      "select 1 from pg_roles where rolname='nitheky'" | grep -q 1 ||
      psql -h "$HOST" -p "$PUERTO" -d postgres -qtc \
        "create role nitheky login password 'nitheky' superuser"
    psql -h "$HOST" -p "$PUERTO" -d postgres -tAc \
      "select 1 from pg_roles where rolname='nitheky' and rolsuper" | grep -q 1 ||
      psql -h "$HOST" -p "$PUERTO" -d postgres -qtc \
        "alter role nitheky superuser"
    psql -h "$HOST" -p "$PUERTO" -d postgres -tAc \
      "select 1 from pg_database where datname='nitheky'" | grep -q 1 ||
      createdb -h "$HOST" -p "$PUERTO" -O nitheky nitheky
    sembrar
    echo "✔ PostGIS listo en $URL (PostgreSQL $(psql "$URL" -tAc 'show server_version' | tr -d ' ') + PostGIS $(psql "$URL" -tAc "select postgis_lib_version()" | tr -d ' '))"
    ;;

  stop|parar)
    listo && pg_ctl -D "$DATOS" -m fast stop >/dev/null && echo "✔ parado" || echo "· ya estaba parado"
    ;;

  status|estado)
    if listo; then
      echo "✔ vivo en ${HOST}:${PUERTO} — postgis: $(psql "$URL" -tAc "select postgis_version()" 2>/dev/null | cut -d' ' -f1 || echo '?')"
    else
      echo "✘ parado"
      exit 1
    fi
    ;;

  reset|reiniciar)
    listo && pg_ctl -D "$DATOS" -m fast stop >/dev/null || true
    rm -rf "$DATOS"
    exec "$0" start
    ;;

  *)
    echo "uso: $0 {start|stop|status|reset}" >&2
    exit 2
    ;;
esac
