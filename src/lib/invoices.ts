import { addDays } from 'date-fns';
import { db, getSettings } from '../db/database';
import type { Invoice, Repair, Sale, Settings } from '../types';
import { computeInvoiceTotals, formatInvoiceNumber, isoDate, itemFromTotal } from './calc';

export function peekInvoiceNumber(s: Settings, date = new Date()): string {
  let n = s.invoiceNextNumber || 1;
  if (s.invoiceYearReset && s.invoiceLastYear && s.invoiceLastYear !== date.getFullYear()) n = 1;
  return formatInvoiceNumber(s, n, date);
}

export async function nextInvoiceNumber(date = new Date()): Promise<string> {
  const s = await getSettings();
  let n = s.invoiceNextNumber || 1;
  const year = date.getFullYear();
  if (s.invoiceYearReset && s.invoiceLastYear && s.invoiceLastYear !== year) n = 1;
  let number = formatInvoiceNumber(s, n, date);
  while ((await db.invoices.where('number').equals(number).count()) > 0) {
    n += 1;
    number = formatInvoiceNumber(s, n, date);
  }
  await db.settings.update(s.id!, { invoiceNextNumber: n + 1, invoiceLastYear: year });
  return number;
}

export async function createInvoiceFromSale(sale: Sale): Promise<Invoice> {
  const s = await getSettings();
  const c = sale.customerId ? await db.customers.get(sale.customerId) : undefined;
  const items = sale.items.map((i) => itemFromTotal(i.name, i.quantity, i.price * i.quantity, s.taxRate));
  const totals = computeInvoiceTotals(items);
  const now = new Date();
  const inv: Invoice = {
    number: await nextInvoiceNumber(now),
    date: isoDate(now),
    dueDate: isoDate(addDays(now, s.invoiceDefaultDueDays)),
    customerName: c?.name ?? sale.customerName ?? '—',
    customerDni: c?.dni ?? '',
    customerAddress: c?.address ?? '',
    customerEmail: c?.email ?? '',
    items,
    ...totals,
    paid: totals.total,
    status: 'paid',
    paymentMethod: sale.paymentMethod,
    notes: `Ticket ${sale.ticketNumber}`,
    saleId: sale.id,
    createdAt: now.toISOString(),
  };
  inv.id = await db.invoices.add(inv);
  return inv;
}

export async function createInvoiceFromRepair(repair: Repair, repairLabel = 'Reparación'): Promise<Invoice> {
  const s = await getSettings();
  const c = repair.customerId
    ? await db.customers.get(repair.customerId)
    : await db.customers.where('phone').equals(repair.customerPhone).first();
  const amount = repair.finalCost ?? repair.estimatedCost;
  let desc = `${repairLabel} ${repair.device} (${repair.ticketNumber})`;
  if (s.invoiceIncludeRepairDetail) desc += ` — ${repair.problem}${repair.diagnosis ? '. ' + repair.diagnosis : ''}`;
  const items = [itemFromTotal(desc, 1, amount, s.taxRate)];
  const totals = computeInvoiceTotals(items);
  const now = new Date();
  const status = s.invoiceDefaultStatus;
  const inv: Invoice = {
    number: await nextInvoiceNumber(now),
    date: isoDate(now),
    dueDate: isoDate(addDays(now, s.invoiceDefaultDueDays)),
    customerName: repair.customerName,
    customerDni: c?.dni ?? '',
    customerAddress: c?.address ?? '',
    customerEmail: repair.customerEmail ?? c?.email ?? '',
    items,
    ...totals,
    paid: status === 'paid' ? totals.total : 0,
    status,
    paymentMethod: s.invoiceDefaultPaymentMethod,
    notes: s.invoiceDefaultNotes,
    repairId: repair.id,
    createdAt: now.toISOString(),
  };
  inv.id = await db.invoices.add(inv);
  return inv;
}