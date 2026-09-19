# NITHEKY — same-direction matching · technical proof

The two scenarios from the assignment, the nine requirements behind them, and
a reproducible test for each. No server needed to try it:

> **Live page:** <https://enerbydev.github.io/nitheky-proof/>
> — the map, the two Maputo scenarios, the Luanda scenarios, the parameters,
> and the last-seat race, all computed in the browser by the same code the
> test suite verifies.

```
Driver: Maputo → Marracuene          ✓ matches the passenger from Zimpeto
Passenger: Zimpeto → Marracuene        (Zimpeto is on the route, same direction)

Driver: Maputo → Marracuene          ✗ rejects the passenger from Zimpeto
Passenger: Zimpeto → Maputo            (opposite direction along the route)
```

## The nine requirements — where each one lives

| # | Requirement | Implementation | Measured |
|---|---|---|---|
| 1 | real route/polyline storage | `geography(linestring)` in `sql/00_schema.sql` · `Polilinea` in `motor/` | 30.00 km corridor, 7 vertices |
| 2 | route-corridor matching | `st_dwithin(ruta, point, m)` · `proyectar()` in `motor/geoespacial.ts` | pickup 0 m, dropoff 0 m from route |
| 3 | pickup before destination | `st_linelocatepoint` fractions · `motor/matching.ts` | pickup frac **0.526** < dropoff frac **1.000** ✓ |
| 4 | same-direction validation | the same fraction, both ends | Zimpeto→Maputo: 0.526 ≥ 0.000 → **rejected** ✗ |
| 5 | configurable detour | `desvio_max_m` per query and per driver | 2.48 km measured, limit adjustable |
| 6 | time-window compatibility | `tstzrange &&` · `ventanasSolapan()` | overlap in minutes, hard filter |
| 7 | available seats | `plazas >= requested` — filter, not sort order | hard reject when 0 left |
| 8 | ranking of compatible drivers | deterministic score in `puntuar()` | amelia 91.4% > tomás 82.6% |
| 9 | last-seat double-booking protection | atomic conditional update `sql/03_reserva.sql` · `motor/reserva.ts` | 1,000 concurrent races, **0 double sales** |

## Run the tests (no dependencies, Node 22+)

```bash
node --test "tests/*.test.ts"
```

```
ℹ tests 18   ℹ pass 18   ℹ fail 0
   ESCENARIO A · Zimpeto→Marracuene  → matches, ranked
   ESCENARIO B · Zimpeto→Maputo       → rejected: dirección_opuesta
   la última plaza se vende UNA vez en 1000 carreras simultáneas
   NEUTRALIDAD DE PAÍS: Luanda funciona con el mismo código
```

Every requirement has a test that would fail if that requirement were
removed — including the country-neutrality one, which fails if anyone
hardcodes a country into the engine.

## Run the SQL (one Docker line, any PostGIS 3)

```bash
docker run --name nitheky -e POSTGRES_USER=nitheky -e POSTGRES_PASSWORD=nitheky \
           -e POSTGRES_DB=nitheky -p 5432:5432 -d postgis/postgis:16-3.4
cat sql/00_schema.sql   | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/01_seed.sql     | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/02_matching.sql | docker exec -i nitheky psql -U nitheky -d nitheky
```

Then the race for the last seat, with two real concurrent sessions:

```bash
cat sql/03_reserva.sql | docker exec -i nitheky psql -U nitheky -d nitheky
docker exec -i nitheky psql -U nitheky -d nitheky -X -qAt \
  -c "select reservar_plaza('drv-tomas','ana',1);" &
docker exec -i nitheky psql -U nitheky -d nitheky -X -qAt \
  -c "select reservar_plaza('drv-tomas','bruno',1);" &
wait
# → one true, one false, seats at 0, exactly one reservation. Every time.
```

Full instructions, including how to verify the invariants automatically:
**[docs/REPRODUCIR.md](docs/REPRODUCIR.md)**.

## Why direction is a *number*, not a guess

Both the pickup and the dropoff are projected onto the driver's polyline.
Each projection yields the fraction of the route already travelled at that
point — PostGIS calls it `ST_LineLocatePoint`. The passenger travels the
driver's direction if and only if

```
frac(pickup) + margin  <  frac(dropoff)
```

For Zimpeto→Marracuene: `0.526 + 0.01 < 1.000` ✓ — the pickup sits halfway
along the route, the dropoff is the end.
For Zimpeto→Maputo: `0.526 + 0.01 < 0.000` is false — the dropoff projects
*behind* the pickup: opposite direction, rejected with the reason attached.

The 0.01 margin exists because two projections a few metres apart are not a
direction, they are the same corner; and because `ST_LineLocatePoint`
measures in the planar degree space while distances are geodesic. The
measured discrepancy on this corridor is 0.4% — documented, not hidden.

## Honest notes

- The corridor seed uses 7 vertices. Real production routes will carry
  50–500 vertices from a routing API (OSRM/Valhalla/GraphHopper). The math
  does not change; the numbers just get more precise.
- Detour is computed with the out-and-back model
  (`dist(pickup→route) + dist(route→dropoff)`): conservative, and the
  standard choice when the route is a polyline rather than a street graph.
- Country-neutrality is not a layer — it is the absence of one. The engine
  knows nothing about Mozambique or Angola; the tests would fail if it did.
- What is demo and what is reusable: see the table at the end of
  [docs/REPRODUCIR.md](docs/REPRODUCIR.md).

## Layout

```
motor/        the matching arithmetic — zero dependencies, runs in Node and browser
  geoespacial.ts   haversine, projection onto polyline, arc fractions
  matching.ts       the nine requirements as pure functions + the ranking
  reserva.ts        atomic last-seat reservation (the in-memory twin of sql/03)
  escenarios.ts     the client's scenarios, with real coordinates
sql/          the production path — PostGIS
  00_schema.sql    linestring routes, seats, unique constraints
  01_seed.sql      Maputo→Marracuene, the two passenger scenarios, Luanda→Viana
  02_matching.sql  the one query: corridor + direction + detour + windows + seats + ranking
  03_reserva.sql   atomic conditional reservation + the two-session race
  carrera.sh        the race, scripted, with the invariant checked
tests/        18 tests: one per requirement, plus the 1,000-race suite
web/          the page entry — imports the same motor the tests verify
index.html    the live page (dark, one file, Leaflet from CDN)
```

MIT licensed. Built by Rene Mendoza — enerBydev.
