import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '../../db/database';
import { makeMove, nextPurchaseOrderNumber, purchaseOrderTotal, purchasePending, receivePurchaseOrder, setStock } from '../stock';
import type { Product } from '../../types';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
};

const addProduct = (patch: Partial<Product> = {}): Promise<number> =>
  db.products.add({
    name: 'Xiaomi 14 Pro', category: 'phones', barcode: '8400000000035',
    cost: 620, price: 899, stock: 3, minStock: 1, createdAt: new Date().toISOString(), ...patch,
  });

beforeEach(clearAll);

describe('makeMove', () => {
  it('records before/after levels and the signed quantity', () => {
    const product = { id: 7, name: 'Pantalla', category: 'parts', barcode: '', cost: 85, price: 189, stock: 5, minStock: 2, createdAt: '' } as Product;
    expect(makeMove(product, -2, 'sale', { reference: 'T-000001', timestamp: '2026-10-06T10:00:00.000Z' })).toMatchObject({
      productId: 7, productName: 'Pantalla', type: 'sale', qty: -2, stockBefore: 5, stockAfter: 3, reference: 'T-000001',
    });
  });

  it('accepts a starting level override for creations', () => {
    const product = { id: 1, name: 'Nuevo', category: 'phones', barcode: '', cost: 1, price: 2, stock: 4, minStock: 0, createdAt: '' } as Product;
    expect(makeMove(product, 4, 'create', { before: 0 })).toMatchObject({ stockBefore: 0, stockAfter: 4 });
  });
});

describe('purchase order helpers', () => {
  it('totals and pending quantities', () => {
    const items = [
      { productId: 1, name: 'a', quantity: 10, quantityReceived: 4, cost: 2 },
      { productId: 2, name: 'b', quantity: 5, quantityReceived: 5, cost: 3.5 },
    ];
    expect(purchaseOrderTotal(items)).toBe(37.5);
    expect(purchasePending(items[0])).toBe(6);
    expect(purchasePending(items[1])).toBe(0);
  });

  it('numbers orders sequentially', async () => {
    expect(await nextPurchaseOrderNumber()).toBe('PO-000001');
    await db.purchaseOrders.add({ number: 'PO-000001', providerName: 'P', status: 'received', date: '2026-10-01', items: [], total: 0, createdAt: '' });
    expect(await nextPurchaseOrderNumber()).toBe('PO-000002');
  });
});

describe('receivePurchaseOrder', () => {
  const seed = async () => {
    const productId = await addProduct({ stock: 3 });
    const orderId = await db.purchaseOrders.add({
      number: 'PO-000001', providerName: 'TechDistribuciones', status: 'sent', date: '2026-10-06',
      items: [{ productId, name: 'Xiaomi 14 Pro', quantity: 10, quantityReceived: 0, cost: 620 }],
      total: 6200, createdAt: new Date().toISOString(),
    });
    return { productId, orderId };
  };

  it('receives part of an order and leaves it partial', async () => {
    const { productId, orderId } = await seed();
    const order = await receivePurchaseOrder(orderId, { [productId]: 4 });

    expect(order.status).toBe('partial');
    expect(order.items[0].quantityReceived).toBe(4);
    expect((await db.products.get(productId))!.stock).toBe(7);

    const moves = await db.stockMoves.toArray();
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: 'purchase', qty: 4, stockBefore: 3, stockAfter: 7, reference: 'PO-000001' });
  });

  it('completes the order and stamps receivedAt', async () => {
    const { productId, orderId } = await seed();
    await receivePurchaseOrder(orderId, { [productId]: 4 });
    const order = await receivePurchaseOrder(orderId, { [productId]: 999 });

    expect(order.status).toBe('received');
    expect(order.receivedAt).toBeTruthy();
    expect(order.items[0].quantityReceived).toBe(10);
    expect((await db.products.get(productId))!.stock).toBe(13);
    expect(await db.stockMoves.count()).toBe(2);
  });

  it('is idempotent once the order is closed', async () => {
    const { productId, orderId } = await seed();
    await receivePurchaseOrder(orderId);
    await receivePurchaseOrder(orderId);

    expect((await db.products.get(productId))!.stock).toBe(13);
    expect(await db.stockMoves.count()).toBe(1);
  });

  it('ignores cancelled orders', async () => {
    const { productId, orderId } = await seed();
    await db.purchaseOrders.update(orderId, { status: 'cancelled' });
    await receivePurchaseOrder(orderId);

    expect((await db.products.get(productId))!.stock).toBe(3);
    expect(await db.stockMoves.count()).toBe(0);
  });
});

describe('setStock', () => {
  it('adjusts the level and writes a ledger entry', async () => {
    const productId = await addProduct({ stock: 3 });
    const product = (await db.products.get(productId))!;
    await setStock(product, 5);

    expect((await db.products.get(productId))!.stock).toBe(5);
    const moves = await db.stockMoves.toArray();
    expect(moves).toHaveLength(1);
    expect(moves[0]).toMatchObject({ type: 'adjustment', qty: 2, stockBefore: 3, stockAfter: 5 });
  });

  it('writes nothing when the level does not change', async () => {
    const productId = await addProduct({ stock: 3 });
    await setStock((await db.products.get(productId))!, 3);

    expect(await db.stockMoves.count()).toBe(0);
  });

  it('records negative adjustments too', async () => {
    const productId = await addProduct({ stock: 3 });
    await setStock((await db.products.get(productId))!, 1, 'Merma');

    expect(await db.stockMoves.toArray()).toMatchObject([{ type: 'adjustment', qty: -2, note: 'Merma' }]);
  });
});
