/**
 * Trade-in (recompra) — el cliente vende un dispositivo al comercio.
 *
 * Flujo: se tasó el equipo (`quoteTradeIn`), se paga al cliente (`purchaseTradeIn`)
 * y el terminal entra al inventario con la regla de margen configurada
 * (`settings.tradeInMargin`, % sobre el precio de compra) generando un
 * StockMove de tipo `trade_in` con trazabilidad completa.
 */
import { db, getSettings } from '../db/database';
import { useStore } from '../store/store';
import { pad, round2 } from './calc';
import { makeMove } from './stock';
import { isoDate } from './calc';
import type { Product, TradeIn, TradeInCondition } from '../types';

const currentUserName = () => useStore.getState().currentUser?.name ?? 'Sistema';

/** Categoría de inventario donde se lista cada terminal recomprado. */
export const TRADE_IN_CATEGORY = 'tradein';

export async function nextTradeInNumber(): Promise<string> {
  const last = await db.tradeIns.orderBy('number').last();
  const n = last ? (parseInt(last.number.replace(/\D/g, ''), 10) || 0) + 1 : 1;
  return `TI-${pad(n)}`;
}

export interface QuoteTradeInInput {
  customerName: string;
  customerId?: number;
  device: string;
  imei?: string;
  condition: TradeInCondition;
  buyPrice: number;
  notes?: string;
}

/** Registra una tasación (status quoted). No mueve stock ni paga. */
export async function quoteTradeIn(input: QuoteTradeInInput): Promise<TradeIn> {
  const record: TradeIn = {
    number: await nextTradeInNumber(),
    date: new Date().toISOString(),
    status: 'quoted',
    customerName: input.customerName.trim(),
    customerId: input.customerId,
    device: input.device.trim(),
    imei: input.imei?.trim() || undefined,
    condition: input.condition,
    buyPrice: round2(input.buyPrice),
    notes: input.notes?.trim() || undefined,
    userName: currentUserName(),
    createdAt: new Date().toISOString(),
  };
  record.id = await db.tradeIns.add(record);
  return record;
}

/** Precio de reventa por defecto: compra × (1 + margen %). */
export function defaultListPrice(buyPrice: number, marginPct: number): number {
  return round2(buyPrice * (1 + Math.max(0, marginPct) / 100));
}

/**
 * Marca la tasación como comprada: el terminal se retira del cliente y se
 * paga (el desembolso en caja queda reflejado en el ajuste de la sesión).
 */
export async function purchaseTradeIn(id: number): Promise<TradeIn> {
  const ti = await db.tradeIns.get(id);
  if (!ti) throw new Error('validation.required');
  if (ti.status === 'listed') throw new Error('tradein.already_listed');
  await db.tradeIns.update(id, { status: 'purchased' });
  return { ...ti, status: 'purchased' };
}

/**
 * Lista el terminal recomprado en el inventario: crea (o reusa) un producto
 * con stock 1, coste = precio de compra y precio de reventa por la regla de
 * margen, y escribe el StockMove `trade_in` que sube el stock de 0 → 1.
 */
export async function listTradeIn(id: number, listPrice?: number): Promise<Product> {
  // `db.settings` entra en el scope transaccional: getSettings() lee ahí dentro.
  return db.transaction('rw', db.tradeIns, db.products, db.stockMoves, db.settings, async () => {
    const ti = await db.tradeIns.get(id);
    if (!ti) throw new Error('validation.required');
    if (ti.status === 'listed' || ti.status === 'cancelled') throw new Error('tradein.not_purchasable');
    if (ti.status === 'quoted') {
      // Listar implica comprar: el pago al cliente se asume hecho.
      await db.tradeIns.update(id, { status: 'purchased' });
    }
    const s = await getSettings();
    const price = round2(listPrice ?? defaultListPrice(ti.buyPrice, s.tradeInMargin));
    // ¿Ya existe un terminal con este IMEI en el inventario?
    const existing = ti.imei ? await db.products.where('imei').equals(ti.imei).first() : undefined;
    if (existing) throw new Error('tradein.imei_exists');

    const cats = s.categories ?? [];
    const category = cats.some((c) => c.id === TRADE_IN_CATEGORY) ? TRADE_IN_CATEGORY : (cats[0]?.id ?? 'phones');
    const product: Product = {
      name: `${ti.device} (2ª mano)`,
      category,
      barcode: `TI${pad(ti.id ?? 0)}`,
      imei: ti.imei,
      cost: ti.buyPrice,
      price,
      stock: 1,
      minStock: 0,
      description: ti.condition ? `${tCond(ti.condition)} · ${ti.number}` : ti.number,
      createdAt: new Date().toISOString(),
    };
    product.id = await db.products.add(product);
    await db.stockMoves.add(makeMove(product, 1, 'trade_in', { reference: ti.number, note: ti.customerName, before: 0 }));
    await db.tradeIns.update(id, { status: 'listed', productId: product.id, listPrice: price });
    return { ...product, id: product.id };
  });
}

function tCond(c: TradeInCondition): string {
  return { A: 'A · buen estado', B: 'B · con marcas visibles', C: 'C · piezas o averiado', spare: 'para piezas' }[c];
}

/** Cancela una tasación (antes de listar). Las ya listadas no se cancelan aquí. */
export async function cancelTradeIn(id: number): Promise<void> {
  const ti = await db.tradeIns.get(id);
  if (!ti) throw new Error('validation.required');
  if (ti.status === 'listed') throw new Error('tradein.already_listed');
  await db.tradeIns.update(id, { status: 'cancelled' });
}

export function tradeInLabel(t: (k: string, o?: Record<string, unknown>) => string, ti: TradeIn, date = isoDate(new Date())): string {
  return `${ti.number} · ${ti.device} · ${t('common.date')}: ${date}`;
}
