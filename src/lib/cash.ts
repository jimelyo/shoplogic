import { db } from '../db/database';
import { useStore } from '../store/store';
import { round2 } from './calc';
import type { CashAdjustment, CashSession } from '../types';

const nowIso = () => new Date().toISOString();
const currentUserName = () => useStore.getState().currentUser?.name ?? 'Sistema';

export interface CashBreakdown {
  openingFloat: number;
  cashSales: number;
  cashInvoices: number;
  cashReturns: number;
  deposits: number;
  withdrawals: number;
  expected: number;
}

/** The session currently holding the drawer, if any. Only one can be open. */
export async function openCashSession(openingFloat = 0): Promise<CashSession> {
  const current = await db.cashSessions.where('status').equals('open').first();
  if (current) return current;
  const at = nowIso();
  const session: CashSession = {
    status: 'open', openedAt: at, openedBy: currentUserName(),
    openingFloat: round2(openingFloat || 0), adjustments: [], createdAt: at,
  };
  session.id = await db.cashSessions.add(session);
  return session;
}

const inWindow = (iso: string | undefined, from: string, to: string) => !!iso && iso >= from && iso <= to;

/**
 * Cash that should be in the drawer right now: opening float + takings paid in
 * cash + cash payments registered on invoices + deposits − withdrawals − refunds.
 * Expenses are shown for reference only because the expense model does not record
 * a payment method: withdrawing cash for one is registered as an adjustment.
 */
export async function sessionBreakdown(s: CashSession): Promise<CashBreakdown> {
  const from = s.openedAt;
  const to = s.closedAt ?? nowIso();

  const sales = (await db.sales.toArray()).filter((x) => x.paymentMethod === 'cash' && inWindow(x.date, from, to));
  const invoices = (await db.invoices.toArray())
    .filter((x) => x.paymentMethod === 'cash' && inWindow(x.createdAt, from, to) && x.paid > 0);

  const adjustments = s.adjustments ?? [];
  const sum = (type: CashAdjustment['type']) =>
    round2(adjustments.filter((a) => a.type === type).reduce((a, x) => a + (Number(x.amount) || 0), 0));

  const openingFloat = round2(s.openingFloat || 0);
  const cashSales = round2(sales.reduce((a, x) => a + x.total, 0));
  const cashInvoices = round2(invoices.reduce((a, x) => a + x.paid, 0));
  const cashReturns = await cashRefunds(from, to);
  const deposits = sum('deposit');
  const withdrawals = sum('withdraw');

  return {
    openingFloat, cashSales, cashInvoices, cashReturns, deposits, withdrawals,
    expected: round2(openingFloat + cashSales + cashInvoices + deposits - withdrawals - cashReturns),
  };
}

/**
 * Cash handed back inside the window: refunds only leave the drawer when the
 * original sale was paid in cash, so those are the only ones counted.
 */
async function cashRefunds(from: string, to: string): Promise<number> {
  const rows = (await db.returns.toArray()).filter((r) => r.date >= from && r.date <= to);
  const saleIds = [...new Set(rows.map((r) => r.saleId).filter((id): id is number => typeof id === 'number'))];
  if (!saleIds.length) return 0;
  const sales = await db.sales.where('id').anyOf(saleIds).toArray();
  const cashSales = new Set(sales.filter((s) => s.paymentMethod === 'cash').map((s) => s.id));
  return round2(rows.filter((r) => r.saleId !== undefined && cashSales.has(r.saleId)).reduce((a, r) => a + r.total, 0));
}

/** Records money moved in or out of the drawer (deposits, withdrawals, corrections). */
export async function addAdjustment(
  session: CashSession, type: CashAdjustment['type'], amount: number, note?: string,
): Promise<CashSession> {
  const value = round2(Math.abs(amount));
  const adjustment: CashAdjustment = { type, amount: value, note, at: nowIso(), userName: currentUserName() };
  const adjustments = [...(session.adjustments ?? []), adjustment];
  await db.cashSessions.update(session.id!, { adjustments });
  return { ...session, adjustments };
}

/** Counts the drawer and stores the expected/cash/difference snapshot. */
export async function closeCashSession(session: CashSession, counted: number, note?: string): Promise<CashSession> {
  const b = await sessionBreakdown(session);
  const closedAt = nowIso();
  const patch: Partial<CashSession> = {
    status: 'closed', closedAt, closedBy: currentUserName(),
    ...b, counted: round2(counted), difference: round2(round2(counted) - b.expected), note,
  };
  await db.cashSessions.update(session.id!, patch);
  return { ...session, ...patch };
}

/** Cash received per payment method inside a window; used by the report cards. */
export const isCashSessionOpen = (s: CashSession | undefined | null) => s?.status === 'open';
