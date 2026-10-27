import { test, expect } from '@playwright/test';
import { goTo, login } from './helpers';

test('fiscal settings expose the VERI*FACTU companion', async ({ page }) => {
  await login(page);
  await goTo(page, /Configuración/);
  await page.getByRole('button', { name: /Fiscal|VERI/i }).first().click();
  await expect(page.getByText(/VERI\*FACTU|Veri\*factu|Certificado/i).first()).toBeVisible();
});
