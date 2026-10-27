import { test, expect } from '@playwright/test';
import { goTo, login } from './helpers';

test('a new repair is saved and listed', async ({ page }) => {
  await login(page);
  await goTo(page, /Reparaciones/);
  await page.getByRole('button', { name: /Nueva reparación/ }).first().click();
  await page.getByLabel(/Nombre/).fill('Cliente E2E');
  await page.getByLabel(/Teléfono/).fill('600123123');
  await page.getByLabel(/Dispositivo/).fill('iPhone 15 Pro');
  await page.getByLabel(/Problema/).fill('Pantalla rota');
  await page.getByRole('button', { name: 'Guardar' }).click();
  await expect(page.getByText('Cliente E2E').first()).toBeVisible();
});
