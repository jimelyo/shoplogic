import { describe, expect, it } from 'vitest';
import { build303, build347, MODELO_347_THRESHOLD, quarterRange } from '../fiscal-reports';
import type { Expense, Invoice, InvoiceItem, PurchaseOrder } from '../../types';

const item = (total: number, taxRate = 21): InvoiceItem => ({ description: 'x', quantity: 1, price: Math.round((total / 1.21) * 100) / 100, taxRate, total });

const inv = (patch: Partial<Invoice> = {}): Invoice => ({
  id: 1, number: 'F-2026-0001', date: '2026-04-10', dueDate: '2026-05-10', customerName: 'Ana', customerDni: '12345678A',
  customerAddress: '', customerEmail: '', items: [item(121)], subtotal: 100, totalTax: 21, total: 121,
  paid: 121, status: 'paid', paymentMethod: 'cash', createdAt: '2026-04-10T10:00:00.000Z',
  ...patch,
});

const po = (patch: Partial<PurchaseOrder>): PurchaseOrder => ({
  id: 1, number: 'PO-000001', providerName: 'TechDistribuciones S.L.', status: 'received', date: '2026-04-02',
  items: [{ productId: 1, name: 'Pantalla', quantity: 2, quantityReceived: 2, cost: 50 }], total: 100, createdAt: '2026-04-02T10:00:00.000Z',
  ...patch,
});

describe('quarterRange', () => {
  it('covers the three months of the quarter inclusive', () => {
    const r = quarterRange(2026, 2);
    expect(r.start).toBe('2026-04-01');
    expect(r.end).toBe('2026-06-30');
  });
});

describe('build303', () => {
  it('computes accrued VAT from invoices of the quarter and excludes cancelled/draft/other quarters', () => {
    const invoices = [
      inv({}),                                                 // Q2 2026 → 121 (21 %)
      inv({ id: 2, number: 'F-2026-0002', date: '2026-07-01' }), // Q3 → fuera
      inv({ id: 3, number: 'F-2026-0003', date: '2026-05-01', status: 'cancelled' }), // anulada → fuera
      inv({ id: 4, number: 'F-2026-0004', date: '2026-05-02', status: 'draft' }), // borrador → fuera
    ];
    const r = build303(2026, 2, invoices, [], [], 21);
    expect(r.totalAccrued).toBe(21);
    expect(r.accrued[0]).toEqual({ rate: 21, base: 100, quota: 21 });
    expect(r.invoiceCount).toBe(1);
  });

  it('subtracts rectificativas by differences (negative delta) from the accrued VAT', () => {
    const invoices = [
      inv({}),                                                  // +121
      inv({ id: 2, number: 'R2026-0001', date: '2026-05-12', items: [item(-42.35)], total: -42.35, subtotal: -35, totalTax: -7.35, rectifies: 1, rectCode: 'R1', rectMethod: 'I' }),
    ];
    const r = build303(2026, 2, invoices, [], [], 21);
    // Devengado neto: 21 − 7.35 = 13.65
    expect(r.totalAccrued).toBeCloseTo(13.65, 2);
    expect(r.supported.length).toBe(0);
    expect(r.result).toBeCloseTo(13.65, 2);
  });

  it('computes supported VAT from received purchase orders and carries the quarter result', () => {
    const expenses: Expense[] = [{ id: 1, date: '2026-05-03', category: 'rent', description: 'Alquiler', amount: 204.4, createdAt: '2026-05-03T10:00:00.000Z' }];
    const r = build303(2026, 2, [inv()], [po({ items: [{ productId: 1, name: 'Pantalla', quantity: 2, quantityReceived: 2, cost: 50 }] })], expenses, 21);
    // Soportado estimado: compras con base sin IVA 100 × 21 % = 21; los gastos
    // se tratan como importe con IVA incluido (168.93 base + 35.47 cuota).
    expect(r.totalSupported).toBeCloseTo(21 + 35.47, 2);
    expect(r.result).toBeCloseTo(r.totalAccrued - r.totalSupported, 2);
  });
});

describe('build347', () => {
  it('groups clients by NIF with quarterly breakdown over the 3005.05 € threshold', () => {
    const invoices = [
      inv({ date: '2026-01-15' }),                                               // Ana 121 (T1)
      inv({ id: 2, number: 'F-2026-0002', date: '2026-06-15', total: 5000, items: [item(5000)], subtotal: Math.round(5000 / 1.21 * 100) / 100, totalTax: Math.round((5000 - 5000 / 1.21) * 100) / 100 }), // Ana T2
      inv({ id: 3, number: 'F-2026-0003', date: '2026-07-01', customerName: 'Luis', customerDni: '87654321B', total: 1000, items: [item(1000)], subtotal: Math.round(1000 / 1.21 * 100) / 100, totalTax: Math.round((1000 - 1000 / 1.21) * 100) / 100 }), // Luis bajo el umbral
    ];
    const r = build347(2026, invoices, [po({ total: 4000, items: [{ productId: 1, name: 'x', quantity: 8, quantityReceived: 8, cost: 500 }] })], 21);
    expect(r.clients.length).toBe(1);
    expect(r.clients[0].nif).toBe('12345678A');
    expect(r.clients[0].name).toBe('Ana');
    expect(r.clients[0].total).toBeCloseTo(5121, 2);
    expect(r.clients[0].quarters[0]).toBeCloseTo(121, 2); // factura base del T1
    expect(r.clients[0].quarters[1]).toBeCloseTo(5000, 2);
    // Luis queda excluido por el umbral.
    expect(r.clients.some((c) => c.nif === '87654321B')).toBe(false);
    // Proveedor recibido en el año: 800 base × 1.21 = 968 + margen estimado.
    expect(r.providers.length).toBe(1);
    expect(MODELO_347_THRESHOLD).toBe(3005.05);
  });

  it('nets rectificativas against the yearly volume and ignores other years', () => {
    const invoices = [
      inv({}),                                                                  // +121
      inv({ id: 2, number: 'R2026-0001', date: '2026-05-12', items: [item(-121)], total: -121, subtotal: -100, totalTax: -21, rectifies: 1, rectCode: 'R1', rectMethod: 'I' }),
      inv({ id: 3, number: 'F-2025-0009', date: '2025-12-01', total: 9999, subtotal: 8262.02, totalTax: 1737, items: [item(9999)] }),
    ];
    const r = build347(2026, invoices, [], 21);
    expect(r.clients.length).toBe(0); // Ana queda en 0 y por debajo del umbral
    void invoices[2];
  });
});
