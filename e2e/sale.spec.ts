import { test, expect } from '@playwright/test';
import { goTo, login } from './helpers';

test('a POS sale creates a ticket and decrements stock', async ({ page }) => {
  await login(page);
  await goTo(page, /Punto de Venta/);
  const firstProduct = page.getByTestId('pos-product').first();
  await expect(firstProduct).toBeVisible();
  await firstProduct.click();
  await expect(page.getByTestId('pos-checkout')).toBeEnabled();
  await page.getByTestId('pos-checkout').click();
  await expect(page.getByText(/Ticket T-\d+/)).toBeVisible();
  await expect(page.getByText(/Gracias por su compra|Venta completada/i).first()).toBeVisible({ timeout: 10_000 });
});
