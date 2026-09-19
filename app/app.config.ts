// El color por defecto de Nuxt UI es VERDE y esta marca es oro sobre carbón
// (medido: la primera captura con verde de fábrica confunde). Va en el mismo
// commit que la instalación — regla del banco de pruebas.
export default defineAppConfig({
  ui: {
    colors: {
      primary: 'amber',
      neutral: 'stone',
    },
  },
})
