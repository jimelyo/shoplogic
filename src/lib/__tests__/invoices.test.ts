import { beforeEach, describe, expect, it } from 'vitest';
import { db, getSettings } from '../../db/database';
import { createInvoiceFromSale, nextInvoiceNumber, peekInvoiceNumber } from '../invoices';
import { formatInvoiceNumber } from '../calc';
import type { Sale, Settings } from '../../types';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
};

const settings = (patch: Partial<Settings> = {}): Settings => ({
  id: 1, invoicePrefix: 'F', invoiceDigits: 4, invoiceNumbering: 'year', invoiceYearReset: true,
  invoiceNextNumber: 1, invoiceLastYear: 2026, invoiceCustomFormat: '{PREFIX}/{YYYY}/{NUM}',
  ...patch,
} as Settings);

beforeEach(clearAll);

describe('peekInvoiceNumber', () => {
  it('shows the next number of the current year without touching settings', async () => {
    const s = settings({ invoiceNextNumber: 7 });
    expect(peekInvoiceNumber(s, new Date(2026, 4, 1))).toBe('F-2026-0007');
    expect(s.invoiceNextNumber).toBe(7);
  });

  it('restarts at 1 after a year change', () => {
    expect(peekInvoiceNumber(settings({ invoiceNextNumber: 7 }), new Date(2027, 0, 2))).toBe('F-2027-0001');
  });

  it('keeps counting when the yearly reset is disabled', () => {
    expect(peekInvoiceNumber(settings({ invoiceNextNumber: 7, invoiceYearReset: false }), new Date(2027, 0, 2)))
      .toBe('F-2027-0007');
  });
});

describe('nextInvoiceNumber', () => {
  it('allocates, persists and increments', async () => {
    const now = new Date(2026, 4, 1);
    const first = await nextInvoiceNumber(now);
    expect(first).toBe('F-2026-0001');
    expect((await getSettings()).invoiceNextNumber).toBe(2);

    expect(await nextInvoiceNumber(now)).toBe('F-2026-0002');
    expect((await getSettings()).invoiceNextNumber).toBe(3);
  });

  it('skips numbers already taken', async () => {
    const now = new Date(2026, 4, 1);
    const s = await getSettings();
    const taken = formatInvoiceNumber(s, 1, now);
    await db.invoices.add({
      number: taken, date: '2026-05-01', dueDate: '2026-06-01', customerName: 'Ana', customerDni: '',
      customerAddress: '', customerEmail: '', items: [], subtotal: 0, totalTax: 0, total: 0,
      paid: 0, status: 'paid', paymentMethod: 'cash', createdAt: now.toISOString(),
    });

    expect(await nextInvoiceNumber(now)).toBe('F-2026-0002');
  });
});

describe('createInvoiceFromSale', () => {
  const sale: Sale = {
    id: 55, ticketNumber: 'T-000042', date: new Date(2026, 4, 1, 12).toISOString(),
    items: [
      { productId: 1, name: 'Xiaomi 14 Pro', category: 'phones', quantity: 1, price: 899, cost: 620 },
      { productId: 2, name: 'Funda', category: 'accessories', quantity: 2, price: 19.99, cost: 4.5 },
    ],
    subtotal: 0, tax: 0, total: 938.98, paymentMethod: 'cash', customerName: 'Cliente mostrador',
  };

  it('builds a fully paid invoice linked to the sale', async () => {
    const inv = await createInvoiceFromSale(sale);

    expect(inv.number).toBe('F-2026-0001');
    expect(inv.saleId).toBe(55);
    expect(inv.customerName).toBe('Cliente mostrador');
    expect(inv.status).toBe('paid');
    expect(inv.paid).toBe(inv.total);
    expect(inv.notes).toContain('T-000042');
    expect(inv.items).toHaveLength(2);
    // Sale prices already include VAT: the invoice only separates base from tax.
    expect(inv.total).toBe(938.98);
    expect(inv.subtotal).toBe(776.02);
    expect(inv.totalTax).toBe(162.96);
    expect(await db.invoices.count()).toBe(1);
    expect((await getSettings()).invoiceNextNumber).toBe(2);
  });
});
