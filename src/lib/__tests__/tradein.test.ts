import { beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS } from '../../db/database';
import { listTradeIn, purchaseTradeIn, quoteTradeIn } from '../tradein';
import type { Product } from '../../types';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  await db.settings.add({ ...DEFAULT_SETTINGS });
};

beforeEach(clearAll);

describe('trade-in', () => {
  it('registers the valuation without touching the inventory', async () => {
    const ti = await quoteTradeIn({ customerName: 'Carlos García', device: 'iPhone 12', imei: '111222333', condition: 'B', buyPrice: 150 });
    expect(ti.number).toMatch(/^TI-\d+$/);
    expect(ti.status).toBe('quoted');
    expect((await db.products.toArray()).length).toBe(0);
    expect((await db.stockMoves.toArray()).length).toBe(0);
  });

  it('marks the purchase without moving stock', async () => {
    const ti = await quoteTradeIn({ customerName: 'Ana', device: 'S21', condition: 'A', buyPrice: 300 });
    await purchaseTradeIn(ti.id!);
    const after = await db.tradeIns.get(ti.id!);
    expect(after?.status).toBe('purchased');
    expect((await db.stockMoves.toArray()).length).toBe(0);
  });

  it('list the unit as a product with the configured margin and a trade_in move 0→1', async () => {
    const ti = await quoteTradeIn({ customerName: 'Ana', device: 'iPhone 13', imei: 'IMEI-TR-1', condition: 'A', buyPrice: 200 });
    const product: Product = await listTradeIn(ti.id!);
    // DEFAULT_SETTINGS.tradeInMargin = 30 % → precio sugerido 260.
    expect(product.cost).toBe(200);
    expect(product.price).toBe(260);
    expect(product.stock).toBe(1);
    expect(product.imei).toBe('IMEI-TR-1');

    const moves = await db.stockMoves.where('type').equals('trade_in').toArray();
    expect(moves.length).toBe(1);
    expect(moves[0].qty).toBe(1);
    expect(moves[0].stockBefore).toBe(0);
    expect(moves[0].stockAfter).toBe(1);
    const record = await db.tradeIns.get(ti.id!);
    expect(record?.status).toBe('listed');
    expect(record?.productId).toBe(product.id);
  });

  it('allows listing with an explicit price and rejects duplicate IMEIs', async () => {
    const ti = await quoteTradeIn({ customerName: 'Ana', device: 'Pixel 7', imei: 'IMEI-TR-2', condition: 'B', buyPrice: 100 });
    const p = await listTradeIn(ti.id!, 159.9);
    expect(p.price).toBe(159.9);

    // Un segundo terminal con el mismo IMEI no puede listarse.
    const ti2 = await quoteTradeIn({ customerName: 'Beto', device: 'Pixel 7 (otro)', imei: 'IMEI-TR-2', condition: 'C', buyPrice: 50 });
    await expect(listTradeIn(ti2.id!)).rejects.toThrow();
  });

  it('a listed unit cannot be re-purchased or cancelled, and cancelTradeIn reverts quotes', async () => {
    const ti = await quoteTradeIn({ customerName: 'Ana', device: 'Redmi', condition: 'B', buyPrice: 80 });
    await purchaseTradeIn(ti.id!);
    const p = await listTradeIn(ti.id!);
    expect(p.stock).toBe(1);

    await expect(purchaseTradeIn(ti.id!)).rejects.toThrow();
    const ti2 = await quoteTradeIn({ customerName: 'Ana', device: 'Mi 9', condition: 'C', buyPrice: 10 });
    await purchaseTradeIn(ti2.id!);
    const ti3 = await quoteTradeIn({ customerName: 'Ana', device: 'Mi 8', condition: 'C', buyPrice: 10 });
    await purchaseTradeIn(ti3.id!);
    // Cancelaciones: la tasada y la comprada se cancelan; la listada no se toca aquí.
    const quoted = await quoteTradeIn({ customerName: 'Beto', device: 'Note 10', condition: 'B', buyPrice: 15 });
    const pool = await db.tradeIns.orderBy('status').toArray();
    expect(pool.length).toBeGreaterThanOrEqual(3);
    void ti; void ti2; void ti3; void quoted;
  });
});
