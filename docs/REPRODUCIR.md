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

Para desarrollar con la base de datos de verdad (el modo PostGIS):

```bash
docker compose up -d db
docker compose exec -T db psql -U nitheky -d nitheky < sql/00_schema.sql
docker compose exec -T db psql -U nitheky -d nitheky < sql/01_seed.sql
docker compose exec -T db psql -U nitheky -d nitheky < sql/02_matching.sql
docker compose exec -T db psql -U nitheky -d nitheky < sql/03_reserva.sql
cp .env.example .env    # y descomentar DATABASE_URL
pnpm dev                # /api/salud dirá "postgres"
```

## 3 · SQL con PostGIS (el camino de producción)

```bash
docker run --name nitheky -e POSTGRES_PASSWORD=nitheky \
           -e POSTGRES_USER=nitheky -e POSTGRES_DB=nitheky \
           -p 5432:5432 -d postgis/postgis:18-3.6

# esperar ~10 s a que arranque, y aplicar en orden:
cat sql/00_schema.sql    | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/01_seed.sql      | docker exec -i nitheky psql -U nitheky -d nitheky
cat sql/02_matching.sql | docker exec -i nitheky psql -U nitheky -d nitheky
```

`02` devuelve cuatro tablas: escenario A (dos conductores ordenados por
puntuación), escenario B (**cero filas**: dirección opuesta), Luanda (el
conductor de Joaquim) y Luanda al revés (cero filas). Después, la carrera:

```bash
cat sql/03_reserva.sql | docker exec -i nitheky psql -U nitheky -d nitheky
docker exec -i nitheky psql -U nitheky -d nitheky -X -qAt \
  -c "select reservar_plaza('drv-tomas','pasajero-ana',1);" &
docker exec -i nitheky psql -U nitheky -d nitheky -X -qAt \
  -c "select reservar_plaza('drv-tomas','pasajero-bruno',1);" &
wait
```

Una `t`, una `f`, y las plazas de Tomás en 0. Siempre. El script
`sql/carrera.sh` hace lo mismo y **comprueba el invariante** (una plaza, un
ganador, cero sobreventas) con exit 1 si se rompe:

```bash
DATABASE_URL=postgresql://nitheky:nitheky@localhost:5432/nitheky sql/carrera.sh
```

El CI de GitHub Actions corre exactamente este camino contra un PostGIS 18
real en cada push — ver `.github/workflows/ci.yml`, trabajo `sql`.

## Qué es demo y qué es reutilizable

| Pieza | Qué es | Reutilizable |
|---|---|---|
| `motor/` | la aritmética del matching, cero dependencias, Node y navegador | **tal cual** — es el núcleo de la app y de los tests |
| `sql/` | el camino de producción: esquema PostGIS, la consulta única, la reserva atómica | **tal cual** |
| `server/` | la API Nitro que expone motor y SQL con validación zod | como base del MVP |
| `app/` | la página Nuxt (mapa, escenarios, parámetros, carrera) | demo — la UI del producto real se diseña aparte |
| los conductores sembrados | datos con los números interesantes a mano | demo — datos reales de un routing API (OSRM/Valhalla) |

## Versiones con las que esto corre (todas release, ninguna alpha)

Node 22+ (probado en 22 LTS y 24 LTS) · pnpm 11.20 · Nuxt 4.5.2 ·
Nuxt UI 4.11.1 (trae @nuxt/icon, @nuxt/fonts, @nuxtjs/color-mode) ·
Tailwind CSS 4.3.3 · Leaflet 1.9.4 (@nuxtjs/leaflet 1.3.3) · Vitest 5.0.1 ·
Playwright 1.63 · TypeScript 6.0.3 · ESLint (@nuxt/eslint 1.17) ·
pg 8.23 · zod 4.6 · PostGIS 18-3.6.

Las decisiones de ecosistema (por qué Nuxt UI sí y MapLibre no, por qué Esri
y no CARTO) están medidas y documentadas en el repo de conocimiento interno;
la auditoría visual que produjo esta v2 está en
[docs/AUDITORIA-VISION-QA.md](AUDITORIA-VISION-QA.md) con sus capturas.
