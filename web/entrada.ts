// La entrada web: importa el MISMO motor que los tests y lo expone a la
// página. No hay una copia para el navegador: lo que calcula la página es
// el mismo código que `node --test` verifica. Si esta página mostrara
// números distintos a los tests, sería una página rota, no otra versión.
export {
  proyectar,
  haversine,
  longitudPolilinea,
  type Punto,
  type Polilinea,
} from "../motor/geoespacial.ts";
export {
  evaluar,
  buscarConductores,
  ventanasSolapan,
  PESOS_RANKING,
  type RutaConductor,
  type PeticionPasajero,
  type Match,
  type Rechazo,
} from "../motor/matching.ts";
export { MotorReserva } from "../motor/reserva.ts";
export {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
  CORREDOR_MZ,
  CORREDOR_AO,
  ZIMPETO,
  MARRACUENE,
  MAPUTO_CENTRO,
  CACUACO,
  VIANA,
  LUANDA_CENTRO,
} from "../motor/escenarios.ts";
