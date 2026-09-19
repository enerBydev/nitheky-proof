-- NITHEKY · La semilla: los DOS escenarios del encargo, tal cual los pidió,
-- más el de Luanda que demuestra la neutralidad de país.
--
-- Coordenadas reales (EN1 Mozambique / EN100 Angola). El jueves 1 de octubre
-- de 2026 a las 07:00 UTC — hora punta de Maputo.

begin;

truncate reservas, conductores;

-- ── El corredor del encargo: Maputo → Marracuene por la EN1 ───────────────
insert into conductores (id, nombre, ruta, ventana, plazas, desvio_max_m, nota, valoraciones, verificado) values
(
  'drv-amelia',
  'Amélia',
  st_geomfromgeojson('{
    "type": "LineString",
    "coordinates": [
      [32.5764, -25.9667],
      [32.5700, -25.9560],
      [32.5880, -25.9555],
      [32.5890, -25.9010],
      [32.5656, -25.8457],
      [32.6100, -25.7900],
      [32.6489, -25.7422]
    ]
  }')::geography,
  tstzrange('2026-10-01 07:00+00', '2026-10-01 07:45+00'),
  3, 1500, 4.8, 41, true
),
(
  'drv-tomas',
  'Tomás',
  st_geomfromgeojson('{
    "type": "LineString",
    "coordinates": [
      [32.5764, -25.9667],
      [32.5700, -25.9560],
      [32.5880, -25.9555],
      [32.5890, -25.9010],
      [32.5656, -25.8457],
      [32.6100, -25.7900],
      [32.6489, -25.7422]
    ]
  }')::geography,
  tstzrange('2026-10-01 07:30+00', '2026-10-01 09:00+00'),
  1, 2500, 4.5, 9, true
),
(
  'drv-isabel',
  'Isabel',
  st_geomfromgeojson('{
    "type": "LineString",
    "coordinates": [
      [32.5764, -25.9667],
      [32.5700, -25.9560],
      [32.5880, -25.9555],
      [32.5890, -25.9010],
      [32.5656, -25.8457],
      [32.6100, -25.7900],
      [32.6489, -25.7422]
    ]
  }')::geography,
  tstzrange('2026-10-01 09:00+00', '2026-10-01 11:00+00'),
  2, 1000, 5.0, 1, false
),
-- ── La neutralidad de país: Luanda → Viana por la EN100 ──────────────────
-- MISMA tabla, MISMO tipo de geometría, MISMA consulta de 02. No hay nada
-- que configurar por país: si esta línea falla, es que el motor miente.
(
  'drv-joaquim',
  'Joaquim (Luanda)',
  st_geomfromgeojson('{
    "type": "LineString",
    "coordinates": [
      [13.2894, -8.8390],
      [13.3150, -8.8550],
      [13.3400, -8.8800],
      [13.3700, -8.9100],
      [13.3740, -8.9000]
    ]
  }')::geography,
  tstzrange('2026-10-01 07:00+00', '2026-10-01 07:45+00'),
  4, 1500, 4.6, 23, true
);

commit;

-- ── Verificación inmediata de la semilla ──────────────────────────────────
select id,
       round((st_length(ruta) / 1000)::numeric, 2) as km_de_ruta,
       ventana,
       plazas
from conductores
order by id;

-- Zimpeto cae en la fracción 0.526 de la ruta de Amélia (medido en el motor
-- TypeScript con proyección geodésica; en PostGIS, st_linelocatepoint sobre
-- la geometría en grados da 0.522 — la diferencia del 0.4 % viene de medir
-- la fracción en el plano de grados y está muy por debajo del margen de
-- dirección de 0.01 que usa la consulta de 02).
select st_linelocatepoint(ruta::geometry, st_point(32.5656, -25.8457)::geometry) as fraccion_zimpeto
from conductores where id = 'drv-amelia';
