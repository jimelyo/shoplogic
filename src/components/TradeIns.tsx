import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowRightLeft, Package, Plus, Trash } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { logAction } from '../lib/audit';
import { isReadOnly } from '../lib/permissions';
import { cancelTradeIn, defaultListPrice, listTradeIn, quoteTradeIn, purchaseTradeIn } from '../lib/tradein';
import type { TradeIn, TradeInCondition } from '../types';
import { TRADE_IN_CONDITIONS, TRADE_IN_STATUSES, TRADE_IN_STATUS_ICONS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, InfoRow, Pill, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type TIForm = { customerName: string; customerId: string; device: string; imei: string; condition: TradeInCondition; buyPrice: string; notes: string };
const emptyForm = (): TIForm => ({ customerName: '', customerId: '', device: '', imei: '', condition: 'B', buyPrice: '', notes: '' });

const STATUS_COLORS: Record<TradeIn['status'], 'amber' | 'green' | 'cyan' | 'slate'> = {
  quoted: 'amber', purchased: 'green', listed: 'cyan', cancelled: 'slate',
};

export function TradeIns() {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const user = useStore((st) => st.currentUser);
  const setActive = useStore((st) => st.setActiveModule);
  const readOnly = isReadOnly(user, 'tradeins');
  const openStock = useStore((st) => st.setStockFocusProductId);
  const tradeIns = useLiveQuery(() => db.tradeIns.reverse().sortBy('createdAt'), []);
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<TradeIn['status'] | 'all'>('all');
  const [view, setView] = useViewMode('tradeins');
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<TIForm>(emptyForm());
  const [listFor, setListFor] = useState<TradeIn | null>(null);
  const [listPrice, setListPrice] = useState('');

  const list = useMemo(() => (tradeIns ?? []).filter(
    (ti) => (status === 'all' || ti.status === status) && matches(q, ti.number, ti.customerName, ti.device, ti.imei),
  ), [tradeIns, q, status]);

  if (!tradeIns || !customers) return <LoadingPage />;

  const active = tradeIns.filter((x) => x.status === 'listed');
  const cost = active.reduce((a, x) => a + x.buyPrice, 0);
  const value = active.reduce((a, x) => a + (x.listPrice ?? defaultListPrice(x.buyPrice, s.tradeInMargin)), 0);
  const margin = cost > 0 ? Math.round(((value - cost) / cost) * 100) : 0;

  const pickCustomer = (id: string) => {
    const c = customers.find((x) => String(x.id) === id);
    if (c) setForm({ ...form, customerId: id, customerName: c.name });
  };
  const save = async () => {
    if (!form.customerName.trim() || !form.device.trim()) { toast.error(t('validation.required')); return; }
    const buy = Number(form.buyPrice);
    if (!(buy > 0)) { toast.error(t('validation.positive')); return; }
    await quoteTradeIn({
      customerName: form.customerName, customerId: form.customerId ? Number(form.customerId) : undefined,
      device: form.device, imei: form.imei, condition: form.condition, buyPrice: buy, notes: form.notes,
    });
    logAction('create', 'tradeins', form.device);
    toast.success(t('common.created'));
    setForm(emptyForm()); setOpen(false);
  };
  const purchase = async (ti: TradeIn) => {
    if (!(await confirmDialog(t('tradeins.purchaseConfirm', { number: ti.number, amount: f.money(ti.buyPrice) })))) return;
    try {
      await purchaseTradeIn(ti.id!);
      logAction('update', 'tradeins', `${ti.number} purchased`);
      toast.success(t('common.updated'));
    } catch { toast.error(t('tradeins.alreadyListed')); }
  };
  const listUnit = async () => {
    if (!listFor) return;
    const price = listPrice === '' ? undefined : Number(listPrice);
    try {
      const product = await listTradeIn(listFor.id!, price);
      logAction('create', 'tradeins', `${listFor.number} → ${product.name}`);
      toast.success(t('tradeins.listedToast', { name: product.name }));
      setListFor(null); setListPrice('');
    } catch (e) {
      if (String(e).includes('imei_exists')) toast.error(t('tradeins.imeiExists'));
      else toast.error(t('tradeins.notPurchasable'));
    }
  };
  const cancel = async (ti: TradeIn) => {
    if (!(await confirmDialog(t('tradeins.cancelConfirm', { name: ti.number }), { danger: true, confirmLabel: t('common.delete') }))) return;
    try { await cancelTradeIn(ti.id!); logAction('delete', 'tradeins', ti.number); toast.success(t('common.deleted')); }
    catch { toast.error(t('tradeins.alreadyListed')); }
  };
  const actions = (ti: TradeIn) => (
    <div className="flex justify-end gap-0.5">
      {ti.status === 'quoted' && <IconButton title={t('tradeins.purchase')} tone="success" disabled={readOnly} onClick={() => purchase(ti)}>✅</IconButton>}
      {ti.status !== 'listed' && ti.status !== 'cancelled' && <IconButton title={t('tradeins.list')} tone="primary" disabled={readOnly} onClick={() => { setListFor(ti); setListPrice(String(defaultListPrice(ti.buyPrice, s.tradeInMargin))); }}><Package /></IconButton>}
      {ti.productId != null && <IconButton title={t('tradeins.openProduct')} onClick={() => { openStock(ti.productId!); setActive('inventory'); }}><ArrowRightLeft /></IconButton>}
      {ti.status !== 'listed' && !readOnly && <IconButton title={t('common.delete')} tone="danger" onClick={() => cancel(ti)}><Trash /></IconButton>}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="♻️" title={t('nav.tradeins')} subtitle={t('tradeins.subtitle')}
        actions={<>
          <ViewToggle value={view} onChange={setView} />
          <Button icon={<Plus />} disabled={readOnly} onClick={() => setOpen(true)}>{t('tradeins.new')}</Button>
        </>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="♻️" tone="purple" label={t('tradeins.count')} value={String(tradeIns.filter((x) => x.status !== 'cancelled').length)} />
        <StatCard icon="💵" tone="amber" label={t('tradeins.invested')} value={f.money(cost)} />
        <StatCard icon="🏷️" tone="green" label={t('tradeins.stockValue')} value={f.money(value)} />
        <StatCard icon="📈" tone="indigo" label={t('tradeins.margin')} value={`${margin}%`} sub={t('tradeins.marginHint', { margin: s.tradeInMargin })} />
      </div>
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('tradeins.searchPlaceholder')} /></Toolbar>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={status === 'all'} onClick={() => setStatus('all')} count={tradeIns.length}>📋 {t('common.all')}</Pill>
        {TRADE_IN_STATUSES.map((st) => <Pill key={st} active={status === st} onClick={() => setStatus(st)} count={tradeIns.filter((x) => x.status === st).length}>{TRADE_IN_STATUS_ICONS[st]} {t(`tradeins.status_${st}`)}</Pill>)}
      </div>

      {list.length === 0 ? (
        <Card><EmptyState icon="♻️" title={t('tradeins.empty')} action={<Button size="sm" icon={<Plus />} disabled={readOnly} onClick={() => setOpen(true)}>{t('tradeins.new')}</Button>} /></Card>
      ) : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((ti) => (
            <Card key={ti.id} className="p-4 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div><div className="font-mono text-sm font-bold text-primary">{ti.number}</div><div className="font-semibold text-sl-text">{ti.device}</div></div>
                <div className="flex flex-col items-end gap-1">
                  <Badge color={STATUS_COLORS[ti.status]}>{TRADE_IN_STATUS_ICONS[ti.status]} {t(`tradeins.status_${ti.status}`)}</Badge>
                  <Badge color="slate">{t(`tradeins.cond_${ti.condition}`)}</Badge>
                </div>
              </div>
              <div className="mt-2 text-xs text-sl-muted">👤 {ti.customerName} · 📅 {f.date(ti.date)}{ti.imei ? ` · #${ti.imei}` : ''}</div>
              <div className="mt-3 flex items-end justify-between rounded-lg bg-sl-hover p-2 text-sm">
                <div><div className="text-[10px] text-sl-muted">{t('tradeins.buyPrice')}</div><div className="font-bold text-amber-600 dark:text-amber-400">{f.money(ti.buyPrice)}</div></div>
                <div className="text-end"><div className="text-[10px] text-sl-muted">{t('tradeins.listPrice')}</div><div className="font-bold text-emerald-600 dark:text-emerald-400">{ti.listPrice !== undefined ? f.money(ti.listPrice) : '—'}</div></div>
              </div>
              <div className="mt-2 border-t border-sl-border pt-2">{actions(ti)}</div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(ti) => ti.id!} minWidth={900}
          columns={[
            { key: 'number', label: t('tradeins.number'), render: (ti) => <span className="font-mono text-xs font-bold text-primary">{ti.number}</span> },
            { key: 'date', label: t('common.date'), render: (ti) => f.date(ti.date) },
            { key: 'customerName', label: t('common.customer'), render: (ti) => <span className="font-semibold">{ti.customerName}</span> },
            { key: 'device', label: t('tradeins.device') },
            { key: 'imei', label: t('inventory.imei'), render: (ti) => <span className="font-mono text-xs">{ti.imei || '—'}</span> },
            { key: 'condition', label: t('tradeins.condition'), render: (ti) => <Badge color="slate">{t(`tradeins.cond_${ti.condition}`)}</Badge> },
            { key: 'buyPrice', label: t('tradeins.buyPrice'), render: (ti) => f.money(ti.buyPrice), className: 'text-end' },
            { key: 'listPrice', label: t('tradeins.listPrice'), render: (ti) => ti.listPrice !== undefined ? f.money(ti.listPrice) : '—', className: 'text-end' },
            { key: 'status', label: t('common.status'), render: (ti) => <Badge color={STATUS_COLORS[ti.status]}>{TRADE_IN_STATUS_ICONS[ti.status]} {t(`tradeins.status_${ti.status}`)}</Badge> },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}

      {/* Formulario de tasación */}
      <Modal open={open} onClose={() => setOpen(false)} size="md" title={`♻️ ${t('tradeins.new')}`} subtitle={t('tradeins.quoteHint')}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('tradeins.quote')}</Button></>}>
        <div className="space-y-3">
          <Select label={t('tradeins.existingCustomer')} value={form.customerId} onChange={(e) => pickCustomer(e.target.value)}>
            <option value="">{t('tradeins.walkIn')}</option>
            {customers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </Select>
          <Input label={t('common.customer')} requiredMark value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('tradeins.device')} requiredMark value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} placeholder="iPhone 12 · Blue 64GB" />
            <Input label={t('inventory.imei')} value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Select label={t('tradeins.condition')} value={form.condition} onChange={(e) => setForm({ ...form, condition: e.target.value as TradeInCondition })}>
              {TRADE_IN_CONDITIONS.map((c) => <option key={c.id} value={c.id}>{c.icon} {t(`tradeins.cond_${c.id}`)}</option>)}
            </Select>
            <Input label={t('tradeins.buyPrice')} type="number" step="0.01" min="0" requiredMark value={form.buyPrice} onChange={(e) => setForm({ ...form, buyPrice: e.target.value })} hint={t('tradeins.priceHint', { price: f.money(Number(form.buyPrice) * (1 + s.tradeInMargin / 100)) })} />
          </div>
          <TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
        </div>
      </Modal>

      {/* Listar en inventario */}
      <Modal open={!!listFor} onClose={() => setListFor(null)} size="sm" title={`📦 ${t('tradeins.list')}`} subtitle={listFor?.number}
        footer={<><Button variant="secondary" onClick={() => setListFor(null)}>{t('common.cancel')}</Button><Button onClick={listUnit}>{t('tradeins.listCreate')}</Button></>}>
        {listFor && (
          <div className="space-y-3">
            <InfoRow label={t('tradeins.device')} value={listFor.device} />
            <InfoRow label={t('tradeins.buyPrice')} value={f.money(listFor.buyPrice)} />
            <Input label={t('tradeins.listPrice')} type="number" step="0.01" min="0" value={listPrice} onChange={(e) => setListPrice(e.target.value)} hint={t('tradeins.priceHint', { price: f.money(Number(listPrice)) })} />
            <p className="text-[11px] text-sl-muted">💡 {t('tradeins.listHint')}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
