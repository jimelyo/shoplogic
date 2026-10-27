import { expect, type Page } from '@playwright/test';

/** Signs in with the seeded demo administrator. */
export async function login(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: /Administrador/ }).first().click();
  await page.getByLabel(/Contraseña/).fill('admin123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByRole('button', { name: /Punto de Venta/ })).toBeVisible();
}

/** Opens a module from the sidebar. */
export async function goTo(page: Page, name: RegExp) {
  await page.getByRole('button', { name }).first().click();
}
