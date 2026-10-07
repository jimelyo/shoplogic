import { db, getSettings } from '../db/database';
import { useStore } from '../store/store';
import { round2 } from './calc';
import { makeMove } from './stock';
import type { ReturnItem, Sale, SaleReturn } from '../types';

const nowIso = () => new Date().toISOString();
const currentUserName = () => useStore.getState().currentUser?.name ?? 'Sistema';

export interface RefundLine { productId: number; quantity: number }

/** Units of a product already refunded on this sale. */
export async function alreadyReturned(saleId: number): Promise<Record<number, number>> {
  const rows = await db.returns.where('saleId').equals(saleId).toArray();
  const out: Record<number, number> = {};
  for (const r of rows) for (const it of r.items) out[it.productId] = (out[it.productId] ?? 0) + it.quantity;
  return out;
}

/** Units of a product still refundable on this sale. */
export async function refundable(sale: Sale): Promise<Record<number, number>> {
  const returned = sale.id ? await alreadyReturned(sale.id) : {};
  const out: Record<number, number> = {};
  for (const it of sale.items) out[it.productId] = it.quantity - (returned[it.productId] ?? 0);
  return out;
}

/**
 * Refunds lines of a sale in one transaction: stock comes back (with a `return`
 * ledger entry), loyalty points and lifetime spend are reversed, and the invoice
 * linked to the ticket is cancelled when everything was given back.
 */
export async function createReturn(
  sale: Sale, lines: RefundLine[], reason?: string,
): Promise<SaleReturn> {
  const quantities = lines.filter((l) => l.quantity > 0);
  if (!quantities.length) throw new Error('validation.minItems');

  return db.transaction(
    'rw', [db.products, db.stockMoves, db.customers, db.returns, db.invoices, db.sales],
    async () => {
      const stillRefundable = await refundable(sale);
      const items: ReturnItem[] = [];
      for (const line of quantities) {
        const sold = sale.items.find((i) => i.productId === line.productId);
        const allowed = stillRefundable[line.productId] ?? 0;
        if (!sold || line.quantity > allowed) throw new Error('returns.max');

        const product = await db.products.get(line.productId);
        items.push({
          productId: line.productId, name: sold.name, quantity: line.quantity,
          price: sold.price, cost: sold.cost,
        });
        if (product) {
          await db.products.update(product.id!, { stock: product.stock + line.quantity });
          await db.stockMoves.add(makeMove(product, line.quantity, 'return', {
            reference: sale.ticketNumber, note: reason || undefined, timestamp: nowIso(),
          }));
        }
      }

      const total = round2(items.reduce((a, i) => a + i.price * i.quantity, 0));
      const record: SaleReturn = {
        saleId: sale.id, ticketNumber: sale.ticketNumber, date: nowIso(), items, total,
        reason: reason?.trim() || undefined, restocked: true, userName: currentUserName(), createdAt: nowIso(),
      };
      record.id = await db.returns.add(record);

      if (sale.customerId) {
        const customer = await db.customers.get(sale.customerId);
        if (customer) {
          const settings = await getSettings();
          const rate = settings.loyaltyRate || 10;
          const refund = sale.id ? await db.returns.where('saleId').equals(sale.id).toArray() : [record];
          const refunded = round2(refund.reduce((a, r) => a + r.total, 0));
          const points = Math.min(customer.loyaltyPoints ?? 0, Math.floor(refunded / rate));
          await db.customers.update(customer.id!, {
            totalSpent: round2(Math.max(0, customer.totalSpent - total)),
            loyaltyPoints: (customer.loyaltyPoints ?? 0) - points,
          });
        }
      }

      const invoice = sale.id ? await db.invoices.where('saleId').equals(sale.id).first() : undefined;
      if (invoice) {
        const all = sale.id ? await db.returns.where('saleId').equals(sale.id).toArray() : [record];
        const returnedTotal = round2(all.reduce((a, r) => a + r.total, 0));
        const note = `${invoice.notes ? `${invoice.notes} · ` : ''}Devolución ${sale.ticketNumber}: ${round2(returnedTotal)}`;
        if (returnedTotal >= sale.total - 0.005) {
          await db.invoices.update(invoice.id!, { status: 'cancelled', notes: note, paid: 0 });
        } else {
          await db.invoices.update(invoice.id!, { notes: note });
        }
        record.invoiceId = invoice.id;
      }

      return record;
    },
  );
}
