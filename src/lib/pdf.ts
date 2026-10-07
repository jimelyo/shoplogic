import { jsPDF } from 'jspdf';
import i18n from '../i18n';
import type { Invoice, Settings } from '../types';
import { hexToRgb, cssVar } from './colors';
import { plainMoney, safeFormat } from './format';

type T = (k: string, o?: Record<string, unknown>) => string;

/** Standard PDF fonts only cover Latin scripts — fall back to English for zh/ar. */
export function pdfT(): T {
  const lng = ['zh', 'ar'].includes(i18n.language) ? 'en' : i18n.language;
  const ft = i18n.getFixedT(lng);
  return (k, o) => String(ft(k, o));
}
const latin = (s: string) => s.replace(/[^\x20-\x7E\u00A0-\u00FF\u20AC\u2013\u2014]/g, '').replace(/\s+/g, ' ').trim();

function brandRgb(s: Settings): [number, number, number] {
  if (s.normalPrinter?.color === false) return [30, 41, 59];
  return hexToRgb(cssVar('--sl-primary', '#4f46e5'));
}

export function invoicePdf(inv: Invoice, s: Settings) {
  const t = pdfT();
  const doc = new jsPDF({ unit: 'mm', format: s.normalPrinter?.paper === 'Letter' ? 'letter' : 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const brand = brandRgb(s);
  const m = (n: number) => plainMoney(n, s);
  const M = 15;

  doc.setFillColor(...brand);
  doc.rect(0, 0, W, 34, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
  doc.text(latin(s.storeName), M, 14);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(latin(`${t('settings.cif')}: ${s.cif}  |  ${s.address}`), M, 21);
  doc.text(latin(`${s.phone}  |  ${s.email}`), M, 26);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(20);
  doc.text(latin(t('billing.invoice')).toUpperCase(), W - M, 14, { align: 'right' });
  doc.setFontSize(11);
  doc.text(latin(inv.number), W - M, 21, { align: 'right' });
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
  doc.text(latin(`${t('common.date')}: ${safeFormat(inv.date, 'dd/MM/yyyy')}   ${t('billing.dueDate')}: ${safeFormat(inv.dueDate, 'dd/MM/yyyy')}`), W - M, 27, { align: 'right' });

  let y = 44;
  doc.setTextColor(100, 116, 139); doc.setFontSize(8);
  doc.text(latin(t('billing.billTo')).toUpperCase(), M, y);
  doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
  doc.text(latin(inv.customerName), M, y + 6);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  const custLines = [inv.customerDni ? `${t('billing.taxId')}: ${inv.customerDni}` : '', inv.customerAddress, inv.customerEmail].filter(Boolean);
  custLines.forEach((l, i) => doc.text(latin(l), M, y + 11 + i * 4.5));
  doc.setFontSize(9);
  doc.text(latin(`${t('common.status')}: ${t('invoiceStatus.' + inv.status)}`), W - M, y + 6, { align: 'right' });
  doc.text(latin(`${t('pos.paymentMethod')}: ${t('payment.' + inv.paymentMethod)}`), W - M, y + 11, { align: 'right' });

  y += 14 + custLines.length * 4.5 + 4;
  const cols = [
    { label: t('common.description'), x: M, w: 85, align: 'left' as const },
    { label: t('billing.qty'), x: M + 105, w: 12, align: 'right' as const },
    { label: t('common.price'), x: M + 132, w: 25, align: 'right' as const },
    { label: t('tax.vat'), x: M + 148, w: 14, align: 'right' as const },
    { label: t('common.total'), x: W - M - 2, w: 25, align: 'right' as const },
  ];
  const header = () => {
    doc.setFillColor(...brand); doc.rect(M, y, W - 2 * M, 8, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5);
    cols.forEach((c) => doc.text(latin(c.label), c.align === 'left' ? c.x + 2 : c.x, y + 5.4, { align: c.align }));
    y += 8;
    doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
  };
  header();
  inv.items.forEach((it, idx) => {
    const lines = doc.splitTextToSize(latin(it.description), 95) as string[];
    const h = Math.max(7, lines.length * 4 + 3);
    if (y + h > H - 50) { doc.addPage(); y = 20; header(); }
    if (idx % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(M, y, W - 2 * M, h, 'F'); }
    doc.setFontSize(8.5);
    doc.text(lines, M + 2, y + 4.8);
    doc.text(String(it.quantity), cols[1].x, y + 4.8, { align: 'right' });
    doc.text(m(it.price), cols[2].x, y + 4.8, { align: 'right' });
    doc.text(`${it.taxRate}%`, cols[3].x, y + 4.8, { align: 'right' });
    doc.text(m(it.total), cols[4].x, y + 4.8, { align: 'right' });
    y += h;
    doc.setDrawColor(226, 232, 240); doc.line(M, y, W - M, y);
  });

  y += 8;
  const bx = W - M - 75;
  const row = (label: string, val: string, bold = false, color?: [number, number, number]) => {
    doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(bold ? 11 : 9.5);
    doc.setTextColor(...(color ?? [30, 41, 59]));
    doc.text(latin(label), bx, y); doc.text(val, W - M - 2, y, { align: 'right' }); y += bold ? 8 : 6;
  };
  row(t('tax.base'), m(inv.subtotal));
  row(`+ ${t('tax.vat')}`, `+ ${m(inv.totalTax)}`);
  doc.setDrawColor(...brand); doc.setLineWidth(0.6); doc.line(bx, y - 3, W - M, y - 3); doc.setLineWidth(0.2);
  y += 2;
  row(t('tax.totalInc'), m(inv.total), true, brand);
  if (inv.paid > 0 && inv.paid < inv.total) {
    row(t('billing.paid'), m(inv.paid));
    row(t('billing.pending'), m(inv.total - inv.paid), true, [220, 38, 38]);
  }
  if (inv.notes) {
    y += 4; doc.setTextColor(71, 85, 105); doc.setFont('helvetica', 'normal'); doc.setFontSize(8.5);
    doc.text(doc.splitTextToSize(latin(`${t('common.notes')}: ${inv.notes}`), W - 2 * M) as string[], M, y);
  }
  if (s.normalPrinter?.watermark) {
    doc.setTextColor(226, 232, 240); doc.setFontSize(60); doc.setFont('helvetica', 'bold');
    doc.text(latin(s.normalPrinter.watermark), W / 2, H / 2, { align: 'center', angle: 30 });
  }
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...brand); doc.line(M, H - 15, W - M, H - 15);
    doc.setFontSize(7.5); doc.setTextColor(148, 163, 184); doc.setFont('helvetica', 'normal');
    doc.text(latin(`${s.storeName} - ${s.cif} - ${s.email}`), M, H - 10);
    doc.text(`${p}/${pages}`, W - M, H - 10, { align: 'right' });
  }
  doc.save(`${inv.number.replace(/[^\w-]+/g, '_')}.pdf`);
}

export interface PdfColumn { label: string; align?: 'left' | 'right'; weight?: number }

export function tablePdf(opts: { title: string; subtitle: string; columns: PdfColumn[]; rows: string[][]; kpis?: [string, string][]; filename: string; settings: Settings }) {
  const { settings: s } = opts;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: opts.columns.length > 6 ? 'landscape' : 'portrait' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 12;
  const brand = brandRgb(s);
  doc.setFillColor(...brand); doc.rect(0, 0, W, 26, 'F');
  doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(16);
  doc.text(latin(opts.title), M, 12);
  doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
  doc.text(latin(opts.subtitle), M, 19);
  doc.text(latin(s.storeName), W - M, 12, { align: 'right' });
  doc.text(safeFormat(new Date(), 'dd/MM/yyyy HH:mm'), W - M, 19, { align: 'right' });
  let y = 34;
  if (opts.kpis?.length) {
    const bw = (W - 2 * M - (opts.kpis.length - 1) * 4) / opts.kpis.length;
    opts.kpis.forEach(([l, v], i) => {
      const x = M + i * (bw + 4);
      doc.setFillColor(248, 250, 252); doc.setDrawColor(226, 232, 240); doc.roundedRect(x, y, bw, 16, 2, 2, 'FD');
      doc.setTextColor(100, 116, 139); doc.setFontSize(7.5); doc.text(latin(l).toUpperCase(), x + 3, y + 5.5);
      doc.setTextColor(30, 41, 59); doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.text(latin(v), x + 3, y + 12.5);
      doc.setFont('helvetica', 'normal');
    });
    y += 24;
  }
  const totalW = opts.columns.reduce((a, c) => a + (c.weight ?? 1), 0);
  const avail = W - 2 * M;
  const xs: number[] = [];
  let acc = M;
  opts.columns.forEach((c) => { xs.push(acc); acc += ((c.weight ?? 1) / totalW) * avail; });
  const widthOf = (i: number) => ((opts.columns[i].weight ?? 1) / totalW) * avail;
  const header = () => {
    doc.setFillColor(...brand); doc.rect(M, y, avail, 7, 'F');
    doc.setTextColor(255, 255, 255); doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
    opts.columns.forEach((c, i) => {
      const right = c.align === 'right';
      doc.text(latin(c.label), right ? xs[i] + widthOf(i) - 1.5 : xs[i] + 1.5, y + 4.8, { align: right ? 'right' : 'left' });
    });
    y += 7; doc.setFont('helvetica', 'normal'); doc.setTextColor(30, 41, 59);
  };
  header();
  opts.rows.forEach((r, ri) => {
    const cells = r.map((v, i) => doc.splitTextToSize(latin(v ?? ''), widthOf(i) - 3) as string[]);
    const h = Math.max(6, Math.max(...cells.map((c) => c.length)) * 3.6 + 2.5);
    if (y + h > H - 16) { doc.addPage(); y = 16; header(); }
    if (ri % 2 === 1) { doc.setFillColor(248, 250, 252); doc.rect(M, y, avail, h, 'F'); }
    doc.setFontSize(7.8);
    cells.forEach((c, i) => {
      const right = opts.columns[i].align === 'right';
      doc.text(c, right ? xs[i] + widthOf(i) - 1.5 : xs[i] + 1.5, y + 4, { align: right ? 'right' : 'left' });
    });
    y += h;
  });
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p); doc.setFontSize(7.5); doc.setTextColor(148, 163, 184);
    doc.text('ShopLogic Pro', M, H - 7);
    doc.text(`${p}/${pages}`, W - M, H - 7, { align: 'right' });
  }
  doc.save(opts.filename);
}