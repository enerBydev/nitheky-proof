// E2E · la página, contra el servidor real de Nitro.
// Firefox es el motor primario (regla del arnés); Chromium de segundo.
// El mapa y la carrera se compruean con píxeles y estados, no con "existe".

import { expect, test } from '@playwright/test'

test.describe('la portada', () => {
  test('renderiza con identidad y el mapa ES visible sin scroll', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByRole('heading', { level: 1 })).toContainText('NITHEKY')
    // hallazgo C1: el mapa tiene que estar en el primer pantallazo
    const mapa = page.getByTestId('mapa')
    await expect(mapa).toBeVisible()
    const caja = await mapa.boundingBox()
    expect(caja?.height).toBeGreaterThan(300)
    // y con teselas de verdad cargadas
    await expect(page.locator('.leaflet-tile-loaded').first()).toBeAttached({ timeout: 20_000 })
  })

  test('escenario A por defecto: 2 de 3, Amélia primera con 91.4%', async ({ page }) => {
    await page.goto('/')
    await expect(page.getByTestId('cuenta-matches')).toHaveText(/2 of 3/)
    await expect(page.getByTestId('tarjeta-drv-amelia')).toBeVisible()
    await expect(page.getByTestId('tarjeta-drv-tomas')).toBeVisible()
    await expect(page.getByTestId('tarjeta-drv-amelia').getByTestId('score')).toHaveText(/91\.4%/)
    // los nueve requisitos medidos en vivo
    await expect(page.getByTestId('tabla-nueve')).toContainText('30.0 km')
  })

  test('escenario B: cero compatibles, la dirección opuesta EN INGLÉS con sus fracciones', async ({
    page,
  }) => {
    await page.goto('/')
    await page.getByTestId('escenario-B').click()
    await expect(page.getByTestId('cuenta-matches')).toHaveText(/0 of 3/)
    await expect(page.getByTestId('cero-compatibles')).toBeVisible()
    // hallazgo C2: la v1 mostraba aquí los strings en español del motor
    await expect(page.getByTestId('rechazados')).toContainText('opposite direction along the route')
    await expect(page.getByTestId('rechazados')).toContainText('0.526')
    await expect(page.getByTestId('rechazados')).not.toContainText('recogida cae en la fracción')
  })

  test('Luanda: neutralidad de país visible, Joaquim compatible', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('escenario-L1').click()
    await expect(page.getByTestId('cuenta-matches')).toHaveText(/1 of 1/)
    await expect(page.getByTestId('tarjeta-drv-joaquim')).toBeVisible()
  })

  test('la carrera: exactamente un SEAT RESERVED, un REFUSED, y el invariante', async ({ page }) => {
    await page.goto('/')
    await page.getByTestId('btn-carrera').click()
    await expect(page.getByTestId('estado-ana')).toHaveText(/SEAT RESERVED|REFUSED/, {
      timeout: 15_000,
    })
    await expect(page.getByTestId('estado-bruno')).toHaveText(/SEAT RESERVED|REFUSED/, {
      timeout: 15_000,
    })
    const estados = [
      await page.getByTestId('estado-ana').innerText(),
      await page.getByTestId('estado-bruno').innerText(),
    ]
    expect(estados.filter((t) => t === 'SEAT RESERVED')).toHaveLength(1)
    expect(estados.filter((t) => t === 'REFUSED')).toHaveLength(1)
    await expect(page.getByTestId('invariante')).toContainText('exactly one winner')
    // corrió contra la API del servidor, no solo en el navegador
    await expect(page.getByTestId('invariante')).toContainText('ran on the server')
  })

  test('la matriz de los nueve requisitos existe y está completa', async ({ page }) => {
    await page.goto('/requisitos')
    const filas = page.getByTestId('matriz-requisitos').locator('tbody tr')
    await expect(filas).toHaveCount(9)
  })
})

test.describe('accesibilidad mínima que la auditoría exigió', () => {
  test('los sliders tienen su etiqueta y los escenarios son botones con estado', async ({
    page,
  }) => {
    await page.goto('/')
    // el slider existe y su etiqueta apunta a él (hallazgo H5)
    await expect(page.locator('#corredor')).toBeVisible()
    await expect(page.locator('label[for="corredor"]')).toBeAttached()
    await expect(page.getByText('corridor radius').first()).toBeVisible()
    const escB = page.getByTestId('escenario-B')
    await expect(escB).toHaveAttribute('aria-pressed', 'false')
    await escB.click()
    await expect(escB).toHaveAttribute('aria-pressed', 'true')
  })
})
