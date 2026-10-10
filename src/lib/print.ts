import i18n from '../i18n';
import type { Invoice, Quote, Repair, Sale, Settings } from '../types';
import { splitVat } from './calc';
import { formatMoney, safeFormat } from './format';

type T = (k: string, o?: Record<string, unknown>) => string;

export const esc = (s: unknown) =>
  String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export function printHtml(body: string, title = 'ShopLogic Pro') {
  const dir = i18n.dir();
  const doc = `<!doctype html><html dir="${dir}" lang="${i18n.language}"><head><meta charset="utf-8"><title>${esc(title)}</title></head><body>${body}</body></html>`;
  let w: Window | null = null;
  try { w = window.open('', '_blank', 'width=900,height=760'); } catch { w = null; }
  if (w && w.document) {
    w.document.open();
    w.document.write(doc);
    w.document.close();
    w.focus();
    setTimeout(() => { try { w!.print(); } catch { /* noop */ } }, 350);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;';
  document.body.appendChild(iframe);
  const d = iframe.contentWindow!.document;
  d.open(); d.write(doc); d.close();
  setTimeout(() => {
    iframe.contentWindow!.focus();
    iframe.contentWindow!.print();
    setTimeout(() => iframe.remove(), 1500);
  }, 350);
}

const ticketCss = (width: string) => `<style>
  @page { size: ${width} auto; margin: 3mm; }
  * { box-sizing: border-box; }
  body { font-family: 'Courier New', ui-monospace, monospace; font-size: 12px; color: #000; margin: 0 auto; width: ${width === '58mm' ? '52mm' : '72mm'}; }
  .c { text-align: center; } .b { font-weight: 700; } .r { text-align: end; }
  .logo { font-size: 22px; } h1 { font-size: 15px; margin: 4px 0; }
  hr { border: 0; border-top: 1px dashed #000; margin: 6px 0; }
  table { width: 100%; border-collapse: collapse; } td { vertical-align: top; padding: 1px 0; }
  .tot td { font-size: 14px; font-weight: 700; }
  .muted { color: #333; font-size: 11px; }
</style>`;

function storeHeader(s: Settings, t: T) {
  const tp = s.ticketPrinter;
  const logo = s.logo
    ? `<div class="c"><img src="${s.logo}" alt="" style="max-width:26mm;max-height:20mm;object-fit:contain;margin:0 auto 2px"></div>`
    : (tp?.showLogo !== false ? '<div class="c logo">📱</div>' : '');
  return `${logo}
  <h1 class="c">${esc(tp?.header || s.storeName)}</h1>
  <div class="c muted">${esc(t('settings.cif'))}: ${esc(s.cif)}<br>${esc(s.address)}<br>${esc(t('common.phone'))}: ${esc(s.phone)}</div><hr>`;
}

export function saleTicketHtml(sale: Sale, s: Settings, t: T) {
  const lang = i18n.language;
  const m = (n: number) => formatMoney(n, s, lang);
  const v = splitVat(sale.total, s.taxRate);
  const rows = sale.items.map((i) => `<tr><td>${i.quantity} x ${esc(i.name)}</td><td class="r">${m(i.price * i.quantity)}</td></tr>`).join('');
  return `${ticketCss(s.ticketPrinter?.width ?? '80mm')}${storeHeader(s, t)}
  <div><span class="b">${esc(t('pos.ticket'))}:</span> ${esc(sale.ticketNumber)}<br><span class="b">${esc(t('common.date'))}:</span> ${safeFormat(sale.date, 'dd/MM/yyyy HH:mm')}
  ${sale.customerName ? `<br><span class="b">${esc(t('common.customer'))}:</span> ${esc(sale.customerName)}` : ''}
  <br><span class="b">${esc(t('pos.paymentMethod'))}:</span> ${esc(t('payment.' + sale.paymentMethod))}</div><hr>
  <table>${rows}</table><hr>
  <table>${sale.discount ? `<tr><td>${esc(t('pos.discount'))}${sale.discountPercent ? ` (${sale.discountPercent} %)` : ''}</td><td class="r">-${m(sale.discount)}</td></tr>` : ''}<tr><td>${esc(t('tax.base'))}</td><td class="r">${m(v.base)}</td></tr>
  <tr><td>${esc(t('tax.vat'))} (${s.taxRate}%)</td><td class="r">${m(v.vat)}</td></tr>
  <tr class="tot"><td>${esc(t('tax.totalInc'))}</td><td class="r">${m(v.total)}</td></tr></table><hr>
  <div class="c muted">${esc(s.ticketFooter || '')}</div>`;
}

export function repairReceiptHtml(r: Repair, s: Settings, t: T) {
  const lang = i18n.language;
  const m = (n: number) => formatMoney(n, s, lang);
  const amount = r.finalCost ?? r.estimatedCost;
  const v = splitVat(amount, s.taxRate);
  return `${ticketCss(s.ticketPrinter?.width ?? '80mm')}${storeHeader(s, t)}
  <div class="c b">${esc(t('repairs.receiptTitle'))}</div>
  <div class="c b" style="font-size:16px">${esc(r.ticketNumber)}</div><hr>
  <div><span class="b">${esc(t('repairs.dateIn'))}:</span> ${safeFormat(r.dateIn, 'dd/MM/yyyy HH:mm')}
  ${r.dateOut ? `<br><span class="b">${esc(t('repairs.dateOut'))}:</span> ${safeFormat(r.dateOut, 'dd/MM/yyyy HH:mm')}` : ''}
  <br><span class="b">${esc(t('common.status'))}:</span> ${esc(t('repairStatus.' + r.status))}</div><hr>
  <div><span class="b">${esc(t('common.customer'))}:</span> ${esc(r.customerName)}<br><span class="b">${esc(t('common.phone'))}:</span> ${esc(r.customerPhone)}${r.customerEmail ? `<br>${esc(r.customerEmail)}` : ''}</div><hr>
  <div><span class="b">${esc(t('repairs.device'))}:</span> ${esc(r.device)}<br><span class="b">IMEI:</span> ${esc(r.imei || '—')}</div>
  <div style="margin-top:4px"><span class="b">${esc(t('repairs.problem'))}:</span> ${esc(r.problem)}</div>
  ${r.diagnosis ? `<div style="margin-top:4px"><span class="b">${esc(t('repairs.diagnosis'))}:</span> ${esc(r.diagnosis)}</div>` : ''}<hr>
  <table><tr><td class="b">${esc(r.finalCost !== undefined ? t('repairs.finalCost') : t('repairs.estimate'))}</td><td></td></tr>
  <tr><td>${esc(t('tax.base'))}</td><td class="r">${m(v.base)}</td></tr>
  <tr><td>${esc(t('tax.vat'))} (${s.taxRate}%)</td><td class="r">${m(v.vat)}</td></tr>
  <tr class="tot"><td>${esc(t('tax.totalInc'))}</td><td class="r">${m(v.total)}</td></tr></table><hr>
  <div class="c muted">${esc(t('repairs.thanks'))}</div>
  <div class="c muted" style="margin-top:14px">______________________<br>${esc(t('repairs.signature'))}</div>`;
}

/** Ticket-style quote to hand (or send) to the customer. */
export function quoteHtml(x: Quote, s: Settings, t: T) {
  const lang = i18n.language;
  const m = (n: number) => formatMoney(n, s, lang);
  const v = splitVat(x.total, s.taxRate);
  const rows = x.items.map((i) => `<tr><td>${i.quantity} x ${esc(i.name)}</td><td class="r">${m(i.price * i.quantity)}</td></tr>`).join('');
  return `${ticketCss(s.ticketPrinter?.width ?? '80mm')}${storeHeader(s, t)}
  <div class="c b">${esc(t('quotes.docTitle'))}</div>
  <div class="c b" style="font-size:16px">${esc(x.number)}</div><hr>
  <div><span class="b">${esc(t('common.date'))}:</span> ${safeFormat(x.date, 'dd/MM/yyyy')}
  ${x.expiresAt ? `<br><span class="b">${esc(t('quotes.validUntil'))}:</span> ${safeFormat(x.expiresAt, 'dd/MM/yyyy')}` : ''}
  <br><span class="b">${esc(t('common.customer'))}:</span> ${esc(x.customerName)}${x.customerPhone ? `<br>${esc(x.customerPhone)}` : ''}
  ${x.device ? `<br><span class="b">${esc(t('repairs.device'))}:</span> ${esc(x.device)}${x.imei ? ` · IMEI ${esc(x.imei)}` : ''}` : ''}</div><hr>
  <table>${rows}</table><hr>
  <table><tr><td>${esc(t('tax.base'))}</td><td class="r">${m(v.base)}</td></tr>
  <tr><td>${esc(t('tax.vat'))} (${s.taxRate}%)</td><td class="r">${m(v.vat)}</td></tr>
  <tr class="tot"><td>${esc(t('tax.totalInc'))}</td><td class="r">${m(v.total)}</td></tr></table><hr>
  ${x.notes ? `<div class="muted">${esc(x.notes)}</div><hr>` : ''}
  <div class="c muted">${esc(t('quotes.footerNote'))}</div>`;
}

export function invoiceHtml(inv: Invoice, s: Settings, t: T, brand = '#4f46e5') {
  const lang = i18n.language;
  const m = (n: number) => formatMoney(n, s, lang);
  const np = s.normalPrinter;
  const color = np?.color === false ? '#111' : brand;
  const copies = Math.max(1, Math.min(5, np?.copies ?? 1));
  const one = `<div class="page">
    ${np?.watermark ? `<div class="wm">${esc(np.watermark)}</div>` : ''}
    <div class="head"><div>${s.logo ? `<img src="${s.logo}" alt="" class="brand">` : ''}<div class="store">${esc(s.storeName)}</div><div class="muted">${esc(t('settings.cif'))}: ${esc(s.cif)}<br>${esc(s.address)}<br>${esc(s.phone)} · ${esc(s.email)}</div></div>
    <div class="ttl"><div class="big">${esc(t('billing.invoice'))}</div><div class="num">${esc(inv.number)}</div>
    <div class="muted">${esc(t('common.date'))}: ${safeFormat(inv.date, 'dd/MM/yyyy')}<br>${esc(t('billing.dueDate'))}: ${safeFormat(inv.dueDate, 'dd/MM/yyyy')}</div></div></div>
    <div class="cust"><div class="lbl">${esc(t('billing.billTo'))}</div><div class="b">${esc(inv.customerName)}</div>
    <div class="muted">${inv.customerDni ? esc(t('billing.taxId')) + ': ' + esc(inv.customerDni) + '<br>' : ''}${esc(inv.customerAddress || '')}${inv.customerEmail ? '<br>' + esc(inv.customerEmail) : ''}</div></div>
    <table class="items"><thead><tr><th>${esc(t('common.description'))}</th><th class="r">${esc(t('billing.qty'))}</th><th class="r">${esc(t('common.price'))}</th><th class="r">${esc(t('tax.vat'))}</th><th class="r">${esc(t('common.total'))}</th></tr></thead>
    <tbody>${inv.items.map((i) => `<tr><td>${esc(i.description)}</td><td class="r">${i.quantity}</td><td class="r">${m(i.price)}</td><td class="r">${i.taxRate}%</td><td class="r">${m(i.total)}</td></tr>`).join('')}</tbody></table>
    <div class="totals"><table>
      <tr><td>${esc(t('tax.base'))}</td><td class="r">${m(inv.subtotal)}</td></tr>
      <tr><td>+ ${esc(t('tax.vat'))}</td><td class="r">+ ${m(inv.totalTax)}</td></tr>
      <tr class="grand"><td>${esc(t('tax.totalInc'))}</td><td class="r">${m(inv.total)}</td></tr>
      ${inv.paid > 0 && inv.paid < inv.total ? `<tr><td>${esc(t('billing.paid'))}</td><td class="r">${m(inv.paid)}</td></tr><tr><td class="b">${esc(t('billing.pending'))}</td><td class="r b">${m(inv.total - inv.paid)}</td></tr>` : ''}
    </table></div>
    <div class="muted"><b>${esc(t('pos.paymentMethod'))}:</b> ${esc(t('payment.' + inv.paymentMethod))} · <b>${esc(t('common.status'))}:</b> ${esc(t('invoiceStatus.' + inv.status))}</div>
    ${inv.notes ? `<div class="notes"><b>${esc(t('common.notes'))}:</b> ${esc(inv.notes)}</div>` : ''}
    <div class="foot">${esc(s.storeName)} · ${esc(s.cif)} · ${esc(s.email)}</div>
  </div>`;
  return `<style>
    @page { size: ${np?.paper === 'Letter' ? 'letter' : 'A4'}; margin: 14mm; }
    body { font-family: Helvetica, Arial, sans-serif; color: #1e293b; font-size: 12px; margin: 0; }
    .page { position: relative; page-break-after: always; min-height: 250mm; }
    .page:last-child { page-break-after: auto; }
    .head { display: flex; justify-content: space-between; gap: 20px; border-bottom: 3px solid ${color}; padding-bottom: 14px; }
    .store { font-size: 22px; font-weight: 800; color: ${color}; } .big { font-size: 26px; font-weight: 800; color: ${color}; letter-spacing: 1px; text-transform: uppercase; }
    .brand { width: 56px; height: 56px; object-fit: contain; margin-bottom: 4px; }
    .ttl { text-align: end; } .num { font-size: 15px; font-weight: 700; margin: 2px 0 6px; }
    .muted { color: #64748b; line-height: 1.5; } .b { font-weight: 700; } .r { text-align: end; }
    .cust { margin: 18px 0; padding: 12px 14px; background: #f8fafc; border-radius: 8px; border-inline-start: 4px solid ${color}; }
    .lbl { font-size: 10px; text-transform: uppercase; color: #64748b; letter-spacing: 1px; }
    table.items { width: 100%; border-collapse: collapse; margin-top: 8px; }
    table.items th { background: ${color}; color: #fff; padding: 8px; text-align: start; font-size: 11px; }
    table.items th.r { text-align: end; }
    table.items td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
    .totals { display: flex; justify-content: flex-end; margin: 14px 0; }
    .totals table { min-width: 260px; } .totals td { padding: 4px 8px; }
    .grand td { font-size: 15px; font-weight: 800; border-top: 2px solid ${color}; padding-top: 8px; color: ${color}; }
    .notes { margin-top: 12px; padding: 10px; border: 1px dashed #cbd5e1; border-radius: 6px; }
    .foot { position: absolute; bottom: 0; width: 100%; text-align: center; color: #94a3b8; font-size: 10px; border-top: 1px solid #e2e8f0; padding-top: 6px; }
    .wm { position: absolute; top: 40%; left: 0; right: 0; text-align: center; font-size: 90px; font-weight: 900; color: rgba(148,163,184,.15); transform: rotate(-25deg); pointer-events: none; }
  </style>${Array.from({ length: copies }, () => one).join('')}`;
}