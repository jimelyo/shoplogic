import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Mail, MessageCircle, Minus, Plus, Printer, ShoppingCart, Trash } from 'lucide-react';
import { db } from '../db/database';
import { toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { discountAmount, pad, round2, splitVat } from '../lib/calc';
import { makeMove } from '../lib/stock';
import { logAction } from '../lib/audit';
import { channelReady, type SendTarget } from '../lib/channels';
import { dispatchMessage, fallbackLink } from '../lib/messaging';
import { generateNotifications } from '../lib/notifications';
import { printHtml, saleTicketHtml } from '../lib/print';
import { DEFAULT_CATEGORIES, categoryLabel } from '../data/categories';
import { DEFAULT_AUTOMATIONS } from '../data/automations';
import type { ChannelId, PaymentMethod, Product, Sale } from '../types';
import { PAYMENT_METHODS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, Pill, SearchInput, ViewToggle, useViewMode } from './shared/UI';
import { Button, Select } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';
import { BarcodeScanner, ScanButton } from './BarcodeScanner';
import { SalesReturns } from './SalesReturns';

export function POS() {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const products = useLiveQuery(() => db.products.toArray(), []);
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const { cartItems, addToCart, updateQuantity, removeFromCart, clearCart } = useStore();
  const user = useStore((x) => x.currentUser);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [view, setView] = useViewMode('pos');
  const [customerId, setCustomerId] = useState<string>('');
  const [payment, setPayment] = useState<PaymentMethod>('cash');
  const [discMode, setDiscMode] = useState<'percent' | 'amount'>('percent');
  const [discValue, setDiscValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [history, setHistory] = useState(false);
  const [ticket, setTicket] = useState<Sale | null>(null);
  const cats = s.categories?.length ? s.categories : DEFAULT_CATEGORIES;

  const list = useMemo(() => (products ?? []).filter((p) => (cat === 'all' || p.category === cat) && matches(q, p.name, p.barcode, p.imei)), [products, q, cat]);
  const total = round2(cartItems.reduce((a, i) => a + i.product.price * i.quantity, 0));
  const discPct = discMode === 'percent' ? Math.min(Math.max(parseFloat(discValue.replace(',', '.')) || 0, 0), 100) : undefined;
  const disc = discountAmount(total, parseFloat(discValue.replace(',', '.')) || 0, discMode);
  const finalTotal = round2(total - disc);
  // Sending the receipt needs a customer on file: a walk-in sale has no contact.
  const ticketCustomer = ticket?.customerId ? customers?.find((c) => c.id === ticket.customerId) : undefined;
  const canSendWa = channelReady(s.channels, 'whatsapp') && !!ticketCustomer?.phone;
  const canSendMail = channelReady(s.channels, 'email') && !!ticketCustomer?.email;
  const sendReceipt = async (id: ChannelId) => {
    if (!ticket) return;
    const target: SendTarget = {
      contact: id === 'whatsapp' ? (ticketCustomer?.phone ?? '') : (ticketCustomer?.email ?? ''),
      customer: ticket.customerName ?? t('pos.walkIn'),
      reference: ticket.ticketNumber,
      detail: ticket.items.map((i) => `${i.quantity}× ${i.name}`).join(', '),
    };
    // Relay first; without a server running the deep link stays the fallback.
    const outcome = await dispatchMessage(s.channels!, s.storeName, id, target);
    if (outcome !== 'relay') window.open(fallbackLink(s.channels!, s.storeName, id, target), '_blank', 'noopener,noreferrer');
    logAction('send', 'pos', `${ticket.ticketNumber} · ${id} · ${outcome}`);
    if (outcome === 'relay') toast.success(t('channels.sentOk'));
    else if (outcome === 'failed') toast.warning(t('channels.sendQueued'));
  };
  const vat = splitVat(finalTotal, s.taxRate);
  const units = cartItems.reduce((a, i) => a + i.quantity, 0);
  const catOf = (id: string) => cats.find((c) => c.id === id);

  const add = (p: Product) => {
    if (p.stock <= 0) return;
    if (!addToCart(p)) toast.warning(t('pos.noMoreStock', { name: p.name }));
  };

  const onSearchEnter = () => {
    const exact = (products ?? []).find((p) => p.barcode && p.barcode === q.trim());
    if (exact) { add(exact); setQ(''); }
  };
  /** Camera scan: add the matching product right away, otherwise filter by the code. */
  const onScanned = (code: string) => {
    const value = code.trim();
    if (!value) return;
    const exact = (products ?? []).find((p) => (p.barcode && p.barcode === value) || (p.imei && p.imei === value));
    if (exact) { add(exact); setQ(''); toast.success(`📷 ${exact.name}`); }
    else { setQ(value); toast.warning(t('pos.scanNoMatch', { code: value })); }
    setScanning(false);
  };

  const checkout = async () => {
    if (!cartItems.length) return;
    setBusy(true);
    try {
      const customer = customerId ? customers?.find((c) => String(c.id) === customerId) : undefined;
      const loyaltyOn = s.automations?.sal_loyalty_points !== false;
      let earned = 0;
      const sale = await db.transaction('rw', db.products, db.sales, db.customers, db.stockMoves, async () => {
        for (const it of cartItems) {
          const p = await db.products.get(it.product.id!);
          if (!p || p.stock < it.quantity) throw new Error(t('pos.noMoreStock', { name: it.product.name }));
        }
        const last = await db.sales.toCollection().last();
        const n = last ? (parseInt(last.ticketNumber.replace(/\D/g, ''), 10) || last.id || 0) + 1 : 1;
        const ticketNumber = `T-${pad(n)}`;
        const now = new Date().toISOString();
        for (const it of cartItems) {
          const p = (await db.products.get(it.product.id!))!;
          await db.products.update(p.id!, { stock: p.stock - it.quantity });
          await db.stockMoves.add(makeMove(p, -it.quantity, 'sale', { reference: ticketNumber, timestamp: now }));
        }
        const sale: Sale = {
          ticketNumber,
          date: now,
          items: cartItems.map((i) => ({ productId: i.product.id!, name: i.product.name, category: i.product.category, quantity: i.quantity, price: i.product.price, cost: i.product.cost })),
          subtotal: vat.base, tax: vat.vat, total: finalTotal,
          discount: disc || undefined, discountPercent: discPct,
          paymentMethod: payment, customerId: customer?.id, customerName: customer?.name, userName: user?.name,
        };
        sale.id = await db.sales.add(sale);
        if (customer) {
          earned = loyaltyOn ? Math.floor(finalTotal / (s.loyaltyRate || 10)) : 0;
          await db.customers.update(customer.id!, {
            totalSpent: round2(customer.totalSpent + finalTotal),
            visits: customer.visits + 1,
            loyaltyPoints: (customer.loyaltyPoints ?? 0) + earned,
          });
        }
        return sale;
      });
      await logAction('sale', 'pos', `${sale.ticketNumber} · ${f.money(sale.total)} · ${t(`payment.${payment}`)}${disc ? ` · ${t('pos.discount')} −${f.money(disc)}` : ''}`);
      clearCart();
      setCustomerId('');
      setDiscValue('');
      setTicket(sale);
      toast.success(t('pos.saleDone', { ticket: sale.ticketNumber }));
      if (earned > 0) toast.info(`${t('clients.points')}: +${earned}`);
      generateNotifications().catch(() => undefined);
      // `sal_whatsapp_receipt`: auto-send the receipt when the automation and the
      // WhatsApp channel are ready; otherwise the ticket modal keeps its buttons.
      const waReceiptOn = (s.automations?.sal_whatsapp_receipt ?? DEFAULT_AUTOMATIONS.sal_whatsapp_receipt) === true;
      const contact = customer?.phone ?? '';
      if (waReceiptOn && contact && channelReady(s.channels, 'whatsapp')) {
        const target: SendTarget = {
          contact,
          customer: customer?.name ?? t('pos.walkIn'),
          reference: sale.ticketNumber,
          detail: sale.items.map((i) => `${i.quantity}× ${i.name}`).join(', '),
        };
        dispatchMessage(s.channels!, s.storeName, 'whatsapp', target).then((outcome) => {
          logAction('send', 'pos', `${sale.ticketNumber} · whatsapp · auto · ${outcome}`);
          if (outcome === 'relay') toast.success(t('channels.autoSent'));
          else if (outcome === 'failed') toast.warning(t('channels.sendQueued'));
        }).catch(() => undefined);
      }
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (!products || !customers) return <LoadingPage />;

  const stockBadge = (p: Product) => (
    <Badge color={p.stock <= 0 ? 'red' : p.stock <= p.minStock ? 'amber' : 'green'}>{p.stock <= 0 ? t('inventory.outOfStock') : `${t('common.stock')}: ${p.stock}`}</Badge>
  );

  return (
    <div>
      <PageHeader icon="🛒" title={t('nav.pos')} subtitle={t('pos.subtitle')} actions={<>
        <Button variant="secondary" icon={<History />} onClick={() => setHistory(true)}>{t('returns.open')}</Button>
        <ViewToggle value={view} onChange={setView} />
      </>} />
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-3">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1" onKeyDown={(e) => { if (e.key === 'Enter') onSearchEnter(); }}>
              <SearchInput value={q} onChange={setQ} placeholder={t('pos.searchPlaceholder')} className="[&_input]:h-11" autoFocus />
            </div>
            <ScanButton onClick={() => setScanning(true)} className="h-11 w-11" />
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            <Pill active={cat === 'all'} onClick={() => setCat('all')} count={products.length}>🏷️ {t('common.all')}</Pill>
            {cats.map((c) => (
              <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} count={products.filter((p) => p.category === c.id).length}>{c.icon} {categoryLabel(c, t)}</Pill>
            ))}
          </div>
          {list.length === 0 ? <Card><EmptyState icon="🔍" title={t('common.noResults')} /></Card> : view === 'cards' ? (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
              {list.map((p) => {
                const out = p.stock <= 0;
                const inCart = cartItems.find((i) => i.product.id === p.id)?.quantity;
                return (
                  <button key={p.id} type="button" disabled={out} onClick={() => add(p)}
                    className={`group relative flex flex-col rounded-xl border bg-sl-card p-3 text-start shadow-sm animate-slide-up ${out ? 'cursor-not-allowed border-sl-border opacity-40 grayscale' : 'border-sl-border hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md active:scale-[.98]'}`}
                    style={{ transitionProperty: 'transform, box-shadow, border-color, background-color', transitionDuration: '150ms' }}>
                    {inCart ? <span className="absolute end-2 top-2 flex size-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-white shadow">{inCart}</span> : null}
                    <div className="mb-2 flex h-16 items-center justify-center rounded-lg bg-sl-hover text-4xl">{catOf(p.category)?.icon ?? '📦'}</div>
                    <div className="line-clamp-2 min-h-[2.5rem] text-sm font-semibold leading-tight text-sl-text">{p.name}</div>
                    <div className="mt-1 text-lg font-extrabold text-primary">{f.money(p.price)}</div>
                    <div className="mt-1 flex flex-wrap items-center gap-1">
                      <Badge color="indigo" className="!text-[9px]">{t('tax.included')}</Badge>
                      {stockBadge(p)}
                    </div>
                  </button>
                );
              })}
            </div>
          ) : (
            <DataTable
              data={list}
              rowKey={(p) => p.id!}
              onRowClick={(p) => add(p)}
              rowClassName={(p) => (p.stock <= 0 ? 'opacity-40 pointer-events-none' : '')}
              minWidth={560}
              columns={[
                { key: 'icon', label: '', sortable: false, render: (p) => <span className="text-xl">{catOf(p.category)?.icon ?? '📦'}</span>, className: 'w-10' },
                { key: 'name', label: t('common.product'), render: (p) => <span className="font-semibold">{p.name}</span> },
                { key: 'barcode', label: t('inventory.barcode'), render: (p) => <span className="font-mono text-xs text-sl-muted">{p.barcode || '—'}</span> },
                { key: 'price', label: t('common.price'), render: (p) => <span className="font-bold text-primary">{f.money(p.price)} <Badge color="indigo" className="!text-[9px]">{t('tax.included')}</Badge></span> },
                { key: 'stock', label: t('common.stock'), render: stockBadge },
              ]}
            />
          )}
        </div>

        <Card className="flex h-fit flex-col xl:sticky xl:top-20">
          <div className="flex items-center justify-between border-b border-sl-border px-4 py-3">
            <h3 className="flex items-center gap-2 font-bold text-sl-text"><ShoppingCart className="size-5 text-primary" /> {t('pos.cart')} <Badge color="indigo">{units}</Badge></h3>
            {cartItems.length > 0 && <Button size="sm" variant="ghost" onClick={() => { clearCart(); setDiscValue(''); }}>{t('pos.clear')}</Button>}
          </div>
          <div className="max-h-[42vh] min-h-[120px] overflow-y-auto px-2 py-2">
            {cartItems.length === 0 ? <EmptyState icon="🛒" title={t('pos.emptyCart')} hint={t('pos.emptyCartHint')} /> : cartItems.map((i) => (
              <div key={i.product.id} className="flex items-center gap-2 rounded-lg px-2 py-2 hover:bg-sl-hover">
                <span className="text-xl">{catOf(i.product.category)?.icon ?? '📦'}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold text-sl-text">{i.product.name}</div>
                  <div className="text-xs text-sl-muted">{f.money(i.product.price)} × {i.quantity} = <b className="text-sl-text">{f.money(i.product.price * i.quantity)}</b></div>
                </div>
                <div className="flex items-center rounded-lg border border-sl-border">
                  <button type="button" className="p-1.5 text-sl-muted hover:text-sl-text" onClick={() => updateQuantity(i.product.id!, -1)}><Minus className="size-3.5" /></button>
                  <span className="w-7 text-center text-sm font-bold text-sl-text">{i.quantity}</span>
                  <button type="button" className="p-1.5 text-sl-muted hover:text-sl-text" onClick={() => { if (!updateQuantity(i.product.id!, 1)) toast.warning(t('pos.noMoreStock', { name: i.product.name })); }}><Plus className="size-3.5" /></button>
                </div>
                <button type="button" className="rounded p-1.5 text-sl-muted hover:bg-red-500/10 hover:text-red-500" onClick={() => removeFromCart(i.product.id!)}><Trash className="size-4" /></button>
              </div>
            ))}
          </div>
          <div className="space-y-3 border-t border-sl-border p-4">
            <Select label={t('common.customer')} value={customerId} onChange={(e) => setCustomerId(e.target.value)}>
              <option value="">👤 {t('pos.walkIn')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
            </Select>
            <div>
              <span className="mb-1 block text-xs font-semibold text-sl-muted">{t('pos.paymentMethod')}</span>
              <div className="grid grid-cols-4 gap-1.5">
                {PAYMENT_METHODS.map((m) => (
                  <button key={m.id} type="button" onClick={() => setPayment(m.id)}
                    className={`flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[11px] font-semibold ${payment === m.id ? 'border-primary bg-primary/10 text-primary' : 'border-sl-border text-sl-muted hover:border-primary/40'}`}>
                    <span className="text-lg">{m.icon}</span>{t(`payment.${m.id}`)}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <span className="mb-1 block text-xs font-semibold text-sl-muted">{t('pos.discount')}</span>
              <div className="flex gap-1.5">
                <div className="flex overflow-hidden rounded-lg border border-sl-border">
                  {(['percent', 'amount'] as const).map((m) => (
                    <button key={m} type="button" onClick={() => setDiscMode(m)}
                      className={`w-10 text-sm font-bold ${discMode === m ? 'bg-primary text-white' : 'bg-sl-card text-sl-muted hover:bg-sl-hover'}`}>
                      {m === 'percent' ? '%' : s.currencySymbol}
                    </button>
                  ))}
                </div>
                <input
                  type="number" inputMode="decimal" min={0} max={discMode === 'percent' ? 100 : undefined} step="0.01"
                  value={discValue} onChange={(e) => setDiscValue(e.target.value)}
                  placeholder={discMode === 'percent' ? '0 – 100' : `0 – ${Math.round(total * 100) / 100}`}
                  className="h-9 min-w-0 flex-1 rounded-lg border border-sl-border bg-sl-input px-3 text-sm text-sl-text outline-none focus:border-primary"
                />
              </div>
            </div>
            <div className="space-y-1 rounded-xl bg-sl-hover p-3 text-sm">
              {disc > 0 && (
                <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                  <span>{t('pos.discount')}{discPct !== undefined ? ` (${discPct} %)` : ''}</span>
                  <span>−{f.money(disc)}</span>
                </div>
              )}
              <div className="flex justify-between text-sl-muted"><span>{t('tax.base')}</span><span>{f.money(vat.base)}</span></div>
              <div className="flex justify-between text-sl-muted"><span>{t('tax.vatIncluded')} ({s.taxRate}%)</span><span>{f.money(vat.vat)}</span></div>
              <div className="flex justify-between border-t border-sl-border pt-1.5 text-lg font-extrabold text-sl-text"><span>{t('tax.totalWithVat')}</span><span className="text-primary">{f.money(total)}</span></div>
            </div>
            <Button size="lg" variant="success" className="w-full" disabled={!cartItems.length} loading={busy} onClick={checkout}>💳 {t('pos.checkout')} · {f.money(finalTotal)}</Button>
          </div>
        </Card>
      </div>

      <Modal open={!!ticket} onClose={() => setTicket(null)} size="sm" title={`🧾 ${t('pos.ticket')} ${ticket?.ticketNumber ?? ''}`}
        footer={<>
          <Button variant="secondary" onClick={() => setTicket(null)}>{t('common.close')}</Button>
          {canSendWa && <Button variant="success" icon={<MessageCircle />} onClick={() => { void sendReceipt('whatsapp'); }}>{t('channels.sendWhatsApp')}</Button>}
          {canSendMail && <Button variant="secondary" icon={<Mail />} onClick={() => { void sendReceipt('email'); }}>{t('channels.sendEmail')}</Button>}
          <Button icon={<Printer />} onClick={() => { if (ticket) { printHtml(saleTicketHtml(ticket, s, t), ticket.ticketNumber); logAction('print', 'pos', ticket.ticketNumber); } }}>{t('common.print')}</Button>
        </>}>
        {ticket && <TicketPreview sale={ticket} />}
      </Modal>
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)} onCode={onScanned} />
      <SalesReturns open={history} onClose={() => setHistory(false)} />
    </div>
  );
}

export function TicketPreview({ sale }: { sale: Sale }) {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const v = splitVat(sale.total, s.taxRate);
  return (
    <div className="mx-auto max-w-[300px] rounded-lg border border-dashed border-sl-border bg-white p-4 font-mono text-xs text-slate-900 shadow-inner">
      {s.logo ? <img src={s.logo} alt="" className="mx-auto mb-1 max-h-12 object-contain" /> : <div className="text-center text-2xl">📱</div>}
      <div className="text-center text-sm font-bold">{s.ticketPrinter?.header || s.storeName}</div>
      <div className="text-center text-[11px] text-slate-600">{t('settings.cif')}: {s.cif}<br />{s.address}<br />{t('common.phone')}: {s.phone}</div>
      <hr className="my-2 border-dashed border-slate-400" />
      <div>{t('pos.ticket')}: <b>{sale.ticketNumber}</b></div>
      <div>{t('common.date')}: {f.dateTime(sale.date)}</div>
      {sale.customerName && <div>{t('common.customer')}: {sale.customerName}</div>}
      <div>{t('pos.paymentMethod')}: {t(`payment.${sale.paymentMethod}`)}</div>
      <hr className="my-2 border-dashed border-slate-400" />
      {sale.items.map((i, idx) => (
        <div key={idx} className="flex justify-between gap-2"><span className="truncate">{i.quantity} x {i.name}</span><span>{f.money(i.price * i.quantity)}</span></div>
      ))}
      {!!sale.discount && (
        <div className="mt-1 flex justify-between font-bold text-red-600"><span>{t('pos.discount')}{sale.discountPercent ? ` (${sale.discountPercent} %)` : ''}</span><span>−{f.money(sale.discount)}</span></div>
      )}
      <hr className="my-2 border-dashed border-slate-400" />
      <div className="flex justify-between"><span>{t('tax.base')}</span><span>{f.money(v.base)}</span></div>
      <div className="flex justify-between"><span>{t('tax.vat')} ({s.taxRate}%)</span><span>{f.money(v.vat)}</span></div>
      <div className="flex justify-between text-sm font-bold"><span>{t('tax.totalInc')}</span><span>{f.money(v.total)}</span></div>
      <hr className="my-2 border-dashed border-slate-400" />
      <div className="text-center text-[11px] text-slate-600">{s.ticketFooter}</div>
    </div>
  );
}