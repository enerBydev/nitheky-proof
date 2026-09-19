-- NITHEKY · Esquema de la prueba técnica (requisitos 1 y 7).
--
-- Es idempotente a proposito: se aplica entero, tantas veces como haga falta,
-- y deja la base en el mismo sitio. La ruta es una POLILINEA (`linestring`),
-- no un par de puntos: es el requisito 1 del encargo y la razon por la que
-- `st_dwithin` sobre la ruta encuentra a quien "va por donde tu vas".
--
-- La geometria es `geography`: las distancias en PostGIS se miden sobre el
-- elipsoide, en METROS, sin proyectar nada. Maputo, Luanda o Düsseldorf dan
-- la misma calidad de numero sin configurar nada por pais. La neutralidad de
-- pais NO es una capa: es no haberla necesitado nunca.

create extension if not exists postgis;

-- ── El conductor y su ruta ─────────────────────────────────────────────────
create table if not exists conductores (
  id           text primary key,
  nombre       text not null,
  -- REQUISITO 1 · la ruta como polilínea real. El corredor se mide contra ESTA
  -- línea, no contra el origen y el destino. Un conductor Maputo→Marracuene
  -- pasa por Zimpeto aunque Zimpeto no sea ni su origen ni su destino.
  ruta         geography(linestring, 4326) not null,
  -- Ventana de salida: cuando este conductor está dispuesto a arrancar.
  ventana      tstzrange not null,
  -- REQUISITO 7 · plazas libres. La reserva atómica (03) es la que garantiza
  -- que este numero sea verdad cuando dos pasajeros llegan a la vez.
  plazas       int not null check (plazas >= 0),
  -- REQUISITO 5 · el desvío que ESTE conductor acepta (su corredor).
  desvio_max_m int not null default 1500,
  nota         numeric(2,1) not null default 4.5 check (nota between 0 and 5),
  valoraciones int not null default 0 check (valoraciones >= 0),
  verificado   boolean not null default false
);

-- El indice que hace que el corredor sea barato: GiST sobre la línea. Buscar
-- "quien pasa a 1.500 m de este punto" no es recorrer conductores: es el indice.
create index if not exists conductores_ruta_gist on conductores using gist (ruta);
create index if not exists conductores_ventana_gist on conductores using gist (ventana);

-- ── Las reservas ───────────────────────────────────────────────────────────
create table if not exists reservas (
  id          bigint generated always as identity primary key,
  conductor_id text not null references conductores(id),
  pasajero_id text not null,
  plazas      int not null check (plazas > 0),
  creado      timestamptz not null default now(),
  -- Un pasajero no puede pedir dos veces lo mismo (el "me he apuntado dos
  -- veces" de toda demo). La última plaza la protege 03, esto protege lo otro.
  unique (conductor_id, pasajero_id)
);

create index if not exists reservas_conductor on reservas (conductor_id);
