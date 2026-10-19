/**
 * Informes fiscales de España derivados de los datos del ERP:
 *
 *  - Modelo 303 (declaración-liquidación de IVA): casillas de IVA devengado
 *    (facturas emitidas no anuladas del periodo, incluyendo rectificativas
 *    por diferencias con su signo negativo) e IVA soportado (compras
 *    recibidas y gastos), por tipo de interés. El resultado es estimado:
 *    el IVA soportado se calcula aplicando el tipo general del comercio
 *    porque `PurchaseOrderItem` y `Expense` no almacenan el desglose de IVA.
 *
 *  - Modelo 347: operaciones anuales ≥ 3005,05 € con terceros (clientes por
 *    DNI/NIF y proveedores por CIF), con desglose trimestral.
 *
 * Fuentes: RIVA (RD 1624/1992) e instrucciones de la AEAT para cada modelo;
 * Veri*factu (RD 1007/2023) aporta la trazabilidad de las facturas ya en cadena.
 */
import { db } from '../db/database';
import { round2 } from './calc';
import type { Expense, Invoice, PurchaseOrder } from '../types';

export const MODELO_347_THRESHOLD = 3005.05;
export const QUARTERS = [1, 2, 3, 4] as const;
export type Quarter = (typeof QUARTERS)[number];

const rateFromTotal = (total: number, rate: number) => {
  const base = rate > 0 ? total / (1 + rate / 100) : total;
  return { base: round2(base), quota: round2(total - base) };
};

export interface VatRateLine { rate: number; base: number; quota: number }

export interface Vat303 {
  /** start/end isodate inclusive of the period. */
  start: string;
  end: string;
  /** Devengado (emitidas, excluidas anuladas), por tipo. */
  accrued: VatRateLine[];
  /** Soportado estimado (compras recibidas + gastos), por tipo. */
  supported: VatRateLine[];
  totalAccrued: number;
  totalSupported: number;
  /** Resultado: devengado − soportado (positivo = a ingresar). */
  result: number;
  invoiceCount: number;
}

/** Rango isodate de un trimestre (inclusive). */
export function quarterRange(year: number, q: Quarter): { start: string; end: string } {
  const startMonth = (q - 1) * 3;
  const start = new Date(Date.UTC(year, startMonth, 1));
  const end = new Date(Date.UTC(year, startMonth + 3, 0, 23, 59, 59));
  return { start: isoDateOf(start), end: isoDateOf(end) };
}
const isoDateOf = (d: Date) => d.toISOString().slice(0, 10);
const inRange = (d: string, start: string, end: string) => d >= start && d <= end /** isodate strings */;

function addRateLine(lines: Map<number, VatRateLine>, rate: number, base: number, quota: number) {
  const cur = lines.get(rate) ?? { rate, base: 0, quota: 0 };
  cur.base = round2(cur.base + base);
  cur.quota = round2(cur.quota + quota);
  lines.set(rate, cur);
}

export function build303(
  year: number,
  q: Quarter,
  invoices: Invoice[],
  purchases: PurchaseOrder[],
  expenses: Expense[],
  taxRate: number,
): Vat303 {
  const { start, end } = quarterRange(year, q);
  const accrued = new Map<number, VatRateLine>();
  // Devengado: facturas por fecha de expedición; incluyen las rectificativas
  // de la serie R (delta negativo por diferencias) y excluyen las anuladas.
  let invoiceCount = 0;
  for (const inv of invoices) {
    if (inv.status === 'cancelled' || inv.status === 'draft') continue;
    if (!inRange(inv.date, start, end)) continue;
    invoiceCount++;
    for (const it of inv.items) {
      const { base, quota } = rateFromTotal(it.total, it.taxRate);
      addRateLine(accrued, it.taxRate, base, quota);
    }
  }
  // Soportado: compras recibidas del periodo (base sin IVA × tipo) y gastos
  // del periodo (estimados también con el tipo general → marcado como tal).
  const supported = new Map<number, VatRateLine>();
  for (const po of purchases) {
    if (po.status === 'draft' || po.status === 'cancelled' || po.status === 'sent') continue;
    const d = (po.receivedAt ?? po.date).slice(0, 10);
    if (!inRange(d, start, end)) continue;
    const base = round2(po.items.reduce((a, i) => a + i.cost * i.quantityReceived, 0));
    const quota = round2(base * (taxRate / 100));
    addRateLine(supported, taxRate, base, quota);
  }
  for (const ex of expenses) {
    if (!inRange(ex.date, start, end)) continue;
    const { base, quota } = rateFromTotal(ex.amount, taxRate);
    addRateLine(supported, taxRate, base, quota);
  }
  const totalAccrued = round2([...accrued.values()].reduce((a, l) => a + l.quota, 0));
  const totalSupported = round2([...supported.values()].reduce((a, l) => a + l.quota, 0));
  return {
    start, end,
    accrued: [...accrued.values()].sort((a, b) => a.rate - b.rate),
    supported: [...supported.values()].sort((a, b) => a.rate - b.rate),
    totalAccrued, totalSupported,
    result: round2(totalAccrued - totalSupported),
    invoiceCount,
  };
}

export interface Partner347 {
  /** NIF/CIF del tercero (o '—' si el registro no lo trae). */
  nif: string;
  name: string;
  /** Venta (clients) o compra (providers). */
  kind: 'client' | 'provider';
  total: number;
  /** Importe por trimestre del año natural. */
  quarters: [number, number, number, number];
}

export function build347(
  year: number,
  invoices: Invoice[],
  purchases: PurchaseOrder[],
  taxRate: number,
): { clients: Partner347[]; providers: Partner347[] } {
  const clients = new Map<string, Partner347>();
  for (const inv of invoices) {
    if (inv.status === 'cancelled') continue;
    if (inv.date.slice(0, 4) !== String(year)) continue;
    // Las rectificativas por diferencias se suman con su signo (bajan el volumen).
    const key = (inv.customerDni || inv.customerName || '—').toUpperCase();
    const cur = clients.get(key) ?? {
      nif: inv.customerDni || '—', name: inv.customerName, kind: 'client', total: 0,
      quarters: [0, 0, 0, 0] as [number, number, number, number],
    };
    const qIdx = Math.min(3, Math.max(0, (Number(inv.date.slice(5, 7)) - 1) / 3 | 0));
    cur.total = round2(cur.total + inv.total);
    cur.quarters[qIdx] = round2(cur.quarters[qIdx] + inv.total);
    clients.set(key, cur);
  }
  const providers = new Map<string, Partner347>();
  for (const po of purchases) {
    if (po.status === 'draft' || po.status === 'cancelled') continue;
    if (po.date.slice(0, 4) !== String(year)) continue;
    const key = (po.providerName || '—').toUpperCase();
    const cur = providers.get(key) ?? {
      nif: '—', name: po.providerName, kind: 'provider', total: 0,
      quarters: [0, 0, 0, 0] as [number, number, number, number],
    };
    const base = round2(po.items.reduce((a, i) => a + i.cost * i.quantity, 0) * (1 + taxRate / 100));
    const qIdx = Math.min(3, Math.max(0, (Number(po.date.slice(5, 7)) - 1) / 3 | 0));
    cur.total = round2(cur.total + base);
    cur.quarters[qIdx] = round2(cur.quarters[qIdx] + base);
    providers.set(key, cur);
  }
  const filter = (m: Map<string, Partner347>) => [...m.values()].filter((p) => p.total >= MODELO_347_THRESHOLD).sort((a, b) => b.total - a.total);
  return { clients: filter(clients), providers: filter(providers) };
}
