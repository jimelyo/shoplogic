import { test, expect } from '@playwright/test';
import { goTo, login } from './helpers';

test('manual backup downloads a JSON with a SHA-256 digest', async ({ page }) => {
  await login(page);
  await goTo(page, /Configuración/);
  await page.getByRole('button', { name: /Datos/ }).first().click();

  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: /Descargar JSON/ }).click();
  const download = await downloadPromise;
  const path = await download.path();
  expect(path).toBeTruthy();
  const fs = await import('node:fs');
  const data = JSON.parse(fs.readFileSync(path!, 'utf8'));
  expect(data._meta.digest).toMatch(/^[a-f0-9]{64}$/);
  expect(data.products.length).toBeGreaterThan(0);
});
