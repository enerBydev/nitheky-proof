# NITHEKY — same-direction matching · fullstack technical proof

The two scenarios from the assignment, the nine requirements behind them, a
reproducible test for each — and now the whole thing is the app the proposal
actually promises: a **Nuxt 4 fullstack application** with the tested
matching engine at its core, an HTTP API, CI, and a PostGIS path.

> **Live page:** <https://enerbydev.github.io/nitheky-proof/>
> — the map, the two Maputo scenarios, the Luanda scenarios, the parameters,
> and the last-seat race. The math runs in your browser importing the same
> module the test suite verifies; the race calls the server API when there is
> one, and tells you which one just ran.

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
| 8 | ranking of compatible drivers | deterministic score in `puntuar()` | Amélia 91.4% > Tomás 82.6% |
| 9 | last-seat double-booking protection | atomic conditional update `sql/03_reserva.sql` · `motor/reserva.ts` · `/api/reservar` | 1,000 concurrent races, **0 double sales** |

Every requirement has a test that would fail if that requirement were
removed — including the country-neutrality one, which reads the motor's
source and fails if anyone hardcodes a country into the engine.

## Run it (Node 22+)

```bash
pnpm install     # o npm install
pnpm test        # 18 unit tests over motor/ — the same module the page imports
pnpm build       # the Nitro server: pages + the whole HTTP API
pnpm test:e2e    # 32 E2E: pages and API against the real server (Firefox + Chromium)
pnpm dev         # develop locally; /api/salud says which engine is live
```

## Run it (Nix — no Docker, no "works on my machine")

The flake pins the whole toolchain (node, pnpm, postgres+postgis, nixpkgs
by git revision — sealed in `flake.lock`) **and** the dependency layer
(`pnpmDeps`: a fixed-output derivation over the entire lockfile — if a
package changes under it, the build breaks, loudly):

```bash
nix develop                    # node 22 · pnpm 11.20 · PostGIS 18 + PostGIS 3.6
nix develop -c sql/pg.sh start # local PostGIS, seeded
nix run                        # the server NIX built, on :3000
nix flake check                # builds the package AND runs the 18 motor tests
```

The fullstack PostGIS mode (matching and reservations running IN the
database, exactly what the proposal ships):

```bash
nix develop -c sql/pg.sh start    # PostGIS 18 local, schema + seed applied
nix develop -c sql/comprobar.sh   # both scenarios + Luanda + the 100-race check
cp .env.example .env             # uncomment DATABASE_URL, then:
nix develop -c pnpm dev           # /api/salud now says "postgres"
```

Four ways to reproduce everything, including the two-session SQL race for the
last seat: **[docs/REPRODUCIR.md](docs/REPRODUCIR.md)**.
CI runs all of it on every push: lint, typecheck, unit, E2E, the PostGIS
path against a real database, and the nix flake itself
(`.github/workflows/ci.yml`).

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

## Architecture

```
motor/        the matching arithmetic — zero dependencies, runs in Node and browser.
              Unchanged since the audited v1 (only type guards added; tests re-verify).
  geoespacial.ts   haversine, projection onto polyline, arc fractions
  matching.ts      the nine requirements as pure functions + the ranking
  reserva.ts       atomic last-seat reservation (the in-memory twin of sql/03)
  escenarios.ts    the client's scenarios, with real coordinates
app/          the Nuxt UI: map (Leaflet, Esri Light Gray), scenarios, sliders,
              the nine measured live, the race. Nuxt UI 4 + Tailwind 4.
server/       the Nitro API: /api/salud · /api/escenarios · /api/buscar ·
              /api/reservar · /api/carrera — zod-validated, dual mode:
              in-memory engine, or PostGIS (sql/02, sql/03) when DATABASE_URL exists.
sql/          the production path — PostGIS: schema, seed, the one matching
              query, the atomic reservation + the scripted race with invariants.
              pg.sh starts/stops/resets a local PostGIS 18 (from the nix flake);
              comprobar.sh is THE acceptance script: both scenarios of the
              assignment, Luanda, and the 100-race invariant — same script
              a human runs and the CI runs.
tests/unit/   the 18 tests over motor/ (Vitest)
tests/e2e/    pages + API against the real server (Playwright, Firefox primary)
docs/         REPRODUCIR.md · the vision audit that shaped this v2 · evidence
.github/      CI: lint → typecheck → unit → build → E2E → PostGIS → nix → Pages
flake.nix     the whole stack, frozen: dev shell, the Nitro server as a package,
              and `nix flake check` running the 18 tests inside the sandbox
```

This v2 exists because an AI-vision + QA audit of the static v1 scored it
6/10 and listed what a client would trip on: map below the fold, Spanish
rejection strings inside an English UI, no production stack. The audit, the
raw model verdicts and the screenshots live in
[docs/AUDITORIA-VISION-QA.md](docs/AUDITORIA-VISION-QA.md); the re-audit of
this version scored it 9/10 with the same judge and the same prompts.

## Honest notes

- The corridor seed uses 7 vertices. Real production routes will carry
  50–500 vertices from a routing API (OSRM/Valhalla/GraphHopper). The math
  does not change; the numbers just get more precise.
- Detour is computed with the out-and-back model
  (`dist(pickup→route) + dist(route→dropoff)`): conservative, and the
  standard choice when the route is a polyline rather than a street graph.
- Country-neutrality is not a layer — it is the absence of one. The engine
  knows nothing about Mozambique or Angola; the tests would fail if it did.
- The in-memory reservation store is per-process: it demonstrates the
  atomicity logic, and the SQL path is the production one (the CI runs it
  against a real PostGIS on every push).
- What is demo and what is reusable: the table at the end of
  [docs/REPRODUCIR.md](docs/REPRODUCIR.md).

## Versions — all releases, none alpha

Node 22.23.2 · pnpm 11.20.0 · Nuxt 4.5.2 · Nuxt UI 4.11.1 · Tailwind CSS 4.3.3 ·
Leaflet 1.9.4 (@nuxtjs/leaflet 1.3.3) · Vitest 5.0.1 · Playwright 1.63 ·
TypeScript 6.0.3 · pg 8.23 · zod 4.6 · PostgreSQL 18.6 + PostGIS 3.6.4 — and
the toolchain itself frozen by the flake: nixpkgs `nixos-26.05` at revision
`cf9d2fb`, sealed in `flake.lock`. Decisions measured, not adopted by
fashion: see docs/REPRODUCIR.md.

One honest nuance: inside the nix sandbox there is no network by design, so
the fonts module falls back to the system font stack there; the CI-built
Pages bundle self-hosts the fonts, as measured in the ecosystem bench.

MIT licensed. Built by Rene Mendoza — enerbydev.
