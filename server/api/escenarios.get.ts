// /api/escenarios — los cuatro casos del encargo con sus coordenadas
// reales, para quien quiera golpear la API directamente sin abrir la página.
import {
  conductoresMozambique,
  pasajeroZimpetoMarracuene,
  pasajeroZimpetoMaputo,
  pasajeroCacuacoViana,
  pasajeroVianaLuanda,
  CORREDOR_MZ,
  CORREDOR_AO,
} from '../../motor/escenarios.ts'

export default defineEventHandler(() => {
  const escenarios = [
    {
      id: 'A',
      esperado: 'match',
      etiqueta: 'Driver Maputo→Marracuene · Passenger Zimpeto→Marracuene',
      peticion: pasajeroZimpetoMarracuene(),
    },
    {
      id: 'B',
      esperado: 'reject (direccion_opuesta)',
      etiqueta: 'Driver Maputo→Marracuene · Passenger Zimpeto→Maputo',
      peticion: pasajeroZimpetoMaputo(),
    },
    {
      id: 'L1',
      esperado: 'match',
      etiqueta: 'Luanda (country-neutral) · Passenger Cacuaco→Viana',
      peticion: pasajeroCacuacoViana(),
    },
    {
      id: 'L2',
      esperado: 'reject (direccion_opuesta)',
      etiqueta: 'Luanda · Passenger Viana→Luanda centre',
      peticion: pasajeroVianaLuanda(),
    },
  ]

  return {
    corredores: { mz: CORREDOR_MZ, ao: CORREDOR_AO },
    conductores: conductoresMozambique(),
    escenarios,
    nota: 'POST /api/buscar with { "escenario": "A" } or a custom request',
  }
})
