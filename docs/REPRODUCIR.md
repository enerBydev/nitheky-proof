# Cómo reproducir esta prueba — tres caminos, el que le guste

Todo lo que este repo afirma está dicho con un número al lado. Nada de
«funciona»: `reservado: true, plazas_restantes: 0`. Reproduzca cualquiera
de los tres caminos siguientes y compare.

## 0 · El camino rápido (sin instalar nada)

La página interactiva de GitHub Pages importa el MISMO motor TypeScript que
los tests, en el navegador:

> **https://enerbydev.github.io/nitheky-proof/**

Cambie el escenario, mueva los puntos, estire el desvío: los nueve números
del resultado se recalculan en vivo. No hay servidor: la aritmética corre
en su máquina, con su navegador, sin que nada de esto se pueda maquillar.

## 1 · TypeScript (Node 22+, sin instalar dependencias)

```bash
node --test "tests/*.test.ts"
```

18 tests. Los dos escenarios del encargo, cada requisito con su propio
fallo demostrable, la neutralidad de país con Luanda, y la carrera por la
última plaza disparada **1.000 veces** con el interleave real del bucle de
eventos. Salida esperada (verificada):

```
ℹ tests 18
ℹ pass 18
ℹ fail 0
   orden: drv-amelia 91.4% · drv-tomas 82.6%
   recogida frac 0.526 ≥ destino frac 0.000 → hacia atrás
```

## 2 · SQL con PostGIS (una línea de Docker)

```bash
docker run --name nitheky -e POSTGRES_PASSWORD=nitheky \
           -e POSTGRES_USER=nitheky -e POSTGRES_DB=nitheky \
           -p 5432:5432 -d postgis/postgis:16-3.4

# esperar ~10 s a que arranque, y aplicar en orden:
cat sql/00_schema.sql    | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/01_seed.sql      | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/02_matching.sql  | docker exec -i nitheky psql -U nitheky -d nitheky
```

`02` devuelve cuatro tablas: escenario A (dos conductores ordenados por
puntuación), escenario B (**cero filas**: dirección opuesta), Luanda (el
conductor de Joaquim) y Luanda al revés (cero filas). Después, la carrera:

```bash
cat sql/03_reserva.sql | docker exec -i nitheky psql -U nitheky -d nitheky
docker exec -i nitheky psql -U nitheky -d nitheky -c \
  "select reservar_plaza('drv-tomas','pasajero-ana',1);" &
docker exec -i nitheky psql -U nitheky -d nitheky -c \
  "select reservar_plaza('drv-tomas','pasajero-bruno',1);" &
wait
# → un true, un false, plazas en 0, UNA reserva. Mil veces si quiere.
```

El script `sql/carrera.sh` empaqueta lo mismo y comprueba el invariante
automáticamente (falla con código 1 si alguna vez se vendieran dos).

## 3 · Contra su propia base

El SQL no depende de Docker: cualquier PostgreSQL 14+ con la extensión
PostGIS 3 sirve. `00` es idempotente, `01` re-siembra desde cero con
`truncate`, así que aplicarlo dos veces no duplica nada.

## Qué es DEMO y qué es REUTILIZABLE

Honestidad primero — es la casa:

| | |
|---|---|
| **Demo / desechable** | La semilla (conductores con nombre, la ruta de 7 vértices), la página web, los tests como tests |
| **Reutilizable tal cual** | `motor/geoespacial.ts` y `motor/matching.ts` (la aritmética del matching, cero dependencias), `sql/00` y `sql/02` (el esquema y la consulta — el corazón del producto), `sql/03` (el patrón de reserva atómica: LA parte que no se puede dejar para después) |
| **Lo que el MVP añade** | Cuentas reales (OTP), publicación de rutas desde la app, tracking en vivo, pagos, SOS, panel. El repositorio que ya vio (match-engine) lleva la mitad del camino andado en PostGIS |

## Los números que deciden cada requisito

| # | Requisito | Dónde | El número |
|---|---|---|---|
| 1 | Ruta/polilínea real | `sql/00` · `motor/escenarios.ts` | 30.00 km medidos, 7 vértices |
| 2 | Corredor | `sql/02` (`st_dwithin`) · `matching.ts` | corredor configurable, 1.500 m aquí |
| 3 | Recogida antes que destino | `st_linelocatepoint` · `proyectar()` | fracción 0.526 < 1.000 ✓ |
| 4 | Misma dirección | el mismo número | fracción 0.526 ≥ 0.000 ✗ rechazado |
| 5 | Desvío configurable | `sql/02` · `matching.ts` | 2.480 m medidos en el test |
| 6 | Ventanas de tiempo | `tstzrange &&` · `ventanasSolapan` | solape en minutos |
| 7 | Plazas | `plazas >= pedidas` | filtro duro, no «ordenar por» |
| 8 | Ranking de varios drivers | `order by puntuacion desc` | amelia 91.4% > tomás 82.6% |
| 9 | Última plaza a la vez | `sql/03` · `tests/carrera` | 1.000 carreras, 0 dobles |
