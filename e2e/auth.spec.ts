import { test, expect } from '@playwright/test';
import { login } from './helpers';

test('login with the seeded admin reaches the dashboard', async ({ page }) => {
  await login(page);
  await expect(page.getByRole('button', { name: /^Configuración/ })).toBeVisible();
  await expect(page).toHaveTitle(/ShopLogic/);
});

test('wrong password is rejected', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /Administrador/ }).first().click();
  await page.getByLabel(/Contraseña/).fill('not-the-password');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page.getByText('Email o contraseña incorrectos', { exact: true }).first()).toBeVisible();
});
