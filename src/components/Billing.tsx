import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from 'date-fns';
import { Download, Eye, Pencil, Plus, Printer, Trash, Wallet } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { computeInvoiceTotals, isoDate, lineTotal, priceFromTotal, round2 } from '../lib/calc';
import { logAction } from '../lib/audit';
import { INVOICE_STATUS_COLORS, cssVar } from '../lib/colors';
import { createInvoiceFromRepair, createInvoiceFromSale, nextInvoiceNumber, peekInvoiceNumber } from '../lib/invoices';
import { markOverdueInvoices } from '../lib/notifications';
import { invoiceHtml, printHtml } from '../lib/print';
import { invoicePdf } from '../lib/pdf';
import { invoiceSchema, validateForm, type FormErrors } from '../schemas';
import type { Invoice, InvoiceStatus, PaymentMethod } from '../types';
import { INVOICE_STATUSES, INVOICE_STATUS_ICONS, PAYMENT_METHODS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, InfoRow, Pill, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea, fieldClass } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type ItemForm = { description: string; quantity: string; price: string; taxRate: string; total: string };
type IForm = {
  customerName: string; customerDni: string; customerAddress: string; customerEmail: string; date: string; dueDate: string;
  status: InvoiceStatus; paymentMethod: PaymentMethod; notes: string; items: ItemForm[];
};

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const { t } = useTranslation();
  return <Badge color={INVOICE_STATUS_COLORS[status]}>{INVOICE_STATUS_ICONS[status]} {t(`invoiceStatus.${status}`)}</Badge>;
}

