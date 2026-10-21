import { addDays } from 'date-fns';
import { db, getSettings } from '../db/database';
import type { Invoice, InvoiceItem, RectifyingCode, Repair, Sale, Settings } from '../types';
import { computeInvoiceTotals, formatInvoiceNumber, isoDate, itemFromTotal } from './calc';
import { logAction } from './audit';
import { emitAlta, emitAnulacion } from '../verifactu/service';

export function peekInvoiceNumber(s: Settings, date = new Date()): string {
  let n = s.invoiceNextNumber || 1;
  if (s.invoiceYearReset && s.invoiceLastYear && s.invoiceLastYear !== date.getFullYear()) n = 1;
  return formatInvoiceNumber(s, n, date);
}

/**
 * Allocates the next invoice number inside one read-write transaction. Two
 * windows (or a double-click on "create invoice") serialize here instead of
 * reading the same counter and issuing a duplicate.
 */
export async function nextInvoiceNumber(date = new Date()): Promise<string> {
  return db.transaction('rw', db.settings, db.invoices, async () => {
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
  });
}

/**
 * Veri*factu — registro de ALTA encadenado + cola de remisión.
 *
 * La factura SIEMPRE se persiste; si VERI*FACTU está activado, se le asignan
 * los campos de huella (verifHash/verifPrevHash/verifTime) calculados por el
 * servicio oficial (Orden HAC/1177/2024). El registro SOAP queda encolado.
 * Si falla la emisión fiscal NO se pierde la factura: se guarda sin huella y
 * el mensaje se deja en el log (estado pending visible en Settings).
 */
async function applyVerifactu(inv: Invoice, s: Settings): Promise<void> {
  if (!s.verifactu?.enabled) return;
  try {
    // Id temporal vacío antes de insertar; service usa id cuando existe.
    const res = await emitAlta({ ...inv, id: inv.id }, s);
    inv.verifHash = res.huella;
    inv.verifPrevHash = res.huellaAnterior || undefined;
    inv.verifTime = res.fechaHoraGen;
    inv.verifEnvio = 'queued';
  } catch (e) {
    console.error('Veri*factu: no se pudo registrar la factura', inv.number, e);
  }
}

/**
 * Anula también la factura en Veri*factu (RegistroAnulacion encadenado) cuando
 * la factura local se cancela HABIÉNDOSE emitido con huella. La factura local
 * no se borra: se anula lógicamente.
 */
export async function cancelInvoiceWithVerifactu(inv: Invoice): Promise<boolean> {
  const s = await getSettings();
  if (!s.verifactu?.enabled || !inv.verifHash) {
    // Sin huella (fuera de cadena) o sin fiscalidad: cancelación normal.
    await db.invoices.update(inv.id!, { status: 'cancelled' });
    return false;
  }
  try {
    await emitAnulacion({ ...inv, id: inv.id }, s);
  } catch (e) {
    console.error('Veri*factu: no se pudo anular la factura', inv.number, e);
  }
  await db.invoices.update(inv.id!, { status: 'cancelled' });
  return true;
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
  await applyVerifactu(inv, s);
  if (inv.verifHash) {
    await db.invoices.update(inv.id, { verifHash: inv.verifHash, verifPrevHash: inv.verifPrevHash, verifTime: inv.verifTime, verifEnvio: inv.verifEnvio });
  }
  return inv;
}

export async function createInvoiceFromRepair(repair: Repair, repairLabel = 'Reparación', laborLabel = 'Mano de obra'): Promise<Invoice> {
  const s = await getSettings();
  const c = repair.customerId
    ? await db.customers.get(repair.customerId)
    : await db.customers.where('phone').equals(repair.customerPhone).first();
  /** Repair price and, when labor is billed separately, its own invoice line on top. */
  const amount = repair.finalCost ?? repair.estimatedCost;
  const labor = repair.laborMode === 'separate' ? repair.laborCost ?? 0 : 0;
  let desc = `${repairLabel} ${repair.device} (${repair.ticketNumber})`;
  if (s.invoiceIncludeRepairDetail) desc += ` — ${repair.problem}${repair.diagnosis ? '. ' + repair.diagnosis : ''}`;
  const items = [itemFromTotal(desc, 1, amount, s.taxRate)];
  if (labor > 0) items.push(itemFromTotal(`${laborLabel} (${repair.ticketNumber})`, 1, labor, s.taxRate));
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
  await applyVerifactu(inv, s);
  if (inv.verifHash) {
    await db.invoices.update(inv.id, { verifHash: inv.verifHash, verifPrevHash: inv.verifPrevHash, verifTime: inv.verifTime, verifEnvio: inv.verifEnvio });
  }
  return inv;
}

/** Siguiente número de la serie de rectificativas (p. ej. `R2026-0031`). */
export async function nextRectInvoiceNumber(date = new Date()): Promise<string> {
  const s = await getSettings();
  const n = s.invoiceNextRectNumber || 1;
  const number = formatInvoiceNumber({ ...s, invoicePrefix: s.invoiceRectPrefix || 'R' }, n, date);
  await db.settings.update(s.id!, { invoiceNextRectNumber: n + 1 });
  return number;
}

/**
 * Rectificativas R1–R5 (Veri*factu) — emite una factura rectificativa de la
 * factura `original` por el importe de la CORRECCIÓN (método I = por
 * diferencias): los importes de la rectificativa representan el delta con
 * signo (negativo cuando la base baja; p. ej. una devolución parcial).
 *
 * La rectificativa lleva serie propia (`settings.invoiceRectPrefix`) y
 * referencia la original (FacturasRectificadas). La original NO se modifica
 * (la cadena Veri*factu es inmutable); el efecto contable del delta lo aplica
 * el llamador (p. ej. bajando `paid` o cancelando la original si es total).
 *
 * @param original    factura rectificada, ya persistida
 * @param deltaTotal  delta con signo del IMPORTE TOTAL (IVA incl.), ≤ 0 en devoluciones
 * @param reason      razón de la rectificación (descripción de la operación)
 * @param code        R1–R5 según la causa (R1 por defecto: fundamento legal/art. 80)
 */
export async function createRectifyingInvoice(
  original: Invoice,
  deltaTotal: number,
  reason: string,
  code: RectifyingCode = 'R1',
): Promise<Invoice> {
  const s = await getSettings();
  const rate = s.taxRate;
  const items: InvoiceItem[] = [itemFromTotal(reason, 1, deltaTotal, rate)];
  const totals = computeInvoiceTotals(items);
  const now = new Date();
  const inv: Invoice = {
    number: await nextRectInvoiceNumber(now),
    date: isoDate(now),
    dueDate: original.dueDate,
    customerName: original.customerName,
    customerDni: original.customerDni,
    customerAddress: original.customerAddress,
    customerEmail: original.customerEmail,
    items,
    ...totals,
    paid: totals.total,
    status: 'paid',
    paymentMethod: 'other',
    notes: `Rectificativa ${code} de ${original.number}`,
    rectifies: original.id,
    rectCode: code,
    rectMethod: 'I',
    createdAt: now.toISOString(),
  };
  inv.id = await db.invoices.add(inv);
  await applyVerifactu(inv, s);
  if (inv.verifHash) {
    await db.invoices.update(inv.id, { verifHash: inv.verifHash, verifPrevHash: inv.verifPrevHash, verifTime: inv.verifTime, verifEnvio: inv.verifEnvio });
  }
  await logAction('create', 'billing', `${inv.number} ← ${original.number} (${code})`);
  return inv;
}
