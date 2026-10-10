import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { FilePlus2, Pencil, Plus, Printer, ShoppingCart, Trash, Wrench } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { round2, splitVat } from '../lib/calc';
import { makeMove } from '../lib/stock';
import { logAction } from '../lib/audit';
import { printHtml, quoteHtml } from '../lib/print';
import { quoteSchema, validateForm, type FormErrors } from '../schemas';
import type { Quote, QuoteStatus } from '../types';
import { QUOTE_STATUSES, QUOTE_STATUS_ICONS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, Pill, SearchInput, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea, fieldClass } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

const nowIso = () => new Date().toISOString();

type QForm = {
  customerName: string; customerPhone: string; customerEmail: string; customerId: string;
  device: string; imei: string; kind: 'sale' | 'repair'; problem: string;
  expiresAt: string; notes: string; items: { name: string; quantity: string; price: string }[];
};
const emptyForm = (): QForm => ({
  customerName: '', customerPhone: '', customerEmail: '', customerId: '',
  device: '', imei: '', kind: 'sale', problem: '', expiresAt: '', notes: '',
  items: [{ name: '', quantity: '1', price: '' }],
});

export const QUOTE_STATUS_COLORS: Record<QuoteStatus, 'slate' | 'blue' | 'green' | 'red' | 'amber' | 'indigo'> = {
  draft: 'slate', sent: 'blue', accepted: 'green', rejected: 'red', expired: 'amber', converted: 'indigo',
};

export function QuoteStatusBadge({ status }: { status: QuoteStatus }) {
  const { t } = useTranslation();
  return <Badge color={QUOTE_STATUS_COLORS[status]}>{QUOTE_STATUS_ICONS[status]} {t(`quoteStatus.${status}`)}</Badge>;
}

/** True when `expiresAt` is in the past and the quote is still actionable. */
export const quoteExpired = (q: Quote) => !!q.expiresAt && q.expiresAt < nowIso() && (q.status === 'draft' || q.status === 'sent');