export function Billing() {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const invoices = useLiveQuery(() => db.invoices.reverse().sortBy('createdAt'), []);
  const sales = useLiveQuery(() => db.sales.toArray(), []);
  const repairs = useLiveQuery(() => db.repairs.toArray(), []);
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<InvoiceStatus | 'all'>('all');
  const [view, setView] = useViewMode('billing', 'table');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Invoice | null>(null);
  const [form, setForm] = useState<IForm | null>(null);
  const [errors, setErrors] = useState<FormErrors>({});
  const [preview, setPreview] = useState<Invoice | null>(null);
  const [payFor, setPayFor] = useState<Invoice | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [quickOpen, setQuickOpen] = useState<'sales' | 'repairs' | null>(null);

  useEffect(() => {
    markOverdueInvoices().then((n) => { if (n) toast.warning(t('billing.overdueDetected', { count: n })); }).catch(() => undefined);
  }, [t]);

  const list = useMemo(() => (invoices ?? []).filter((i) => (status === 'all' || i.status === status) && matches(q, i.number, i.customerName, i.customerDni, i.customerEmail)), [invoices, q, status]);
  if (!invoices || !sales || !repairs || !customers) return <LoadingPage />;

  const active = invoices.filter((i) => i.status !== 'cancelled' && i.status !== 'draft');
  const sum = {
    total: round2(active.reduce((a, i) => a + i.total, 0)),
    paid: round2(active.reduce((a, i) => a + i.paid, 0)),
    pending: round2(active.filter((i) => i.status !== 'overdue').reduce((a, i) => a + (i.total - i.paid), 0)),
    overdue: round2(active.filter((i) => i.status === 'overdue').reduce((a, i) => a + (i.total - i.paid), 0)),
  };
  const unbilledSales = sales.filter((x) => !invoices.some((i) => i.saleId === x.id)).sort((a, b) => b.date.localeCompare(a.date));
  const unbilledRepairs = repairs.filter((r) => ['completed', 'delivered'].includes(r.status) && !invoices.some((i) => i.repairId === r.id));

  const blankItem = (): ItemForm => ({ description: '', quantity: '1', price: '', taxRate: String(s.taxRate), total: '' });
  const openNew = () => {
    setEditing(null);
    setForm({ customerName: '', customerDni: '', customerAddress: '', customerEmail: '', date: isoDate(), dueDate: isoDate(addDays(new Date(), s.invoiceDefaultDueDays)), status: s.invoiceDefaultStatus, paymentMethod: s.invoiceDefaultPaymentMethod, notes: s.invoiceDefaultNotes ?? '', items: [blankItem()] });
    setErrors({}); setOpen(true);
  };
  const openEdit = (i: Invoice) => {
    setEditing(i);
    setForm({ customerName: i.customerName, customerDni: i.customerDni, customerAddress: i.customerAddress, customerEmail: i.customerEmail, date: i.date, dueDate: i.dueDate, status: i.status, paymentMethod: i.paymentMethod, notes: i.notes ?? '',
      items: i.items.map((it) => ({ description: it.description, quantity: String(it.quantity), price: String(it.price), taxRate: String(it.taxRate), total: String(it.total) })) });
    setErrors({}); setOpen(true);
  };
  const setItem = (idx: number, field: keyof ItemForm, value: string) => {
    if (!form) return;
    const items = form.items.map((it, i) => {
      if (i !== idx) return it;
      const n = { ...it, [field]: value };
      const qn = Number(n.quantity) || 0; const rate = Number(n.taxRate) || 0;
      if (field === 'total') n.price = value === '' ? '' : String(priceFromTotal(Number(value) || 0, qn, rate));
      else if (n.price !== '') n.total = String(lineTotal(qn, Number(n.price) || 0, rate));
      return n;
    });
    setForm({ ...form, items });
  };
  const pickCustomer = (id: string) => {
    const c = customers.find((x) => String(x.id) === id);
    if (c && form) setForm({ ...form, customerName: c.name, customerDni: c.dni ?? '', customerAddress: c.address ?? '', customerEmail: c.email ?? '' });
  };
  const liveTotals = form ? computeInvoiceTotals(form.items.map((it) => ({ description: it.description, quantity: Number(it.quantity) || 0, price: Number(it.price) || 0, taxRate: Number(it.taxRate) || 0, total: Number(it.total) || 0 }))) : null;

  const save = async () => {
    if (!form) return;
    const r = validateForm(invoiceSchema, form);
    setErrors(r.errors);
    if (!r.success) { if (r.errors.items) toast.warning(t('validation.minItems')); return; }
    const d = r.data;
    const items = d.items.map((it) => ({ ...it, total: round2(it.total || lineTotal(it.quantity, it.price, it.taxRate)) }));
    const totals = computeInvoiceTotals(items);
    const paid = d.status === 'paid' ? totals.total : editing ? Math.min(editing.paid, totals.total) : 0;
    const payload = { ...d, customerEmail: d.customerEmail || '', items, ...totals, paid };
    if (editing) {
      await db.invoices.update(editing.id!, payload);
      await logAction('update', 'billing', editing.number);
      toast.success(t('common.updated'));
    } else {
      const number = await nextInvoiceNumber(new Date(d.date));
      await db.invoices.add({ ...payload, number, createdAt: new Date().toISOString() });
      await logAction('create', 'billing', `${number} · ${f.money(totals.total)}`);
      toast.success(t('billing.created', { number }));
    }
    setOpen(false);
  };
  const remove = async (i: Invoice) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: i.number }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.invoices.delete(i.id!); await logAction('delete', 'billing', i.number); toast.success(t('common.deleted'));
  };
  const fromSale = async (id: number) => {
    const sale = sales.find((x) => x.id === id); if (!sale) return;
    const inv = await createInvoiceFromSale(sale);
    await logAction('create', 'billing', `${inv.number} ← ${sale.ticketNumber}`);
    toast.success(t('billing.created', { number: inv.number }));
  };
  const fromRepair = async (id: number) => {
    const r = repairs.find((x) => x.id === id); if (!r) return;
    const inv = await createInvoiceFromRepair(r, t('repairs.repairOf'));
    await logAction('create', 'billing', `${inv.number} ← ${r.ticketNumber}`);
    toast.success(t('billing.created', { number: inv.number }));
  };
  const registerPayment = async () => {
    if (!payFor) return;
    const amount = round2(Number(payAmount));
    const pending = round2(payFor.total - payFor.paid);
    if (!(amount > 0)) { toast.error(t('validation.positive')); return; }
    if (amount > pending + 0.001) { toast.error(t('billing.exceedsPending', { amount: f.money(pending) })); return; }
    const paid = round2(payFor.paid + amount);
    const st: InvoiceStatus = paid >= payFor.total - 0.001 ? 'paid' : 'partial';
    await db.invoices.update(payFor.id!, { paid, status: st });
    await logAction('payment', 'billing', `${payFor.number}: +${f.money(amount)} (${f.money(paid)}/${f.money(payFor.total)})`);
    toast.success(t('billing.paymentRegistered'));
    if (preview?.id === payFor.id) setPreview({ ...payFor, paid, status: st });
    setPayFor(null);
  };
  const setInvStatus = async (i: Invoice, st: InvoiceStatus) => {
    const patch: Partial<Invoice> = { status: st };
    if (st === 'paid') patch.paid = i.total;
    await db.invoices.update(i.id!, patch);
    await logAction('status_change', 'billing', `${i.number}: ${t(`invoiceStatus.${i.status}`)} → ${t(`invoiceStatus.${st}`)}`);
    if (preview?.id === i.id) setPreview({ ...i, ...patch });
  };
  const print = (i: Invoice) => { printHtml(invoiceHtml(i, s, t, cssVar('--sl-primary', '#4f46e5')), i.number); logAction('print', 'billing', i.number); };
  const pdf = (i: Invoice) => { invoicePdf(i, s); logAction('export', 'billing', `PDF ${i.number}`); };

  const origin = (i: Invoice) => i.saleId ? <Badge color="cyan">🧾 {t('billing.fromSale')}</Badge> : i.repairId ? <Badge color="purple">🔧 {t('billing.fromRepair')}</Badge> : <Badge color="slate">✍️ {t('billing.manual')}</Badge>;
  const actions = (i: Invoice) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('common.view')} onClick={() => setPreview(i)}><Eye /></IconButton>
      {i.paid < i.total && i.status !== 'cancelled' && <IconButton title={t('billing.registerPayment')} tone="success" onClick={() => { setPayFor(i); setPayAmount(String(round2(i.total - i.paid))); }}><Wallet /></IconButton>}
      <IconButton title={t('common.print')} onClick={() => print(i)}><Printer /></IconButton>
      <IconButton title="PDF" onClick={() => pdf(i)}><Download /></IconButton>
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(i)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(i)}><Trash /></IconButton>
    </div>
  );
  const paidBar = (i: Invoice) => (
    <div className="w-full min-w-[90px]">
      <div className="h-1.5 overflow-hidden rounded-full bg-sl-hover"><div className={`h-full ${i.paid >= i.total ? 'bg-emerald-500' : 'bg-amber-500'}`} style={{ width: `${i.total ? Math.min(100, (i.paid / i.total) * 100) : 0}%` }} /></div>
      <div className="mt-0.5 text-[10px] text-sl-muted">{f.money(i.paid)} / {f.money(i.total)}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="📄" title={t('nav.billing')} subtitle={t('billing.subtitle', { next: peekInvoiceNumber(s) })}
        actions={<>
          <ViewToggle value={view} onChange={setView} />
          <Button variant="secondary" onClick={() => setQuickOpen('sales')}>🧾 {t('billing.fromSales')} <Badge color="cyan">{unbilledSales.length}</Badge></Button>
          <Button variant="secondary" onClick={() => setQuickOpen('repairs')}>🔧 {t('billing.fromRepairs')} <Badge color="purple">{unbilledRepairs.length}</Badge></Button>
          <Button icon={<Plus />} onClick={openNew}>{t('billing.new')}</Button>
        </>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="📄" tone="indigo" label={t('billing.totalInvoiced')} value={f.money(sum.total)} sub={t('billing.invoicesCount', { count: active.length })} />
        <StatCard icon="✅" tone="green" label={t('billing.collected')} value={f.money(sum.paid)} onClick={() => setStatus(status === 'paid' ? 'all' : 'paid')} active={status === 'paid'} />
        <StatCard icon="⏳" tone="amber" label={t('billing.pending')} value={f.money(sum.pending)} onClick={() => setStatus(status === 'partial' ? 'all' : 'partial')} active={status === 'partial'} />
        <StatCard icon="⚠️" tone="red" label={t('billing.overdue')} value={f.money(sum.overdue)} onClick={() => setStatus(status === 'overdue' ? 'all' : 'overdue')} active={status === 'overdue'} />
      </div>
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('billing.searchPlaceholder')} /></Toolbar>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={status === 'all'} onClick={() => setStatus('all')} count={invoices.length}>📋 {t('common.all')}</Pill>
        {INVOICE_STATUSES.map((st) => <Pill key={st} active={status === st} onClick={() => setStatus(st)} count={invoices.filter((i) => i.status === st).length}>{INVOICE_STATUS_ICONS[st]} {t(`invoiceStatus.${st}`)}</Pill>)}
      </div>

      {list.length === 0 ? <Card><EmptyState icon="📄" title={t('common.noResults')} action={<Button size="sm" icon={<Plus />} onClick={openNew}>{t('billing.new')}</Button>} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((i) => (
            <Card key={i.id} className="p-4 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-mono text-sm font-bold text-primary">{i.number}</div><div className="font-semibold text-sl-text">{i.customerName}</div></div>
                <div className="flex flex-col items-end gap-1"><InvoiceStatusBadge status={i.status} />{origin(i)}</div>
              </div>
              <div className="mt-2 flex justify-between text-xs text-sl-muted"><span>📅 {f.date(i.date)}</span><span>⏰ {t('billing.dueDate')}: {f.date(i.dueDate)}</span></div>
              <div className="mt-3 flex items-end justify-between gap-3 rounded-lg bg-sl-hover p-2">
                {paidBar(i)}
                <div className="text-end"><div className="text-[10px] text-sl-muted">{t('tax.base')} {f.money(i.subtotal)} + {t('tax.vat')} {f.money(i.totalTax)}</div><div className="text-lg font-extrabold text-sl-text">{f.money(i.total)}</div></div>
              </div>
              <div className="mt-2 border-t border-sl-border pt-2">{actions(i)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(i) => i.id!} onRowClick={(i) => setPreview(i)} minWidth={1000}
          columns={[
            { key: 'number', label: t('billing.number'), render: (i) => <span className="font-mono text-xs font-bold text-primary">{i.number}</span> },
            { key: 'date', label: t('common.date'), render: (i) => f.date(i.date) },
            { key: 'customerName', label: t('common.customer'), render: (i) => <span className="font-semibold">{i.customerName}</span> },
            { key: 'origin', label: t('billing.origin'), render: origin, sortValue: (i) => (i.saleId ? 1 : i.repairId ? 2 : 3) },
            { key: 'dueDate', label: t('billing.dueDate'), render: (i) => f.date(i.dueDate) },
            { key: 'status', label: t('common.status'), render: (i) => <InvoiceStatusBadge status={i.status} />, sortValue: (i) => INVOICE_STATUSES.indexOf(i.status) },
            { key: 'paid', label: t('billing.paid'), render: paidBar },
            { key: 'total', label: t('common.total'), render: (i) => <b>{f.money(i.total)}</b> },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}

      {/* Quick create */}
      <Modal open={!!quickOpen} onClose={() => setQuickOpen(null)} size="lg" title={quickOpen === 'sales' ? `🧾 ${t('billing.fromSales')}` : `🔧 ${t('billing.fromRepairs')}`} subtitle={t('billing.quickHint')}>
        {quickOpen === 'sales' && (unbilledSales.length ? unbilledSales.map((x) => (
          <div key={x.id} className="flex items-center justify-between gap-3 border-b border-sl-border py-2.5 last:border-0">
            <div className="min-w-0"><div className="text-sm font-semibold text-sl-text">{x.ticketNumber} · {x.customerName || t('pos.walkIn')}</div><div className="text-xs text-sl-muted">{f.dateTime(x.date)} · {x.items.length} {t('billing.items')}</div></div>
            <div className="flex items-center gap-2"><b className="text-sm">{f.money(x.total)}</b><Button size="sm" onClick={() => fromSale(x.id!)}>➕ {t('billing.invoiceIt')}</Button></div>
          </div>
        )) : <EmptyState icon="✅" title={t('billing.allBilled')} />)}
        {quickOpen === 'repairs' && (unbilledRepairs.length ? unbilledRepairs.map((r) => (
          <div key={r.id} className="flex items-center justify-between gap-3 border-b border-sl-border py-2.5 last:border-0">
            <div className="min-w-0"><div className="text-sm font-semibold text-sl-text">{r.ticketNumber} · {r.device}</div><div className="text-xs text-sl-muted">{r.customerName} · {t(`repairStatus.${r.status}`)}</div></div>
            <div className="flex items-center gap-2"><b className="text-sm">{f.money(r.finalCost ?? r.estimatedCost)}</b><Button size="sm" onClick={() => fromRepair(r.id!)}>➕ {t('billing.invoiceIt')}</Button></div>
          </div>
        )) : <EmptyState icon="✅" title={t('billing.allBilled')} hint={t('billing.repairsHint')} />)}
      </Modal>

      {/* Form */}
      <Modal open={open} onClose={() => setOpen(false)} size="xl" title={editing ? `✏️ ${editing.number}` : `➕ ${t('billing.new')}`} subtitle={!editing ? `${t('billing.number')}: ${peekInvoiceNumber(s)}` : undefined}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        {form && liveTotals && (
          <div className="space-y-4">
            <div className="rounded-xl border border-sl-border bg-sl-card2 p-3">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-sl-muted">👤 {t('common.customer')}</span>
                <select className={`${fieldClass()} !w-auto !py-1 text-xs`} value="" onChange={(e) => pickCustomer(e.target.value)}>
                  <option value="">{t('billing.loadCustomer')}</option>
                  {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <Input label={t('common.name')} requiredMark value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} error={errors.customerName} />
                <Input label={t('billing.taxId')} value={form.customerDni} onChange={(e) => setForm({ ...form, customerDni: e.target.value })} />
                <Input label={t('common.email')} value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} error={errors.customerEmail} />
                <Input label={t('common.address')} value={form.customerAddress} onChange={(e) => setForm({ ...form, customerAddress: e.target.value })} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Input label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
              <Input label={t('billing.dueDate')} type="date" value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} error={errors.dueDate} />
              <Select label={t('common.status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as InvoiceStatus })}>
                {INVOICE_STATUSES.map((st) => <option key={st} value={st}>{INVOICE_STATUS_ICONS[st]} {t(`invoiceStatus.${st}`)}</option>)}
              </Select>
              <Select label={t('pos.paymentMethod')} value={form.paymentMethod} onChange={(e) => setForm({ ...form, paymentMethod: e.target.value as PaymentMethod })}>
                {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.icon} {t(`payment.${m.id}`)}</option>)}
              </Select>
            </div>
            <div>
              <div className="mb-2 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-wide text-sl-muted">📦 {t('billing.items')}</span><span className="text-[11px] text-sl-muted">💡 {t('billing.priceHint')}</span></div>
              <div className="overflow-x-auto rounded-xl border border-sl-border">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-sl-card2 text-[11px] uppercase text-sl-muted">
                    <tr><th className="px-2 py-2 text-start">{t('common.description')}</th><th className="w-20 px-2 py-2 text-start">{t('billing.qty')}</th><th className="w-28 px-2 py-2 text-start">{t('billing.priceNoVat')}</th><th className="w-20 px-2 py-2 text-start">{t('tax.vat')} %</th><th className="w-28 px-2 py-2 text-start">{t('common.total')}</th><th className="w-10" /></tr>
                  </thead>
                  <tbody>
                    {form.items.map((it, idx) => (
                      <tr key={idx} className="border-t border-sl-border">
                        <td className="p-1.5"><input className={fieldClass(!!errors[`items.${idx}.description`])} value={it.description} onChange={(e) => setItem(idx, 'description', e.target.value)} placeholder={t('common.description')} /></td>
                        <td className="p-1.5"><input type="number" min="0" step="1" className={fieldClass(!!errors[`items.${idx}.quantity`])} value={it.quantity} onChange={(e) => setItem(idx, 'quantity', e.target.value)} /></td>
                        <td className="p-1.5"><input type="number" min="0" step="0.01" className={fieldClass()} value={it.price} onChange={(e) => setItem(idx, 'price', e.target.value)} /></td>
                        <td className="p-1.5"><input type="number" min="0" step="1" className={fieldClass()} value={it.taxRate} onChange={(e) => setItem(idx, 'taxRate', e.target.value)} /></td>
                        <td className="p-1.5"><input type="number" min="0" step="0.01" className={`${fieldClass()} font-bold`} value={it.total} onChange={(e) => setItem(idx, 'total', e.target.value)} title={t('billing.totalEditable')} /></td>
                        <td className="p-1.5 text-center"><IconButton title={t('common.delete')} tone="danger" disabled={form.items.length <= 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash /></IconButton></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button size="sm" variant="outline" className="mt-2" icon={<Plus />} onClick={() => setForm({ ...form, items: [...form.items, blankItem()] })}>{t('billing.addItem')}</Button>
            </div>
            <div className="grid gap-4 md:grid-cols-[1fr_300px]">
              <TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
              <div className="space-y-1.5 rounded-xl bg-sl-hover p-4 text-sm">
                <div className="flex justify-between text-sl-muted"><span>{t('tax.base')}</span><span>{f.money(liveTotals.subtotal)}</span></div>
                <div className="flex justify-between text-sl-muted"><span>+ {t('tax.vat')}</span><span>+ {f.money(liveTotals.totalTax)}</span></div>
                <div className="flex justify-between border-t border-sl-border pt-2 text-lg font-extrabold text-sl-text"><span>{t('tax.totalInc')}</span><span className="text-primary">{f.money(liveTotals.total)}</span></div>
              </div>
            </div>
          </div>
        )}
      </Modal>

      {/* Preview */}
      <Modal open={!!preview} onClose={() => setPreview(null)} size="xl" title={preview ? `📄 ${preview.number}` : ''}
        footer={preview && <>
          {preview.paid < preview.total && preview.status !== 'cancelled' && <Button variant="success" icon={<Wallet />} onClick={() => { setPayFor(preview); setPayAmount(String(round2(preview.total - preview.paid))); }}>{t('billing.registerPayment')}</Button>}
          <Select value={preview.status} onChange={(e) => setInvStatus(preview, e.target.value as InvoiceStatus)} className="!w-auto !py-2">
            {INVOICE_STATUSES.map((st) => <option key={st} value={st}>{INVOICE_STATUS_ICONS[st]} {t(`invoiceStatus.${st}`)}</option>)}
          </Select>
          <Button variant="secondary" icon={<Printer />} onClick={() => print(preview)}>{t('common.print')}</Button>
          <Button icon={<Download />} onClick={() => pdf(preview)}>{t('billing.downloadPdf')}</Button>
        </>}>
        {preview && <InvoicePreview inv={preview} />}
      </Modal>

      {/* Payment */}
      <Modal open={!!payFor} onClose={() => setPayFor(null)} size="sm" title={`💰 ${t('billing.registerPayment')}`} subtitle={payFor?.number}
        footer={<><Button variant="secondary" onClick={() => setPayFor(null)}>{t('common.cancel')}</Button><Button variant="success" onClick={registerPayment}>{t('common.confirm')}</Button></>}>
        {payFor && (
          <div className="space-y-3">
            <InfoRow label={t('common.total')} value={f.money(payFor.total)} />
            <InfoRow label={t('billing.paid')} value={f.money(payFor.paid)} />
            <InfoRow label={t('billing.pending')} value={<b className="text-red-500">{f.money(payFor.total - payFor.paid)}</b>} />
            <Input label={t('billing.amount')} type="number" step="0.01" min="0" value={payAmount} onChange={(e) => setPayAmount(e.target.value)} autoFocus />
            <div className="flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => setPayAmount(String(round2((payFor.total - payFor.paid) / 2)))}>50%</Button>
              <Button size="sm" variant="secondary" onClick={() => setPayAmount(String(round2(payFor.total - payFor.paid)))}>{t('billing.payAll')}</Button>
            </div>
            {Number(payAmount) > 0 && <p className="text-xs text-sl-muted">{t('billing.remainingAfter')}: <b>{f.money(Math.max(0, payFor.total - payFor.paid - Number(payAmount)))}</b></p>}
          </div>
        )}
      </Modal>
    </div>
  );
}

export function InvoicePreview({ inv }: { inv: Invoice }) {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  return (
    <div className="rounded-xl border border-sl-border bg-white p-5 text-slate-800 shadow-inner sm:p-8">
      <div className="flex flex-wrap justify-between gap-4 border-b-4 pb-4" style={{ borderColor: 'var(--sl-primary)' }}>
        <div><div className="text-xl font-extrabold" style={{ color: 'var(--sl-primary)' }}>{s.storeName}</div><div className="text-xs leading-5 text-slate-500">{t('settings.cif')}: {s.cif}<br />{s.address}<br />{s.phone} · {s.email}</div></div>
        <div className="text-end"><div className="text-2xl font-extrabold uppercase tracking-wider" style={{ color: 'var(--sl-primary)' }}>{t('billing.invoice')}</div><div className="font-mono font-bold">{inv.number}</div><div className="text-xs text-slate-500">{t('common.date')}: {f.date(inv.date)}<br />{t('billing.dueDate')}: {f.date(inv.dueDate)}</div></div>
      </div>
      <div className="my-4 flex flex-wrap items-start justify-between gap-3">
        <div className="rounded-lg border-s-4 bg-slate-50 px-4 py-3" style={{ borderColor: 'var(--sl-primary)' }}>
          <div className="text-[10px] uppercase tracking-wider text-slate-500">{t('billing.billTo')}</div>
          <div className="font-bold">{inv.customerName}</div>
          <div className="text-xs leading-5 text-slate-500">{inv.customerDni && <>{t('billing.taxId')}: {inv.customerDni}<br /></>}{inv.customerAddress}{inv.customerEmail && <><br />{inv.customerEmail}</>}</div>
        </div>
        <div className="flex flex-col items-end gap-1"><InvoiceStatusBadge status={inv.status} /><span className="text-xs text-slate-500">{t('pos.paymentMethod')}: {t(`payment.${inv.paymentMethod}`)}</span></div>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[520px] text-sm">
          <thead><tr className="text-xs text-white" style={{ background: 'var(--sl-primary)' }}><th className="px-3 py-2 text-start">{t('common.description')}</th><th className="px-3 py-2 text-end">{t('billing.qty')}</th><th className="px-3 py-2 text-end">{t('common.price')}</th><th className="px-3 py-2 text-end">{t('tax.vat')}</th><th className="px-3 py-2 text-end">{t('common.total')}</th></tr></thead>
          <tbody>{inv.items.map((i, idx) => <tr key={idx} className="border-b border-slate-200"><td className="px-3 py-2">{i.description}</td><td className="px-3 py-2 text-end">{i.quantity}</td><td className="px-3 py-2 text-end">{f.money(i.price)}</td><td className="px-3 py-2 text-end">{i.taxRate}%</td><td className="px-3 py-2 text-end font-semibold">{f.money(i.total)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="mt-4 flex justify-end">
        <div className="w-full max-w-xs space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-slate-500">{t('tax.base')}</span><span>{f.money(inv.subtotal)}</span></div>
          <div className="flex justify-between"><span className="text-slate-500">+ {t('tax.vat')}</span><span>+ {f.money(inv.totalTax)}</span></div>
          <div className="flex justify-between border-t-2 pt-2 text-lg font-extrabold" style={{ borderColor: 'var(--sl-primary)', color: 'var(--sl-primary)' }}><span>{t('tax.totalInc')}</span><span>{f.money(inv.total)}</span></div>
          {inv.paid > 0 && inv.paid < inv.total && <>
            <div className="flex justify-between text-slate-500"><span>{t('billing.paid')}</span><span>{f.money(inv.paid)}</span></div>
            <div className="flex justify-between font-bold text-red-600"><span>{t('billing.pending')}</span><span>{f.money(inv.total - inv.paid)}</span></div>
          </>}
        </div>
      </div>
      {inv.notes && <div className="mt-4 rounded-lg border border-dashed border-slate-300 p-3 text-xs text-slate-600"><b>{t('common.notes')}:</b> {inv.notes}</div>}
      <div className="mt-6 border-t border-slate-200 pt-2 text-center text-[10px] text-slate-400">{s.storeName} · {s.cif} · {s.email}</div>
    </div>
  );
}