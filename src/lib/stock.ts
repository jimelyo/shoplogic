import { db } from '../db/database';
import { useStore } from '../store/store';
import { pad, round2 } from './calc';
import type { Product, PurchaseOrder, StockMove, StockMoveType } from '../types';

const currentUserName = () => useStore.getState().currentUser?.name ?? 'Sistema';

/**
 * Builds the ledger entry that a stock change of `delta` produces. Does not persist it.
 * `before` overrides the starting level for movements that do not start from the
 * product's current stock (e.g. a product being created starts at zero).
 */
export function makeMove(product: Product, delta: number, type: StockMoveType, opts: { reference?: string; note?: string; timestamp?: string; before?: number } = {}): StockMove {
  const before = opts.before ?? product.stock;
  return {
    productId: product.id!,
    productName: product.name,
    type,
    qty: delta,
    stockBefore: before,
    stockAfter: before + delta,
    reference: opts.reference,
    note: opts.note,
    userName: currentUserName(),
    timestamp: opts.timestamp ?? new Date().toISOString(),
  };
}

export async function recordMove(move: StockMove): Promise<void> {
  await db.stockMoves.add(move);
}

/** Next sequential purchase-order number, e.g. `PO-000004`. */
export async function nextPurchaseOrderNumber(): Promise<string> {
  const last = await db.purchaseOrders.orderBy('number').last();
  const n = last ? (parseInt(last.number.replace(/\D/g, ''), 10) || 0) + 1 : 1;
  return `PO-${pad(n)}`;
}

export const purchaseOrderTotal = (items: Pick<PurchaseOrder, 'items'>['items']) =>
  round2(items.reduce((a, i) => a + i.quantity * i.cost, 0));

/** Quantity still to be received on a purchase-order line. */
export const purchasePending = (item: { quantity: number; quantityReceived: number }) =>
  Math.max(0, item.quantity - item.quantityReceived);

/**
 * Receives pending quantities of a purchase order: raises each product's stock,
 * writes a `purchase` ledger entry per line and closes the order (or leaves it
 * `partial` when only part of the lines arrived).
 */
export async function receivePurchaseOrder(orderId: number, receivedQty?: Record<number, number>): Promise<PurchaseOrder> {
  return db.transaction('rw', db.purchaseOrders, db.products, db.stockMoves, async () => {
    const order = await db.purchaseOrders.get(orderId);
    if (!order) throw new Error('validation.required');
    if (order.status === 'received' || order.status === 'cancelled') return order;

    const lines = order.items.map((it) => {
      const pending = purchasePending(it);
      const requested = receivedQty?.[it.productId];
      const incoming = Math.max(0, Math.min(pending, requested === undefined ? pending : requested));
      return { item: it, incoming };
    });

    for (const { item, incoming } of lines) {
      if (incoming <= 0) continue;
      const product = await db.products.get(item.productId);
      if (!product) continue;
      await db.products.update(product.id!, { stock: product.stock + incoming });
      await db.stockMoves.add(makeMove(product, incoming, 'purchase', { reference: order.number, note: order.providerName }));
    }

    const items = lines.map(({ item, incoming }) => ({
      productId: item.productId, name: item.name, quantity: item.quantity,
      quantityReceived: item.quantityReceived + incoming, cost: item.cost,
    }));
    const complete = items.every((it) => it.quantityReceived >= it.quantity);
    const anyReceived = items.some((it) => it.quantityReceived > 0);
    const patch: Partial<PurchaseOrder> = { items };
    if (complete) { patch.status = 'received'; patch.receivedAt = new Date().toISOString(); }
    else if (anyReceived) patch.status = 'partial';
    await db.purchaseOrders.update(orderId, patch);
    return { ...order, ...patch };
  });
}

/** Moves a product to an exact stock level, recording the difference in the ledger. */
export async function setStock(product: Product, newStock: number, note?: string): Promise<void> {
  const delta = round2(newStock - product.stock);
  if (!delta) return;
  await db.transaction('rw', db.products, db.stockMoves, async () => {
    await db.products.update(product.id!, { stock: newStock });
    await db.stockMoves.add(makeMove(product, delta, 'adjustment', { note }));
  });
}
