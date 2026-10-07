import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { CircleCheck, Eye, Pencil, Plus, Send, Trash, Wand2, X } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { isoDate, round2 } from '../lib/calc';
import { logAction } from '../lib/audit';
import { PURCHASE_STATUS_COLORS } from '../lib/colors';
import { nextPurchaseOrderNumber, purchaseOrderTotal, purchasePending, receivePurchaseOrder } from '../lib/stock';
import { purchaseOrderSchema, validateForm, type FormErrors } from '../schemas';
import type { PurchaseOrder, PurchaseOrderItem, PurchaseOrderStatus } from '../types';
import { PURCHASE_ORDER_STATUSES, PURCHASE_STATUS_ICONS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, InfoRow, Pill, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea, fieldClass } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type LineForm = { productId: string; quantity: string; cost: string };
type PForm = { providerId: string; date: string; expectedDate: string; notes: string; items: LineForm[] };

const blankLine = (): LineForm => ({ productId: '', quantity: '1', cost: '' });
const emptyForm = (): PForm => ({ providerId: '', date: isoDate(), expectedDate: '', notes: '', items: [blankLine()] });

export function PurchaseStatusBadge({ status }: { status: PurchaseOrderStatus }) {
  const { t } = useTranslation();
  return <Badge color={PURCHASE_STATUS_COLORS[status]}>{PURCHASE_STATUS_ICONS[status]} {t(`purchaseStatus.${status}`)}</Badge>;
}