export function Quotes() {
  const { t } = useTranslation();
  const f = useFormat();
  const user = useStore((x) => x.currentUser);
  const quotes = useLiveQuery(() => db.quotes.reverse().sortBy('createdAt'), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<QuoteStatus | 'all'>('all');
  const [view, setView] = useViewMode('quotes');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Quote | null>(null);
  const [form, setForm] = useState<QForm>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [detail, setDetail] = useState<Quote | null>(null);
  const [busy, setBusy] = useState(false);

  const effStatus = (x: Quote): QuoteStatus => (quoteExpired(x) ? 'expired' : x.status);
  const list = useMemo(() => (quotes ?? []).filter((x) =>
    (status === 'all' || effStatus(x) === status) && matches(q, x.number, x.customerName, x.customerPhone, x.device)), [quotes, q, status]);
  if (!quotes) return <LoadingPage />;

  const openNew = () => { setEditing(null); setForm(emptyForm()); setErrors({}); setOpen(true); };
  const openEdit = (x: Quote) => {
    setEditing(x);
    setForm({
      customerName: x.customerName, customerPhone: x.customerPhone ?? '', customerEmail: x.customerEmail ?? '',
      customerId: x.customerId ? String(x.customerId) : '', device: x.device ?? '', imei: x.imei ?? '',
      kind: x.kind, problem: x.problem ?? '', expiresAt: x.expiresAt?.slice(0, 10) ?? '', notes: x.notes ?? '',
      items: x.items.map((i) => ({ name: i.name, quantity: String(i.quantity), price: String(i.price) })),
    });
    setErrors({}); setOpen(true);
  };

  const lines = () => form.items
    .filter((l) => l.name.trim())
    .map((l) => ({ name: l.name.trim(), quantity: Math.max(1, Number(l.quantity) || 1), price: Math.max(0, Number(l.price) || 0) }));
  const liveTotal = round2(lines().reduce((a, l) => a + l.quantity * l.price, 0));

  const save = async () => {
    const items = lines();
    if (!items.length) { setErrors({ items: 'validation.minItems' }); toast.warning(t('validation.minItems')); return; }
    const r = validateForm(quoteSchema, { ...form, items, total: liveTotal });
    setErrors(r.errors);
    if (!r.success) return;
    const d = r.data;
    const total = round2(d.items.reduce((a, i) => a + i.quantity * i.price, 0));
    const payloads = {
      customerName: d.customerName, customerPhone: d.customerPhone || undefined, customerEmail: d.customerEmail || undefined,
      customerId: form.customerId ? Number(form.customerId) : undefined,
      device: d.device || undefined, imei: d.imei || undefined, problem: d.problem || undefined,
      kind: d.kind, items: d.items, total: total, date: new Date().toISOString().slice(0, 10),
      expiresAt: d.expiresAt ? `${d.expiresAt}T23:59:59` : undefined,
      notes: d.notes || undefined,
    };
    if (editing) {
      await db.quotes.update(editing.id!, payloads);
      await logAction('update', 'quotes', editing.number);
      toast.success(t('common.updated'));
    } else {
      const last = await db.quotes.orderBy('number').last();
      const n = last ? (parseInt(last.number.replace(/\D/g, ''), 10) || 0) + 1 : 1;
      const number = `Q-${String(n).padStart(6, '0')}`;
      await db.quotes.add({ ...payloads, number, status: 'draft', userName: user?.name, createdAt: nowIso() });
      await logAction('create', 'quotes', `${number} · ${f.money(total)}`);
      toast.success(t('quotes.created', { number }));
    }
    setOpen(false);
  };

  const changeStatus = async (x: Quote, st: QuoteStatus) => {
    await db.quotes.update(x.id!, { status: st });
    await logAction('status_change', 'quotes', `${x.number}: → ${st}`);
    if (detail?.id === x.id) setDetail({ ...x, status: st });
    toast.success(`${x.number} → ${t(`quoteStatus.${st}`)}`);
  };

  /** Converts an accepted quote into a real sale (deducting stock) with one click. */
  const convertToSale = async (x: Quote) => {
    setBusy(true);
    try {
      const products = await db.products.toArray();
      const stockable = x.items.map((i) => ({ line: i, product: products.find((p) => p.name === i.name) }));
      const missing = stockable.filter((s) => s.product && s.product.stock < s.line.quantity);
      if (missing.length) { toast.warning(t('quotes.noStockFor', { names: missing.map((m) => m.line.name).join(', ') })); return; }
      const customer = x.customerId ? await db.customers.get(x.customerId) : undefined;
      const sale = await db.transaction('rw', db.products, db.sales, db.customers, db.stockMoves, db.quotes, async () => {
        const last = await db.sales.toCollection().last();
        const n = last ? (parseInt(last.ticketNumber.replace(/\D/g, ''), 10) || 0) + 1 : 1;
        const ticketNumber = `T-${String(n).padStart(6, '0')}`;
        const now = nowIso();
        for (const { line, product } of stockable) {
          if (!product) continue; // ad-hoc lines (e.g. service labor) don't touch stock
          await db.products.update(product.id!, { stock: product.stock - line.quantity });
          await db.stockMoves.add(makeMove(product, -line.quantity, 'sale', { reference: ticketNumber, timestamp: now }));
        }
        const sum = round2(x.total);
        const v = splitVat(sum, f.settings.taxRate);
        const sale = {
          ticketNumber, date: now,
          items: x.items.map((i) => ({ productId: stockable.find((s) => s.line.name === i.name)?.product?.id ?? 0, name: i.name, category: 'other', quantity: i.quantity, price: i.price, cost: stockable.find((s) => s.line.name === i.name)?.product?.cost ?? 0 })),
          subtotal: v.base, tax: v.vat, total: sum,
          paymentMethod: 'cash' as const,
          customerId: x.customerId, customerName: x.customerName, userName: user?.name,
        };
        const saleId = await db.sales.add(sale);
        if (customer) {
          await db.customers.update(customer.id!, { totalSpent: round2(customer.totalSpent + sum), visits: customer.visits + 1 });
        }
        await db.quotes.update(x.id!, { status: 'converted', convertedToSaleId: saleId });
        return { ...sale, id: saleId };
      });
      await logAction('sale', 'quotes', `${x.number} → ${sale.ticketNumber}`);
      toast.success(t('quotes.convertedSale', { ticket: sale.ticketNumber }));
      setDetail(null);
    } finally { setBusy(false); }
  };

  /** Converts into a repair ticket pre-filled with device/problem/cost. */
  const convertToRepair = async (x: Quote) => {
    setBusy(true);
    try {
      const last = await db.repairs.toCollection().last();
      const n = last ? (parseInt(last.ticketNumber.replace(/\D/g, ''), 10) || 0) + 1 : 1;
      const now = nowIso();
      const rep = {
        ticketNumber: `R-${String(n).padStart(6, '0')}`,
        dateIn: now, createdAt: now,
        customerName: x.customerName, customerPhone: x.customerPhone ?? '', customerEmail: x.customerEmail,
        customerId: x.customerId, device: x.device ?? '—', imei: x.imei ?? '',
        problem: x.problem ?? x.items.map((i) => i.name).join(', '),
        diagnosis: '', notes: x.notes ?? `← ${x.number}`,
        status: 'received' as const, estimatedCost: round2(x.total),
      };
      const repairId = await db.repairs.add(rep);
      await db.quotes.update(x.id!, { status: 'converted', convertedToRepairId: repairId });
      await logAction('create', 'quotes', `${x.number} → ${rep.ticketNumber}`);
      toast.success(t('quotes.convertedRepair', { ticket: rep.ticketNumber }));
      setDetail(null);
    } finally { setBusy(false); }
  };

  const remove = async (x: Quote) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: x.number }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.quotes.delete(x.id!);
    await logAction('delete', 'quotes', x.number);
    toast.success(t('common.deleted'));
  };

  const print = (x: Quote) => { printHtml(quoteHtml(x, f.settings, t), x.number); logAction('print', 'quotes', x.number); };

  const totalOf = (x: Quote) => {
    const v = splitVat(x.total, f.settings.taxRate);
    return <div className="leading-tight"><div className="font-bold">{f.money(v.total)}</div><div className="text-[10px] text-sl-muted">{f.money(v.base)} + {f.money(v.vat)} {t('tax.vat')}</div></div>;
  };

  const actions = (x: Quote) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('common.view')} onClick={() => setDetail(x)}><FilePlus2 /></IconButton>
      {x.status !== 'converted' && x.status !== 'rejected' && <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(x)}><Pencil /></IconButton>}
      {x.status !== 'converted' && <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(x)}><Trash /></IconButton>}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="📋" title={t('nav.quotes')} subtitle={t('quotes.subtitle')}
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('quotes.new')}</Button></>} />

      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={status === 'all'} onClick={() => setStatus('all')} count={quotes.length}>📋 {t('common.all')}</Pill>
        {QUOTE_STATUSES.map((st) => (
          <Pill key={st} active={status === st} onClick={() => setStatus(st)} count={quotes.filter((x) => effStatus(x) === st).length}>
            {QUOTE_STATUS_ICONS[st]} {t(`quoteStatus.${st}`)}
          </Pill>
        ))}
      </div>
      <div className="flex items-center gap-2"><SearchInput value={q} onChange={setQ} placeholder={t('quotes.searchPlaceholder')} /></div>

      {list.length === 0 ? <Card><EmptyState icon="📋" title={t('common.noResults')} action={<Button size="sm" icon={<Plus />} onClick={openNew}>{t('quotes.new')}</Button>} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((x) => (
            <Card key={x.id} className="flex flex-col p-4 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs font-bold text-primary">{x.number}</div>
                  <div className="mt-0.5 text-base font-bold text-sl-text">👤 {x.customerName}</div>
                </div>
                <QuoteStatusBadge status={effStatus(x)} />
              </div>
              <div className="mt-2 text-xs text-sl-muted">
                {x.kind === 'repair' ? <><Wrench className="inline size-3.5" /> {t('quotes.kindRepair')}{x.device ? ` · ${x.device}` : ''}</> : <><ShoppingCart className="inline size-3.5" /> {t('quotes.kindSale')}</>}
              </div>
              <div className="mt-1 text-[11px] text-sl-muted">📅 {f.date(x.date)}{x.expiresAt ? ` · ⏰ ${f.date(x.expiresAt)}` : ''}</div>
              <div className="mt-3 flex items-end justify-between gap-2 rounded-lg bg-sl-hover p-2">
                <div className="text-xs text-sl-muted">{t('purchases.lines', { count: x.items.length })}</div>
                {totalOf(x)}
              </div>
              <div className="mt-2 border-t border-sl-border pt-2">{actions(x)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(x) => x.id!} onRowClick={(x) => setDetail(x)} minWidth={900}
          columns={[
            { key: 'number', label: t('quotes.number'), render: (x) => <span className="font-mono text-xs font-bold text-primary">{x.number}</span> },
            { key: 'customerName', label: t('common.customer'), render: (x) => <div><div className="font-semibold">{x.customerName}</div><div className="text-[11px] text-sl-muted">{x.customerPhone}</div></div> },
            { key: 'date', label: t('common.date'), render: (x) => f.date(x.date) },
            { key: 'kind', label: t('quotes.kind'), render: (x) => (x.kind === 'repair' ? `🔧 ${t('quotes.kindRepair')}` : `🛒 ${t('quotes.kindSale')}`) },
            { key: 'status', label: t('common.status'), render: (x) => <QuoteStatusBadge status={effStatus(x)} />, sortValue: (x) => QUOTE_STATUSES.indexOf(effStatus(x)) },
            { key: 'total', label: t('common.total'), render: totalOf },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? `✏️ ${editing.number}` : `➕ ${t('quotes.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Input label={t('common.name')} requiredMark value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} error={errors.customerName} />
            <Input label={t('common.phone')} value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} />
            <Input label={t('common.email')} type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} error={errors.customerEmail} />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label={t('quotes.kind')} requiredMark value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as 'sale' | 'repair' })}>
              <option value="sale">🛒 {t('quotes.kindSale')}</option>
              <option value="repair">🔧 {t('quotes.kindRepair')}</option>
            </Select>
            <Input label={t('repairs.device')} value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} />
            <Input label="IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
          </div>
          {form.kind === 'repair' && <TextArea label={t('repairs.problem')} value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} />}
          <div>
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">📦 {t('quotes.items')}</div>
            <div className="space-y-2">
              {form.items.map((line, idx) => (
                <div key={idx} className="flex gap-2">
                  <input className={`${fieldClass(!!errors[`items.${idx}.name`])} min-w-0 flex-1`} placeholder={t('common.description')} value={line.name} onChange={(e) => setForm({ ...form, items: form.items.map((l, i) => (i === idx ? { ...l, name: e.target.value } : l)) })} />
                  <input type="number" min="1" step="1" className={`${fieldClass()} w-20`} placeholder="1" value={line.quantity} onChange={(e) => setForm({ ...form, items: form.items.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)) })} />
                  <input type="number" min="0" step="0.01" className={`${fieldClass()} w-28`} placeholder="0.00" value={line.price} onChange={(e) => setForm({ ...form, items: form.items.map((l, i) => (i === idx ? { ...l, price: e.target.value } : l)) })} />
                  <IconButton title={t('common.delete')} tone="danger" disabled={form.items.length <= 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash /></IconButton>
                </div>
              ))}
              <Button size="sm" variant="outline" icon={<Plus />} onClick={() => setForm({ ...form, items: [...form.items, { name: '', quantity: '1', price: '' }] })}>{t('purchases.addItem')}</Button>
            </div>
            <div className="mt-2 text-end text-sm text-sl-muted">{t('common.total')}: <b className="text-lg text-primary">{f.money(liveTotal)}</b></div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('quotes.expiresAt')} type="date" value={form.expiresAt} onChange={(e) => setForm({ ...form, expiresAt: e.target.value })} />
            <TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={detail ? `📋 ${detail.number}` : ''}
        footer={detail && <>
          <Button variant="secondary" icon={<Printer />} onClick={() => print(detail)}>{t('common.print')}</Button>
          {detail.status !== 'converted' && <>
            <Button variant="outline" onClick={() => changeStatus(detail, 'sent')}>📤 {t('quoteStatus.sent')}</Button>
            {effStatus(detail) !== 'accepted' && <Button variant="success" onClick={() => changeStatus(detail, 'accepted')}>✅ {t('quoteStatus.accepted')}</Button>}
            {detail.status !== 'rejected' && <Button variant="ghost" onClick={() => changeStatus(detail, 'rejected')}>❌ {t('quoteStatus.rejected')}</Button>}
          </>}
          {detail.status === 'accepted' && <>
            <Button variant="success" icon={<ShoppingCart />} loading={busy} onClick={() => convertToSale(detail)}>{t('quotes.convertSale')}</Button>
            <Button variant="secondary" icon={<Wrench />} loading={busy} onClick={() => convertToRepair(detail)}>{t('quotes.convertRepair')}</Button>
          </>}
        </>}>
        {detail && (
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <QuoteStatusBadge status={effStatus(detail)} />
              <Badge color="indigo">{detail.kind === 'repair' ? `🔧 ${t('quotes.kindRepair')}` : `🛒 ${t('quotes.kindSale')}`}</Badge>
            </div>
            <div className="grid gap-2 text-sm">
              <div><b>{t('common.customer')}:</b> {detail.customerName}{detail.customerPhone ? ` · ${detail.customerPhone}` : ''}</div>
              {detail.device && <div><b>{t('repairs.device')}:</b> {detail.device}{detail.imei ? ` · IMEI ${detail.imei}` : ''}</div>}
              {detail.problem && <div><b>{t('repairs.problem')}:</b> {detail.problem}</div>}
              <div><b>{t('common.date')}:</b> {f.date(detail.date)}{detail.expiresAt ? ` · ${t('quotes.expiresAt')}: ${f.date(detail.expiresAt)}` : ''}</div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-sl-border">
              <table className="w-full min-w-[360px] text-sm">
                <thead className="bg-sl-card2 text-[11px] uppercase text-sl-muted"><tr><th className="px-3 py-2 text-start">{t('common.description')}</th><th className="px-3 py-2 text-end">{t('billing.qty')}</th><th className="px-3 py-2 text-end">{t('common.price')}</th><th className="px-3 py-2 text-end">{t('common.total')}</th></tr></thead>
                <tbody>
                  {detail.items.map((it, i) => (
                    <tr key={i} className="border-t border-sl-border">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2 text-end font-mono">{it.quantity}</td>
                      <td className="px-3 py-2 text-end">{f.money(it.price)}</td>
                      <td className="px-3 py-2 text-end font-semibold">{f.money(it.quantity * it.price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {detail.notes && <div className="rounded-lg bg-sl-hover p-3 text-sm"><b>{t('common.notes')}:</b> {detail.notes}</div>}
          </div>
        )}
      </Modal>
    </div>
  );
}
