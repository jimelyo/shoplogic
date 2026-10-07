import { format } from 'date-fns';
import type { InvoiceItem, Settings } from '../types';

export const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const round4 = (n: number) => Math.round((n + Number.EPSILON) * 10000) / 10000;

/** Prices are VAT-included: Base = Total / (1 + VAT%), VAT = Total - Base */
export function splitVat(total: number, rate: number) {
  const base = round2(total / (1 + rate / 100));
  return { base, vat: round2(total - base), total: round2(total) };
}

/**
 * Cart-level discount for the POS: `percent` is a 0–100 % cut of the total,
 * `amount` a fixed sum. Non-finite or negative input counts as 0 and the result
 * never exceeds the total, so a sale can never go negative.
 */
export function discountAmount(total: number, value: number, mode: 'percent' | 'amount'): number {
  const v = Number.isFinite(value) ? value : 0;
  const raw = mode === 'percent' ? (total * Math.min(Math.max(v, 0), 100)) / 100 : v;
  return round2(Math.min(Math.max(raw, 0), Math.max(total, 0)));
}

/** Manual invoice line: price is WITHOUT VAT, total includes VAT */
export function lineTotal(quantity: number, price: number, taxRate: number) {
  return round2(quantity * price * (1 + taxRate / 100));
}
export function priceFromTotal(total: number, quantity: number, taxRate: number) {
  if (!quantity) return 0;
  return round4(total / quantity / (1 + taxRate / 100));
}
export function itemFromTotal(description: string, quantity: number, total: number, taxRate: number): InvoiceItem {
  return { description, quantity, price: priceFromTotal(total, quantity, taxRate), taxRate, total: round2(total) };
}

export function computeInvoiceTotals(items: InvoiceItem[]) {
  let subtotal = 0;
  let total = 0;
  for (const it of items) {
    const t = Number(it.total) || 0;
    total += t;
    subtotal += t / (1 + (Number(it.taxRate) || 0) / 100);
  }
  subtotal = round2(subtotal);
  total = round2(total);
  return { subtotal, totalTax: round2(total - subtotal), total };
}

export function formatInvoiceNumber(s: Pick<Settings, 'invoicePrefix' | 'invoiceDigits' | 'invoiceNumbering' | 'invoiceCustomFormat'>, n: number, date = new Date()): string {
  const num = String(n).padStart(Math.max(1, s.invoiceDigits || 4), '0');
  const p = s.invoicePrefix || '';
  switch (s.invoiceNumbering) {
    case 'sequential': return `${p}${num}`;
    case 'date': return `${p}-${format(date, 'yyyyMMdd')}-${num}`;
    case 'custom':
      return (s.invoiceCustomFormat || '{PREFIX}/{YYYY}/{NUM}')
        .replace('{PREFIX}', p).replace('{YYYY}', String(date.getFullYear()))
        .replace('{YY}', String(date.getFullYear()).slice(2)).replace('{MM}', format(date, 'MM')).replace('{NUM}', num);
    case 'year':
    default: return `${p}-${date.getFullYear()}-${num}`;
  }
}

export const pad = (n: number, d = 6) => String(n).padStart(d, '0');
export const isoDate = (d = new Date()) => format(d, 'yyyy-MM-dd');