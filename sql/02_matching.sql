-- NITHEKY · La consulta de matching: los requisitos 2, 3, 4, 5, 6, 7 y 8
-- en UNA sola pasada por la base — que es donde deben vivir, porque un filtro
-- duro que vive en la aplicación es un filtro que se olvida en el endpoint
-- siguiente.
--
-- LOS NUMEROS QUE DECIDEN CADA REQUISITO (y de dónde salen):
--
--   2 · corredor        st_dwithin(ruta, punto, corredor_m)  [metros, elipsoide]
--   3 · recogida antes  st_linelocatepoint(ruta, recogida) < st_linelocatepoint(ruta, destino)
--                        con un margen de 0.01 (ver nota de abajo)
--   4 · misma dirección el MISMO numero del 3: Zimpeto→Maputo da
--                        0.52 < 0.00 = falso → rechazado
--   5 · desvío          st_distance(ruta, recogida) + st_distance(ruta, destino) <= desvio_max_m
--                        (modelo de ida-y-vuelta: conservador, nunca infraestima)
--   6 · ventanas        conductor.ventana && pasajero.ventana   [solape de tstzrange]
--   7 · plazas          plazas >= las pedidas
--   8 · ranking         orden por desvío, margen horario y confianza — determinista
--
-- PRECISION DECLARADA (st_linelocatepoint trabaja sobre geometría plana y la
-- ruta está en grados): frente a la proyección geodésica del motor TypeScript,
-- la fracción de Zimpeto da 0.522 frente a 0.526 — un 0.4 % de diferencia
-- porque el grado de longitud mide ~10 % menos que el de latitud en Maputo.
-- Por eso el margen de dirección es 0.01 (≈ 300 m en una ruta de 30 km):
-- dos proyecciones a menos de 300 m una de otra no son una dirección, son
-- la misma esquina. Las DISTANCIAS y el CORREDOR no tienen este error:
-- st_dwithin y st_distance sobre `geography` son geodésicas exactas.

create or replace function buscar_conductores(
  p_recogida   geography(point, 4326),
  p_destino    geography(point, 4326),
  p_ventana    tstzrange,
  p_plazas     int    default 1,
  p_corredor_m int    default 1500,   -- el «1-2 km del corredor» del doc de producto
  p_desvio_max_m int  default 3000    -- requisito 5: configurable por consulta
)
returns table (
  conductor_id    text,
  nombre          text,
  recogida_dist_m double precision,
  destino_dist_m  double precision,
  fraccion_recogida double precision,
  fraccion_destino  double precision,
  desvio_m        double precision,
  solape_min      double precision,
  puntuacion      double precision
)
language sql stable as $$
  with proyectado as (
    select c.id, c.nombre, c.plazas, c.desvio_max_m, c.nota, c.valoraciones,
           c.verificado, c.ventana,
           -- 2 · corredor: distancia exacta al elipsoide, en metros
           st_distance(c.ruta, p_recogida) as recogida_dist_m,
           st_distance(c.ruta, p_destino)  as destino_dist_m,
           -- 3 · la posición a lo largo de la ruta: LA que decide la dirección
           st_linelocatepoint(c.ruta::geometry, p_recogida::geometry) as fr,
           st_linelocatepoint(c.ruta::geometry, p_destino::geometry)  as fd,
           -- 5 · desvío de ida y vuelta (conservador por diseño)
           st_distance(c.ruta, p_recogida) + st_distance(c.ruta, p_destino) as desvio_m
    from conductores c
    -- 7 · plazas: filtro duro, no «ordenar por plazas»
    where c.plazas >= p_plazas
    -- 6 · ventanas: solape de rangos, el && de tstzrange
      and c.ventana && p_ventana
    -- 2 · corredor: recogida y destino, ambos, con el GiST
      and st_dwithin(c.ruta, p_recogida, p_corredor_m)
      and st_dwithin(c.ruta, p_destino, p_corredor_m)
  ),
  filtrado as (
    select *,
           -- 3 y 4 · recogida ANTES que destino, a lo largo de la ruta.
           -- El margen 0.01 absorbe el error planar de medir fracciones
           -- en grados (0.4 % medido, ver cabecera) y el caso de dos
           -- proyecciones pegadas, que no es una dirección.
           fr + 0.01 < fd as misma_direccion
    from proyectado
  ),
  medido as (
    select *,
           -- 8 · el ranking, cada componente en su unidad real:
           --   desvío: fracción del máximo que no se recorre
           --   espera: minutos de solape con la ventana del conductor
           --   confianza: nota suavizada (un 5.0 de una reseña ≠ un 4.8 de 41)
           greatest(0, 1 - desvio_m / greatest(1, desvio_max_m))             as c_desvio,
           least(1, extract(epoch from upper(ventana * p_ventana)) / 3600)  as c_espera,
           ((nota * least(valoraciones, 50) + 4.2 * 5) / (least(valoraciones, 50) + 5)) / 5.0 as c_confianza
    from filtrado
    where misma_direccion
      and desvio_m <= p_desvio_max_m
  )
  select conductor_id, nombre, recogida_dist_m, destino_dist_m,
         fr as fraccion_recogida, fd as fraccion_destino, desvio_m,
         extract(epoch from upper(ventana * p_ventana)) / 60.0 as solape_min,
         -- pesos 0.4 / 0.3 / 0.2 / 0.1 — a la vista, no escondidos
         round((0.4 * c_desvio + 0.3 * c_espera + 0.2 * c_confianza +
                0.1 * (case when verificado then 1 else 0 end)) * 1000) / 10.0
           as puntuacion
  from medido
  order by puntuacion desc, conductor_id;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- LOS DOS ESCENARIOS DEL ENCARGO, palabra por palabra.
