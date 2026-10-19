import { beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS, getSettings } from '../../db/database';
import { DEFAULT_FISCAL_CONFIG, DEFAULT_SISTEMA_INFORMATICO } from '../../verifactu/service';
import { createInvoiceFromSale, createRectifyingInvoice } from '../invoices';
import type { Invoice, Sale, Settings } from '../../types';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  const settings: Settings = {
    ...DEFAULT_SETTINGS,
    verifactu: { enabled: true },
    verifactuConfig: { ...DEFAULT_FISCAL_CONFIG, system: { ...DEFAULT_SISTEMA_INFORMATICO, NIF: 'B12345678', NumeroInstalacion: '1' } },
  };
  await db.settings.add(settings);
};

beforeEach(clearAll);

const sale = (patch: Partial<Sale> = {}): Sale => ({
  ticketNumber: 'T-0001', date: '2026-04-10T10:00:00.000Z',
  items: [{ productId: 1, name: 'Funda', category: 'accessories', quantity: 1, price: 12.1, cost: 4.5 }],
  subtotal: 10, tax: 2.1, total: 12.1, paymentMethod: 'cash', customerId: undefined, ...patch,
});

const fiscalizedOriginal = async (): Promise<Invoice> => {
  const inv = await createInvoiceFromSale(sale());
  return inv;
};

describe('rectificativas R1–R5 (por diferencias)', () => {
  it('emits a rectificative in its own R series with negative amounts', async () => {
    const original = await fiscalizedOriginal();
    const rect = await createRectifyingInvoice(original, -4.2, 'Error en el precio', 'R4');
    expect(rect.number).toContain('R'); // serie rectificativa, prefijo configurable
    expect(rect.total).toBe(-4.2);
    expect(rect.subtotal).toBeCloseTo(-4.2 / 1.21, 2);
    expect(rect.totalTax).toBeCloseTo(rect.total - rect.subtotal, 2);
    expect(rect.rectifies).toBe(original.id!);
    expect(rect.rectCode).toBe('R4');
    expect(rect.rectMethod).toBe('I');
    expect(rect.status).toBe('paid');
  });

  it('queues the Veri*factu RegistroAlta with TipoFactura=R1, TipoRectificativa=I and FacturasRectificadas', async () => {
    const original = await fiscalizedOriginal();
    await createRectifyingInvoice(original, -2.42, 'Devolución parcial', 'R1');
    const queue = await (db as unknown as { verifactuQueue: { toArray(): Promise<Array<Record<string, unknown>>> } }).verifactuQueue.toArray();
    const entries = queue.filter((e) => e.kind === 'alta' && e.NumSerieFactura !== original.number);
    expect(entries.length).toBe(1);
    const e = entries[0] as Record<string, string>;
    expect(e['Huella']).toBeTruthy();
    // El XML del registro rectificativo lleva los campos propios.
    const xml = e['xml'] as string;
    expect(xml).toContain('<sum1:TipoFactura>R1</sum1:TipoFactura>');
    expect(xml).toContain('<sum1:TipoRectificativa>I</sum1:TipoRectificativa>');
    expect(xml).toContain(original.number);
    // Y la huella encadena con la factura anterior del SIF.
    const entry = queue.find((x) => x.NumSerieFactura === original.number) as Record<string, string>;
    expect(e['HuellaAnterior']).toBe(entry['Huella']);
  });

  it('keeps a monotonic counter in the rect series', async () => {
    const original = await fiscalizedOriginal();
    const r1 = await createRectifyingInvoice(original, -1, 'primera', 'R2');
    const r2 = await createRectifyingInvoice(original, -1, 'segunda', 'R1');
    expect(r2.number).not.toBe(r1.number);
    const s: Settings = await getSettings();
    expect(s.invoiceNextRectNumber).toBeGreaterThanOrEqual(2);
  });
});