export function Purchases() {
  const { t } = useTranslation();
  const f = useFormat();
  const orders = useLiveQuery(() => db.purchaseOrders.reverse().sortBy('createdAt'), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const providers = useLiveQuery(() => db.providers.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<PurchaseOrderStatus | 'all'>('all');
  const [view, setView] = useViewMode('purchases');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<PurchaseOrder | null>(null);
  const [form, setForm] = useState<PForm>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [detail, setDetail] = useState<PurchaseOrder | null>(null);
  const [receiveFor, setReceiveFor] = useState<PurchaseOrder | null>(null);
  const [receiveQty, setReceiveQty] = useState<Record<number, string>>({});

  const list = useMemo(() => (orders ?? []).filter((o) =>
    (status === 'all' || o.status === status) && matches(q, o.number, o.providerName)), [orders, q, status]);

  if (!orders || !products || !providers) return <LoadingPage />;

  const unsettled = orders.filter((o) => o.status === 'draft' || o.status === 'sent' || o.status === 'partial');
  const openValue = round2(unsettled.reduce((a, o) => a + o.total, 0));
  const received = orders.filter((o) => o.status === 'received').length;

  const openNew = () => { setEditing(null); setForm(emptyForm()); setErrors({}); setOpen(true); };
  const openEdit = (o: PurchaseOrder) => {
    setEditing(o);
    setForm({
      providerId: o.providerId ? String(o.providerId) : '',
      date: o.date, expectedDate: o.expectedDate ?? '', notes: o.notes ?? '',
      items: o.items.map((i) => ({ productId: String(i.productId), quantity: String(i.quantity), cost: String(i.cost) })),
    });
    setErrors({}); setOpen(true);
  };
  const setLine = (idx: number, patch: Partial<LineForm>) =>
    setForm((fm) => ({ ...fm, items: fm.items.map((l, i) => (i === idx ? { ...l, ...patch } : l)) }));
  const pickProduct = (idx: number, productId: string) => {
    const p = products.find((x) => String(x.id) === productId);
    setLine(idx, { productId, cost: p ? String(p.cost) : '' });
  };
  const liveTotal = round2(form.items.reduce((a, l) => a + (Number(l.quantity) || 0) * (Number(l.cost) || 0), 0));

  const save = async () => {
    const items = form.items.filter((l) => l.productId !== '');
    if (!items.length) { setErrors({ items: 'validation.minItems' }); toast.warning(t('validation.minItems')); return; }
    const r = validateForm(purchaseOrderSchema, { ...form, expectedDate: form.expectedDate, items });
    setErrors(r.errors);
    if (!r.success) return;
    const d = r.data;
    const provider = providers.find((p) => p.id === d.providerId);
    const previous = new Map(editing?.items.map((i) => [i.productId, i.quantityReceived]) ?? []);
    const lines: PurchaseOrderItem[] = d.items.map((i) => ({
      productId: i.productId,
      name: products.find((p) => p.id === i.productId)?.name ?? '—',
      quantity: i.quantity,
      quantityReceived: previous.get(i.productId) ?? 0,
      cost: i.cost,
    }));
    const payload = {
      providerId: d.providerId,
      providerName: provider?.name ?? '—',
      date: d.date,
      expectedDate: d.expectedDate,
      notes: d.notes,
      items: lines,
      total: purchaseOrderTotal(lines),
    };
    if (editing) {
      await db.purchaseOrders.update(editing.id!, payload);
      await logAction('update', 'purchases', editing.number);
      toast.success(t('purchases.updated'));
    } else {
      const number = await nextPurchaseOrderNumber();
      await db.purchaseOrders.add({ ...payload, number, status: 'draft', createdAt: new Date().toISOString() });
      await logAction('create', 'purchases', `${number} · ${f.money(payload.total)}`);
      toast.success(t('purchases.created', { number }));
    }
    setOpen(false);
  };

  const changeStatus = async (o: PurchaseOrder, next: PurchaseOrderStatus) => {
    await db.purchaseOrders.update(o.id!, { status: next });
    await logAction('status_change', 'purchases', `${o.number}: ${t(`purchaseStatus.${o.status}`)} → ${t(`purchaseStatus.${next}`)}`);
    toast.success(t('purchases.statusChanged', { number: o.number, status: t(`purchaseStatus.${next}`) }));
    if (detail?.id === o.id) setDetail({ ...o, status: next });
  };
  const remove = async (o: PurchaseOrder) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: o.number }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.purchaseOrders.delete(o.id!);
    await logAction('delete', 'purchases', o.number);
    toast.success(t('common.deleted'));
  };
  const openReceive = (o: PurchaseOrder) => {
    const init: Record<number, string> = {};
    for (const it of o.items) init[it.productId] = String(purchasePending(it));
    setReceiveQty(init);
    setReceiveFor(o);
  };
  const confirmReceive = async () => {
    if (!receiveFor) return;
    const map: Record<number, number> = {};
    for (const it of receiveFor.items) {
      const pending = purchasePending(it);
      const parsed = Number(receiveQty[it.productId]);
      const value = Number.isFinite(parsed) ? parsed : pending;
      map[it.productId] = Math.max(0, Math.min(pending, value));
    }
    if (Object.values(map).every((n) => n <= 0)) { toast.warning(t('purchases.receivedNothing')); return; }
    try {
      const updated = await receivePurchaseOrder(receiveFor.id!, map);
      await logAction('status_change', 'purchases', `${updated.number}: ${t(`purchaseStatus.${updated.status}`)}`);
      toast.success(updated.status === 'received'
        ? t('purchases.received', { number: updated.number })
        : t('purchases.partialReceived', { number: updated.number }));
      setReceiveFor(null);
    } catch (e) {
      toast.error((e as Error).message);
    }
  };
  const fromLowStock = async () => {
    const low = products.filter((p) => p.stock <= p.minStock);
    if (!low.length) { toast.warning(t('purchases.fromLowStockEmpty')); return; }
    const items: PurchaseOrderItem[] = low.map((p) => ({
      productId: p.id!, name: p.name,
      quantity: Math.max(1, p.minStock * 2 - p.stock), quantityReceived: 0, cost: p.cost,
    }));
    const number = await nextPurchaseOrderNumber();
    await db.purchaseOrders.add({
      number, providerName: '—', status: 'draft', date: isoDate(), items,
      total: purchaseOrderTotal(items), createdAt: new Date().toISOString(),
    });
    await logAction('create', 'purchases', `${number} · ${items.length}`);
    toast.success(t('purchases.fromLowStockDone', { number, count: items.length }));
  };

  const pendingOf = (o: PurchaseOrder) => o.items.reduce((a, i) => a + purchasePending(i), 0);
  const actions = (o: PurchaseOrder) => {
    const editable = o.status === 'draft' || o.status === 'sent';
    return (
      <div className="flex justify-end gap-0.5">
        <IconButton title={t('common.view')} onClick={() => setDetail(o)}><Eye /></IconButton>
        {o.status === 'draft' && <IconButton title={t('purchases.send')} tone="primary" onClick={() => changeStatus(o, 'sent')}><Send /></IconButton>}
        {(o.status === 'sent' || o.status === 'partial') && <IconButton title={t('purchases.receive')} tone="success" onClick={() => openReceive(o)}><CircleCheck /></IconButton>}
        {editable && <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(o)}><Pencil /></IconButton>}
        {o.status !== 'received' && <IconButton title={t('purchases.cancel')} onClick={() => changeStatus(o, 'cancelled')}><X /></IconButton>}
        <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(o)}><Trash /></IconButton>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader icon="📥" title={t('nav.purchases')} subtitle={t('purchases.subtitle')}
        actions={<>
          <ViewToggle value={view} onChange={setView} />
          <Button variant="secondary" icon={<Wand2 />} onClick={fromLowStock}>{t('purchases.fromLowStock')}</Button>
          <Button icon={<Plus />} onClick={openNew}>{t('purchases.new')}</Button>
        </>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="📥" tone="indigo" label={t('purchases.totalOrders')} value={orders.length} />
        <StatCard icon="⏳" tone="amber" label={t('purchases.openOrders')} value={unsettled.length} onClick={() => setStatus(status === 'sent' ? 'all' : 'sent')} active={status === 'sent'} />
        <StatCard icon="💶" tone="blue" label={t('purchases.openValue')} value={f.money(openValue)} />
        <StatCard icon="✅" tone="green" label={t('purchases.receivedOrders')} value={received} onClick={() => setStatus(status === 'received' ? 'all' : 'received')} active={status === 'received'} />
      </div>
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('purchases.searchPlaceholder')} /></Toolbar>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={status === 'all'} onClick={() => setStatus('all')} count={orders.length}>📋 {t('common.all')}</Pill>
        {PURCHASE_ORDER_STATUSES.map((st) => (
          <Pill key={st} active={status === st} onClick={() => setStatus(st)} count={orders.filter((o) => o.status === st).length}>
            {PURCHASE_STATUS_ICONS[st]} {t(`purchaseStatus.${st}`)}
          </Pill>
        ))}
      </div>

      {list.length === 0 ? <Card><EmptyState icon="📥" title={t('purchases.empty')} action={<Button size="sm" icon={<Plus />} onClick={openNew}>{t('purchases.new')}</Button>} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((o) => (
            <Card key={o.id} className="p-4 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-mono text-sm font-bold text-primary">{o.number}</div>
                  <div className="truncate font-semibold text-sl-text">{o.providerName}</div>
                </div>
                <PurchaseStatusBadge status={o.status} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-sl-muted">
                <span>📅 {f.date(o.date)}</span>
                {o.expectedDate && <span>⏰ {t('purchases.expectedDate')}: {f.date(o.expectedDate)}</span>}
              </div>
              <div className="mt-3 flex items-end justify-between gap-3 rounded-lg bg-sl-hover p-2">
                <div className="text-xs text-sl-muted">
                  <div>{t('purchases.lines', { count: o.items.length })}</div>
                  {o.status !== 'received' && o.status !== 'cancelled' && <div>{t('purchases.qtyReceived')}: {o.items.reduce((a, i) => a + i.quantityReceived, 0)}/{o.items.reduce((a, i) => a + i.quantity, 0)}</div>}
                </div>
                <div className="text-lg font-extrabold text-sl-text">{f.money(o.total)}</div>
              </div>
              <div className="mt-2 border-t border-sl-border pt-2">{actions(o)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(o) => o.id!} onRowClick={(o) => setDetail(o)} minWidth={1000}
          columns={[
            { key: 'number', label: t('purchases.number'), render: (o) => <span className="font-mono text-xs font-bold text-primary">{o.number}</span> },
            { key: 'providerName', label: t('purchases.provider'), render: (o) => <span className="font-semibold">{o.providerName}</span> },
            { key: 'date', label: t('purchases.date'), render: (o) => f.date(o.date) },
            { key: 'expectedDate', label: t('purchases.expectedDate'), render: (o) => (o.expectedDate ? f.date(o.expectedDate) : '—') },
            { key: 'status', label: t('common.status'), render: (o) => <PurchaseStatusBadge status={o.status} />, sortValue: (o) => PURCHASE_ORDER_STATUSES.indexOf(o.status) },
            { key: 'items', label: t('purchases.items'), render: (o) => <span className="text-xs text-sl-muted">{t('purchases.lines', { count: o.items.length })}</span> },
            { key: 'pending', label: t('purchases.qtyReceived'), render: (o) => <span className="font-mono">{o.items.reduce((a, i) => a + i.quantityReceived, 0)}/{o.items.reduce((a, i) => a + i.quantity, 0)}</span>, sortValue: pendingOf, className: 'text-end', headerClassName: 'text-end' },
            { key: 'total', label: t('common.total'), render: (o) => <b>{f.money(o.total)}</b> },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}

      {/* Form */}
      <Modal open={open} onClose={() => setOpen(false)} size="xl" title={editing ? `✏️ ${t('purchases.edit')} · ${editing.number}` : `➕ ${t('purchases.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label={t('purchases.provider')} requiredMark value={form.providerId} onChange={(e) => setForm({ ...form, providerId: e.target.value })} error={errors.providerId}>
              <option value="">{t('purchases.selectProvider')}</option>
              {providers.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
            <Input label={t('purchases.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
            <Input label={t('purchases.expectedDate')} type="date" value={form.expectedDate} onChange={(e) => setForm({ ...form, expectedDate: e.target.value })} />
          </div>
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-xs font-bold uppercase tracking-wide text-sl-muted">📦 {t('purchases.items')}</span>
              {errors.items && <span className="text-xs text-red-500">{t(errors.items)}</span>}
            </div>
            <div className="overflow-x-auto rounded-xl border border-sl-border">
              <table className="w-full min-w-[620px] text-sm">
                <thead className="bg-sl-card2 text-[11px] uppercase text-sl-muted">
                  <tr>
                    <th className="px-2 py-2 text-start">{t('purchases.product')}</th>
                    <th className="w-24 px-2 py-2 text-start">{t('purchases.quantity')}</th>
                    <th className="w-28 px-2 py-2 text-start">{t('purchases.cost')}</th>
                    <th className="w-28 px-2 py-2 text-end">{t('purchases.lineTotal')}</th>
                    <th className="w-10" />
                  </tr>
                </thead>
                <tbody>
                  {form.items.map((line, idx) => (
                    <tr key={idx} className="border-t border-sl-border">
                      <td className="p-1.5">
                        <select className={fieldClass(!!errors[`items.${idx}.productId`])} value={line.productId} onChange={(e) => pickProduct(idx, e.target.value)}>
                          <option value="">{t('purchases.selectProduct')}</option>
                          {products.map((p) => <option key={p.id} value={p.id}>{p.name} · {t('common.stock')}: {p.stock}</option>)}
                        </select>
                      </td>
                      <td className="p-1.5"><input type="number" min="1" step="1" className={fieldClass(!!errors[`items.${idx}.quantity`])} value={line.quantity} onChange={(e) => setLine(idx, { quantity: e.target.value })} /></td>
                      <td className="p-1.5"><input type="number" min="0" step="0.01" className={fieldClass(!!errors[`items.${idx}.cost`])} value={line.cost} onChange={(e) => setLine(idx, { cost: e.target.value })} /></td>
                      <td className="p-1.5 text-end font-semibold">{f.money((Number(line.quantity) || 0) * (Number(line.cost) || 0))}</td>
                      <td className="p-1.5 text-center">
                        <IconButton title={t('common.delete')} tone="danger" disabled={form.items.length <= 1} onClick={() => setForm({ ...form, items: form.items.filter((_, i) => i !== idx) })}><Trash /></IconButton>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
              <Button size="sm" variant="outline" icon={<Plus />} onClick={() => setForm({ ...form, items: [...form.items, blankLine()] })}>{t('purchases.addItem')}</Button>
              <span className="text-sm text-sl-muted">{t('purchases.total')}: <b className="text-lg text-primary">{f.money(liveTotal)}</b></span>
            </div>
          </div>
          <TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>

      {/* Receive */}
      <Modal open={!!receiveFor} onClose={() => setReceiveFor(null)} size="lg" title={`📦 ${t('purchases.receiveTitle')}`} subtitle={receiveFor?.number}
        footer={<><Button variant="secondary" onClick={() => setReceiveFor(null)}>{t('common.cancel')}</Button><Button variant="success" icon={<CircleCheck />} onClick={confirmReceive}>{t('purchases.confirmReceive')}</Button></>}>
        {receiveFor && (
          <div className="space-y-3">
            <p className="text-sm text-sl-muted">{t('purchases.receiveHint')}</p>
            <div className="overflow-x-auto rounded-xl border border-sl-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-sl-card2 text-[11px] uppercase text-sl-muted">
                  <tr>
                    <th className="px-3 py-2 text-start">{t('purchases.product')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.quantity')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.qtyReceived')}</th>
                    <th className="w-28 px-3 py-2 text-start">{t('purchases.receive')}</th>
                  </tr>
                </thead>
                <tbody>
                  {receiveFor.items.map((it) => (
                    <tr key={it.productId} className="border-t border-sl-border">
                      <td className="px-3 py-2 font-semibold">{it.name}</td>
                      <td className="px-3 py-2 text-end font-mono">{it.quantity}</td>
                      <td className="px-3 py-2 text-end font-mono text-sl-muted">{it.quantityReceived}</td>
                      <td className="px-3 py-2">
                        <input type="number" min="0" max={purchasePending(it)} step="1" className={fieldClass()}
                          value={receiveQty[it.productId] ?? ''} onChange={(e) => setReceiveQty({ ...receiveQty, [it.productId]: e.target.value })} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>

      {/* Detail */}
      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={detail ? `📥 ${detail.number}` : ''}
        footer={detail && <>
          {detail.status === 'draft' && <Button variant="secondary" icon={<Send />} onClick={() => { changeStatus(detail, 'sent'); setDetail(null); }}>{t('purchases.send')}</Button>}
          {(detail.status === 'sent' || detail.status === 'partial') && <Button variant="success" icon={<CircleCheck />} onClick={() => { const d = detail; setDetail(null); openReceive(d); }}>{t('purchases.receive')}</Button>}
          {(detail.status === 'draft' || detail.status === 'sent') && <Button variant="outline" icon={<Pencil />} onClick={() => { const d = detail; setDetail(null); openEdit(d); }}>{t('common.edit')}</Button>}
        </>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><PurchaseStatusBadge status={detail.status} /></div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <InfoRow label={t('purchases.provider')} value={detail.providerName} />
                <InfoRow label={t('purchases.date')} value={f.date(detail.date)} />
                <InfoRow label={t('purchases.expectedDate')} value={detail.expectedDate ? f.date(detail.expectedDate) : '—'} />
              </div>
              <div>
                <InfoRow label={t('purchases.receivedAt')} value={detail.receivedAt ? f.dateTime(detail.receivedAt) : '—'} />
                <InfoRow label={t('purchases.lines', { count: detail.items.length })} value={<b>{f.money(detail.total)}</b>} />
              </div>
            </div>
            <div className="overflow-x-auto rounded-xl border border-sl-border">
              <table className="w-full min-w-[520px] text-sm">
                <thead className="bg-sl-card2 text-[11px] uppercase text-sl-muted">
                  <tr>
                    <th className="px-3 py-2 text-start">{t('purchases.product')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.quantity')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.qtyReceived')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.cost')}</th>
                    <th className="px-3 py-2 text-end">{t('purchases.lineTotal')}</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.map((it) => (
                    <tr key={it.productId} className="border-t border-sl-border">
                      <td className="px-3 py-2">{it.name}</td>
                      <td className="px-3 py-2 text-end font-mono">{it.quantity}</td>
                      <td className="px-3 py-2 text-end font-mono">{it.quantityReceived}</td>
                      <td className="px-3 py-2 text-end">{f.money(it.cost)}</td>
                      <td className="px-3 py-2 text-end font-semibold">{f.money(it.quantity * it.cost)}</td>
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
