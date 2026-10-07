import { differenceInCalendarDays, isToday } from 'date-fns';
import { db, getSettings } from '../db/database';
import type { AppNotification } from '../types';
import { plainMoney, toDate } from './format';
import { isoDate, round2 } from './calc';
import { nextPurchaseOrderNumber } from './stock';

export const ACTIVE_REPAIR = ['received', 'diagnosis', 'in_progress', 'waiting_parts'];
export const REPAIR_OVERDUE_DAYS = 7;

/** Marks unpaid invoices whose due date has passed as overdue. Returns how many changed. */
export async function markOverdueInvoices(): Promise<number> {
  const today = isoDate();
  const list = await db.invoices.toArray();
  const toUpdate = list.filter((i) => ['sent', 'partial'].includes(i.status) && i.dueDate && i.dueDate < today && i.paid < i.total);
  for (const i of toUpdate) await db.invoices.update(i.id!, { status: 'overdue' });
  return toUpdate.length;
}

let running = false;
/** Auto-generates alerts from current data without duplicates. */
export async function generateNotifications(): Promise<number> {
  if (running) return 0;
  running = true;
  try {
    await markOverdueInvoices();
    const [products, repairs, invoices, notifs, sales, settings] = await Promise.all([
      db.products.toArray(), db.repairs.toArray(), db.invoices.toArray(), db.notifications.toArray(), db.sales.toArray(), getSettings(),
    ]);
    const unread = notifs.filter((n) => !n.read);
    const hasUnread = (type: string, relatedId?: string) =>
      unread.some((n) => n.type === type && (relatedId === undefined || n.relatedId === relatedId));
    const now = new Date();
    const createdAt = now.toISOString();
    const out: AppNotification[] = [];

    const critical = products.filter((p) => p.stock <= 0);
    const stockAlertsOn = settings.automations?.inv_stock_alert !== false;
    if (stockAlertsOn && critical.length && !hasUnread('stock_critical')) {
      out.push({ type: 'stock_critical', title: 'notif.stockCriticalTitle', message: 'notif.stockCriticalMsg', params: { count: critical.length, names: critical.slice(0, 3).map((p) => p.name).join(', ') }, read: false, createdAt });
    }
    // `inv_auto_order` automation: draft a purchase order for out-of-stock products
    // that are not already covered by an open order.
    if (settings.automations?.inv_auto_order === true && critical.length) {
      const open = await db.purchaseOrders.where('status').anyOf('draft', 'sent', 'partial').toArray();
      const covered = new Set(open.flatMap((o) => o.items.map((i) => i.productId)));
      const missing = critical.filter((p) => !covered.has(p.id!));
      if (missing.length) {
        const items = missing.map((p) => ({
          productId: p.id!, name: p.name,
          quantity: Math.max(1, p.minStock * 2 - p.stock), quantityReceived: 0, cost: p.cost,
        }));
        const number = await nextPurchaseOrderNumber();
        await db.purchaseOrders.add({
          number, providerName: '—', status: 'draft', date: isoDate(now), items,
          total: round2(items.reduce((a, i) => a + i.quantity * i.cost, 0)), createdAt,
        });
        out.push({ type: 'system', title: 'notif.autoOrderTitle', message: 'notif.autoOrderMsg', params: { number, count: missing.length }, read: false, createdAt });
      }
    }
    const low = products.filter((p) => p.stock > 0 && p.stock <= p.minStock);
    if (stockAlertsOn && low.length && !hasUnread('stock_low')) {
      out.push({ type: 'stock_low', title: 'notif.stockLowTitle', message: 'notif.stockLowMsg', params: { count: low.length, names: low.slice(0, 3).map((p) => p.name).join(', ') }, read: false, createdAt });
    }
    for (const r of repairs) {
      const d = toDate(r.dateIn);
      if (!d || !ACTIVE_REPAIR.includes(r.status)) continue;
      const days = differenceInCalendarDays(now, d);
      if (days >= REPAIR_OVERDUE_DAYS && !hasUnread('repair_overdue', r.ticketNumber)) {
        out.push({ type: 'repair_overdue', title: 'notif.repairOverdueTitle', message: 'notif.repairOverdueMsg', params: { ticket: r.ticketNumber, device: r.device, days }, read: false, createdAt, relatedId: r.ticketNumber });
      }
    }
    // `bil_overdue_alert` automation: warn about invoices past their due date.
    const overdueAlertsOn = settings.automations?.bil_overdue_alert !== false;
    for (const i of invoices) {
      if (overdueAlertsOn && i.status === 'overdue' && !hasUnread('invoice_overdue', i.number)) {
        out.push({ type: 'invoice_overdue', title: 'notif.invoiceOverdueTitle', message: 'notif.invoiceOverdueMsg', params: { number: i.number, customer: i.customerName, amount: plainMoney(i.total - i.paid, settings) }, read: false, createdAt, relatedId: i.number });
      }
    }
    const dayKey = isoDate(now);
    const summaryOn = settings.automations?.sal_daily_summary !== false;
    if (summaryOn && !notifs.some((n) => n.type === 'daily_summary' && n.relatedId === dayKey)) {
      const yesterday = sales.filter((s) => { const d = toDate(s.date); return d && differenceInCalendarDays(now, d) === 1; });
      const todaySales = sales.filter((s) => { const d = toDate(s.date); return d && isToday(d); });
      const pool = yesterday.length ? yesterday : todaySales;
      out.push({ type: 'daily_summary', title: 'notif.dailySummaryTitle', message: 'notif.dailySummaryMsg', params: { count: pool.length, total: plainMoney(pool.reduce((a, s) => a + s.total, 0), settings), repairs: repairs.filter((r) => ACTIVE_REPAIR.includes(r.status)).length }, read: false, createdAt, relatedId: dayKey });
    }
    if (out.length) await db.notifications.bulkAdd(out);
    return out.length;
  } finally {
    running = false;
  }
}