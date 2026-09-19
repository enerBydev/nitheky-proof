# Cómo reproducir esta prueba — cuatro caminos, el que le guste

Todo lo que este repo afirma está dicho con un número al lado. Nada de
«funciona»: `reservado: true, plazas_restantes: 0`. Reproduzca cualquiera de
los cuatro caminos siguientes y compare.

## 0 · El camino rápido (sin instalar nada)

La página interactiva de GitHub Pages es la app Nuxt completa, prerenderizada
estática — y la aritmética corre EN SU NAVEGADOR importando el MISMO motor
TypeScript que los tests verifican:

> **https://enerbydev.github.io/nitheky-proof/**

Cambie el escenario, mueva el corredor, estire el desvío: los nueve números
del resultado se recalculan en vivo. El botón de la carrera intenta la API
del servidor y, si no hay servidor (estático), corre el mismo motor en local —
el badge dice cuál de las dos acaba de ocurrir. Nada de esto se puede maquillar.

## 1 · La suite del motor (Vitest, Node 22+, un comando)

```bash
pnpm install   # o npm install; no hay que configurar nada
pnpm test
```

18 tests. Los dos escenarios del encargo, cada requisito con su propio
fallo demostrable, la neutralidad de país con Luanda, y la carrera por la
última plaza disparada **1.000 veces** con el interleave real del bucle de
eventos. La salida tal cual sale del runner queda en
[docs/EVIDENCIA-tests.txt](EVIDENCIA-tests.txt).

## 2 · La app fullstack completa (E2E contra el servidor real)

```bash
pnpm install
pnpm build
pnpm test:e2e
```

Playwright levanta el servidor Nitro de producción del build y lo golpea de
verdad: las páginas en Firefox y Chromium (el mapa con teselas cargadas, los
escenarios A/B/Luanda, la carrera), y la API HTTP por `request`
(`/api/salud`, `/api/buscar`, `/api/carrera`, `/api/reservar` con su 400
validado). 32 tests.

Para desarrollar con la base de datos de verdad (el modo PostGIS) — sin
Docker, con el mismo flake:

```bash
nix develop -c sql/pg.sh start   # PostGIS 18.6 + PostGIS 3.6, sembrado
cp .env.example .env             # y descomentar DATABASE_URL
nix develop -c pnpm dev          # /api/salud dirá "postgres"
```

(`sql/pg.sh` sin argumento arranca; `stop`, `status` y `reset` también.
El dato vive en `.pgdata/`, gitignored. Si prefiere su propio PostGIS:
aplique `sql/00` → `01` → `02` → `03` con psql y apunte DATABASE_URL donde
corresponda.)

## 3 · SQL con PostGIS (el camino de producción)

```bash
nix develop -c sql/comprobar.sh
```

Ese es todo el comando. Hace, en orden: arrancar (si hace falta) el PostGIS
18 local del flake, sembrar esquema y datos, y **verificar con invariante**:

- **escenario A** (Zimpeto→Marracuene) → 2 conductores ordenados por puntuación
- **escenario B** (Zimpeto→Maputo) → **cero filas**: dirección opuesta
- **Luanda** (Cacuaco→Viana) → el conductor de Joaquim; **al revés** → cero
- la **carrera por la última plaza, 100 veces** — una plaza, un ganador,
  cero sobreventas, o exit 1

Si quiere ver los números a mano, las cuatro consultas con su salida esperada
están comentadas dentro de `sql/02_matching.sql` y `sql/03_reserva.sql`; la
carrera suelta, con sus DOS sesiones psql reales:

```bash
nix develop -c sql/pg.sh start        # si no está arriba
nix develop -c sql/carrera.sh         # dos psql simultáneos + invariante
```

El CI de GitHub Actions corre **exactamente el mismo script** (`sql/comprobar.sh`)
sobre el mismo flake en cada push — ver `.github/workflows/ci.yml`, trabajo
`sql`. No hay una versión de la verdad para CI y otra para humanos.

## 4 · El flake entero (nix, sin Docker)

El flake congela las dos capas que Docker dejaba sueltas: el toolchain
(node 22.23.2, pnpm 11.20.0, PostgreSQL 18.6 + PostGIS 3.6.4, nixpkgs por
revisión de git — sellado en `flake.lock`) y las dependencias (`pnpmDeps`:
un fixed-output derivation sobre el lockfile entero — si un paquete cambia
por debajo, el build rompe).

```bash
nix develop            # el entorno: node, pnpm, psql, postgis
nix run                # el servidor Nitro que NIX construyó, en :3000
nix flake check        # construye el paquete Y corre los 18 tests del
                        # motor DENTRO del sandbox — y si algo no cuadra,
                        # exit distinto de cero
```

El trabajo `nix` del CI hace exactamente eso, y después enciende el
servidor construido y le pregunta a `/api/salud` — la prueba de que el
artefacto que nix produce no es una promesa.

## Qué es demo y qué es reutilizable

| Pieza | Qué es | Reutilizable |
|---|---|---|
| `motor/` | la aritmética del matching, cero dependencias, Node y navegador | **tal cual** — es el núcleo de la app y de los tests |
| `sql/` | el camino de producción: esquema PostGIS, la consulta única, la reserva atómica; `pg.sh` y `comprobar.sh` lo hacen reproducible sin Docker | **tal cual** |
| `server/` | la API Nitro que expone motor y SQL con validación zod | como base del MVP |
| `app/` | la página Nuxt (mapa, escenarios, parámetros, carrera) | demo — la UI del producto real se diseña aparte |
| `flake.nix` | el toolchain congelado + el paquete del servidor + los tests en sandbox | **tal cual** — extender a más sistemas exige verificarlos |
| los conductores sembrados | datos con los números interesantes a mano | demo — datos reales de un routing API (OSRM/Valhalla) |

## Versiones con las que esto corre (todas release, ninguna alpha)

Node 22.23.2 (LTS) · pnpm 11.20.0 · Nuxt 4.5.2 ·
Nuxt UI 4.11.1 (trae @nuxt/icon, @nuxt/fonts, @nuxtjs/color-mode) ·
Tailwind CSS 4.3.3 · Leaflet 1.9.4 (@nuxtjs/leaflet 1.3.3) · Vitest 5.0.1 ·
Playwright 1.63 · TypeScript 6.0.3 · ESLint 10.10 (@nuxt/eslint 1.17) ·
pg 8.23 · zod 4.6 · PostgreSQL 18.6 + PostGIS 3.6.4 — y el propio flake:
nixpkgs `nixos-26.05` (revisión `cf9d2fb`, 18-sep-2026) sellado en
`flake.lock`.

Una honestidad de menos: dentro del sandbox de nix no hay red a propósito,
así que allí el módulo de fuentes cae a la pila de sistema; el bundle de
Pages (construido por el CI, con red) sí auto-aloja las fuentes, como midió
el banco de pruebas del ecosistema.

Las decisiones de ecosistema (por qué Nuxt UI sí y MapLibre no, por qué Esri
y no CARTO) están medidas y documentadas en el repo de conocimiento interno;
la auditoría visual que produjo esta v2 está en
[docs/AUDITORIA-VISION-QA.md](AUDITORIA-VISION-QA.md) con sus capturas.
