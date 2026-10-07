import { describe, expect, it } from 'vitest';
import { computeInvoiceTotals, discountAmount, formatInvoiceNumber, isoDate, itemFromTotal, lineTotal, pad, priceFromTotal, round2, round4, splitVat } from '../calc';

describe('round2 / round4', () => {
  it('rounds without float noise', () => {
    expect(round2(10 / 3)).toBe(3.33);
    expect(round2(0.1 + 0.2)).toBe(0.3);
    expect(round2(121.5)).toBe(121.5);
    expect(round4(1 / 3)).toBe(0.3333);
  });
});

describe('splitVat', () => {
  it('splits a VAT-included total', () => {
    expect(splitVat(121, 21)).toEqual({ base: 100, vat: 21, total: 121 });
    expect(splitVat(45, 21)).toEqual({ base: 37.19, vat: 7.81, total: 45 });
  });

  it('never loses cents between base and VAT', () => {
    for (const total of [9.99, 19.99, 59, 899, 1469, 0.01]) {
      const v = splitVat(total, 21);
      expect(round2(v.base + v.vat)).toBe(round2(total));
    }
  });

  it('handles a zero rate', () => {
    expect(splitVat(50, 0)).toEqual({ base: 50, vat: 0, total: 50 });
  });
});

describe('lineTotal / priceFromTotal / itemFromTotal', () => {
  it('adds VAT to a net line', () => {
    expect(lineTotal(2, 100, 21)).toBe(242);
    expect(lineTotal(1, 19.99, 21)).toBe(24.19);
  });

  it('recovers the net price (round trip)', () => {
    expect(priceFromTotal(242, 2, 21)).toBe(100);
    expect(priceFromTotal(100, 0, 21)).toBe(0);
  });

  it('builds an invoice item keeping the given total', () => {
    expect(itemFromTotal('Pantalla', 2, 242, 21)).toEqual({
      description: 'Pantalla', quantity: 2, price: 100, taxRate: 21, total: 242,
    });
  });
});

describe('computeInvoiceTotals', () => {
  it('sums totals and strips VAT from the subtotal', () => {
    expect(computeInvoiceTotals([
      { description: 'a', quantity: 1, price: 100, taxRate: 21, total: 121 },
      { description: 'b', quantity: 2, price: 100, taxRate: 21, total: 242 },
    ])).toEqual({ subtotal: 300, totalTax: 63, total: 363 });
  });

  it('ignores invalid numbers instead of producing NaN', () => {
    const bad = { description: 'x', quantity: 1, price: 0, taxRate: 21, total: Number.NaN as unknown as number };
    expect(computeInvoiceTotals([bad])).toEqual({ subtotal: 0, totalTax: 0, total: 0 });
  });
});

describe('discountAmount', () => {
  it('cuts a percentage of the total', () => {
    expect(discountAmount(100, 10, 'percent')).toBe(10);
    expect(discountAmount(19.99, 15, 'percent')).toBe(3);
    expect(discountAmount(45, 0, 'percent')).toBe(0);
  });

  it('cuts a fixed amount', () => {
    expect(discountAmount(59, 5, 'amount')).toBe(5);
    expect(discountAmount(9.99, 0.5, 'amount')).toBe(0.5);
  });

  it('never exceeds the total nor goes negative', () => {
    expect(discountAmount(100, 150, 'percent')).toBe(100);
    expect(discountAmount(100, 250, 'amount')).toBe(100);
    expect(discountAmount(100, -20, 'amount')).toBe(0);
    expect(discountAmount(100, -5, 'percent')).toBe(0);
    expect(discountAmount(0, 50, 'amount')).toBe(0);
  });

  it('treats invalid input as no discount', () => {
    expect(discountAmount(100, Number.NaN, 'percent')).toBe(0);
    expect(discountAmount(100, Number.NaN, 'amount')).toBe(0);
  });
});

describe('formatInvoiceNumber', () => {
  const date = new Date(2026, 9, 6); // 6 October 2026
  const base = { invoicePrefix: 'F', invoiceDigits: 4, invoiceCustomFormat: '{PREFIX}/{YYYY}/{NUM}' };

  it('sequential mode', () => {
    expect(formatInvoiceNumber({ ...base, invoiceNumbering: 'sequential' }, 7, date)).toBe('F0007');
  });
  it('date mode', () => {
    expect(formatInvoiceNumber({ ...base, invoiceNumbering: 'date' }, 7, date)).toBe('F-20261006-0007');
  });
  it('year mode (default)', () => {
    expect(formatInvoiceNumber({ ...base, invoiceNumbering: 'year' }, 7, date)).toBe('F-2026-0007');
  });
  it('custom mode honours every placeholder', () => {
    expect(formatInvoiceNumber({ ...base, invoiceNumbering: 'custom' }, 7, date)).toBe('F/2026/0007');
    expect(formatInvoiceNumber(
      { ...base, invoiceNumbering: 'custom', invoiceCustomFormat: '{PREFIX}-{YY}-{MM}-{NUM}' }, 7, date,
    )).toBe('F-26-10-0007');
  });
  it('pads to the configured number of digits', () => {
    expect(formatInvoiceNumber({ ...base, invoiceDigits: 6, invoiceNumbering: 'sequential' }, 7, date)).toBe('F000007');
  });
});

describe('pad / isoDate', () => {
  it('pads to six digits by default', () => {
    expect(pad(7)).toBe('000007');
    expect(pad(7, 3)).toBe('007');
  });
  it('formats a date as yyyy-MM-dd', () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