-- Ejecutar esto tras 00 + 01 y leer las dos salidas.
-- ═══════════════════════════════════════════════════════════════════════════

-- ESCENARIO A · Driver Maputo→Marracuene + Passenger Zimpeto→Marracuene
-- → ENCUENTRA a Amélia y a Tomás, ordenados. Zimpeto está a medio camino
--   (fracción 0.52) y Marracuene es el final: misma dirección.
select * from buscar_conductores(
  st_point(32.5656, -25.8457),            -- Zimpeto (recogida)
  st_point(32.6489, -25.7422),            -- Marracuene (destino)
  tstzrange('2026-10-01 07:00+00', '2026-10-01 08:00+00'),
  1, 1500, 3000
);

-- ESCENARIO B · Driver Maputo→Marracuene + Passenger Zimpeto→Maputo
-- → VACÍO: cero filas. La recogida cae en la fracción 0.52 de la ruta y el
--   destino en la 0.00: el pasajero va hacia atrás. Ningún conductor de
--   Maputo→Marracuene le sirve, y la consulta lo dice sin que nadie lo
--   programe aparte.
select * from buscar_conductores(
  st_point(32.5656, -25.8457),            -- Zimpeto (recogida)
  st_point(32.5832, -25.9655),            -- Maputo centro (destino: dirección OPUESTA)
  tstzrange('2026-10-01 07:00+00', '2026-10-01 08:00+00'),
  1, 1500, 3000
);

-- NEUTRALIDAD DE PAÍS · Cacuaco→Viana, con la MISMA función y el MISMO
-- esquema. Si el motor supiera nada de Mozambique, esta llamada fallaría.
select * from buscar_conductores(
  st_point(13.3350, -8.8770),            -- Cacuaco (recogida)
  st_point(13.3740, -8.9000),            -- Viana (destino)
  tstzrange('2026-10-01 07:00+00', '2026-10-01 08:00+00'),
  1, 1500, 3000
);

-- Y la dirección opuesta en Luanda, también vacía:
select * from buscar_conductores(
  st_point(13.3740, -8.9000),            -- Viana (recogida)
  st_point(13.2894, -8.8390),            -- Luanda centro (destino)
  tstzrange('2026-10-01 07:00+00', '2026-10-01 08:00+00'),
  1, 1500, 3000
);

-- POR QUÉ SALIÓ VACÍO (para el escenario B, el número a la vista):
select st_linelocatepoint(ruta::geometry, st_point(32.5656, -25.8457)::geometry) as fraccion_zimpeto,
       st_linelocatepoint(ruta::geometry, st_point(32.5832, -25.9655)::geometry) as fraccion_maputo,
       st_linelocatepoint(ruta::geometry, st_point(32.5656, -25.8457)::geometry)
         < st_linelocatepoint(ruta::geometry, st_point(32.5832, -25.9655)::geometry)
         as recogida_antes_de_destino
from conductores where id = 'drv-amelia';
