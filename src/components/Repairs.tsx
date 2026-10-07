import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Eye, Mail, MessageCircle, Pencil, Plus, Printer, Trash } from 'lucide-react';
import { db, getSettings } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { pad, splitVat } from '../lib/calc';
import { logAction } from '../lib/audit';
import { channelReady, type SendTarget } from '../lib/channels';
import { dispatchMessage, fallbackLink } from '../lib/messaging';
import { DEFAULT_AUTOMATIONS } from '../data/automations';
import { DeviceHistory } from './DeviceHistory';
import { REPAIR_STATUS_COLORS } from '../lib/colors';
import { createInvoiceFromRepair } from '../lib/invoices';
import { printHtml, repairReceiptHtml } from '../lib/print';
import { repairSchema, validateForm, type FormErrors } from '../schemas';
import type { ChannelId, Repair, RepairStatus } from '../types';
import { REPAIR_STATUSES, REPAIR_STATUS_ICONS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, InfoRow, SearchInput, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';

/** Read the clock outside the component so its body stays free of impure calls. */
const nowIso = () => new Date().toISOString();
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type RForm = { customerName: string; customerPhone: string; customerEmail: string; device: string; imei: string; problem: string; diagnosis: string; notes: string; status: RepairStatus; estimatedCost: string; finalCost: string };
const emptyForm = (): RForm => ({ customerName: '', customerPhone: '', customerEmail: '', device: '', imei: '', problem: '', diagnosis: '', notes: '', status: 'received', estimatedCost: '', finalCost: '' });

const NEXT: Partial<Record<RepairStatus, RepairStatus[]>> = {
  received: ['diagnosis', 'cancelled'],
  diagnosis: ['in_progress', 'waiting_parts', 'cancelled'],
  in_progress: ['waiting_parts', 'completed'],
  waiting_parts: ['in_progress', 'completed'],
  completed: ['delivered'],
};

export function RepairStatusBadge({ status }: { status: RepairStatus }) {
  const { t } = useTranslation();
  return <Badge color={REPAIR_STATUS_COLORS[status]}>{REPAIR_STATUS_ICONS[status]} {t(`repairStatus.${status}`)}</Badge>;
}

export function Repairs() {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const repairs = useLiveQuery(() => db.repairs.reverse().sortBy('dateIn'), []);
  // Manual send actions: available as soon as the channel is configured, since the
  // automations govern automatic sends, not the user's explicit choice.
  const canSendWa = channelReady(s.channels, 'whatsapp');
  const canSendMail = channelReady(s.channels, 'email');
  const buildTarget = (r: Repair, id: ChannelId): SendTarget => ({
    contact: id === 'whatsapp' ? r.customerPhone : (r.customerEmail ?? ''),
    customer: r.customerName,
    reference: r.ticketNumber,
    detail: `${r.device} · ${t(`repairStatus.${r.status}`)}`,
  });
  /** Real send through the server relay; without it, the old deep link opens. */
  const sendMessage = async (r: Repair, id: ChannelId) => {
    const target = buildTarget(r, id);
    setSending(true);
    try {
      const outcome = await dispatchMessage(s.channels!, s.storeName, id, target);
      if (outcome !== 'relay') window.open(fallbackLink(s.channels!, s.storeName, id, target), '_blank', 'noopener,noreferrer');
      await logAction('send', 'repairs', `${r.ticketNumber} · ${id} · ${outcome}`);
      if (outcome === 'relay') toast.success(t('channels.sentOk'));
      else if (outcome === 'failed') toast.warning(t('channels.sendQueued'));
    } finally {
      setSending(false);
    }
  };
  const automationOn = (id: string) => (s.automations?.[id] ?? DEFAULT_AUTOMATIONS[id]) === true;
  /**
   * The `wa_repair_ready` / `em_repair_completed` automations send the notice as
   * soon as the repair is completed. The manual prompt only appears when some
   * ready channel was not auto-sent (relay missing or automation switched off).
   */
  const notifyCompleted = async (r: Repair) => {
    const wants: ChannelId[] = [];
    if (automationOn('wa_repair_ready') && canSendWa && r.customerPhone) wants.push('whatsapp');
    if (automationOn('em_repair_completed') && canSendMail && r.customerEmail) wants.push('email');
    let relayed = 0;
    for (const id of wants) {
      const outcome = await dispatchMessage(s.channels!, s.storeName, id, buildTarget(r, id));
      await logAction('send', 'repairs', `${r.ticketNumber} · ${id} · auto · ${outcome}`);
      if (outcome === 'relay') relayed += 1;
      else if (outcome === 'failed') toast.warning(t('channels.sendQueued'));
    }
    if (wants.length && relayed === wants.length) {
      toast.success(t('channels.autoSent'));
      return;
    }
    if (relayed > 0) toast.success(t('channels.autoSent'));
    setNotify(r);
  };
  const setActive = useStore((x) => x.setActiveModule);
  const goToChannels = () => { localStorage.setItem('sl_settings_section', 'channels'); setActive('settings'); setNotify(null); };
  const canNotifyWa = (r: Repair | null) => canSendWa && !!r?.customerPhone;
  const canNotifyMail = (r: Repair | null) => canSendMail && !!r?.customerEmail;
  const customers = useLiveQuery(() => db.customers.orderBy('name').toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.toArray(), []);
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<RepairStatus | 'all'>('all');
  const [view, setView] = useViewMode('repairs');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Repair | null>(null);
  const [form, setForm] = useState<RForm>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [existing, setExisting] = useState('');
  const [detail, setDetail] = useState<Repair | null>(null);
  const [notify, setNotify] = useState<Repair | null>(null);
  const [device, setDevice] = useState('');
  const [sending, setSending] = useState(false);

  const list = useMemo(() => (repairs ?? []).filter((r) => (status === 'all' || r.status === status) && matches(q, r.ticketNumber, r.customerName, r.customerPhone, r.device, r.imei, r.problem)), [repairs, q, status]);
  if (!repairs || !customers || !invoices) return <LoadingPage />;

  const openNew = () => { setEditing(null); setForm(emptyForm()); setErrors({}); setExisting(''); setOpen(true); };
  const openEdit = (r: Repair) => {
    setEditing(r); setExisting(r.customerId ? String(r.customerId) : '');
    setForm({ customerName: r.customerName, customerPhone: r.customerPhone, customerEmail: r.customerEmail ?? '', device: r.device, imei: r.imei ?? '', problem: r.problem, diagnosis: r.diagnosis ?? '', notes: r.notes ?? '', status: r.status, estimatedCost: String(r.estimatedCost), finalCost: r.finalCost !== undefined ? String(r.finalCost) : '' });
    setErrors({}); setOpen(true);
  };
  const pickCustomer = (id: string) => {
    setExisting(id);
    const c = customers.find((x) => String(x.id) === id);
    if (c) setForm((fm) => ({ ...fm, customerName: c.name, customerPhone: c.phone, customerEmail: c.email ?? '' }));
  };

  const maybeInvoice = async (r: Repair) => {
    const st = await getSettings();
    if (!st.invoiceAutoGenerateOnDelivery) return;
    if ((await db.invoices.where('repairId').equals(r.id!).count()) > 0) return;
    const inv = await createInvoiceFromRepair(r, t('repairs.repairOf'));
    await logAction('create', 'billing', `${inv.number} ← ${r.ticketNumber}`);
    toast.info(t('repairs.invoiceCreated', { number: inv.number }));
  };

  const ensureCustomer = async (name: string, phone: string, email?: string): Promise<number> => {
    if (existing) return Number(existing);
    const found = await db.customers.where('phone').equals(phone).first();
    if (found) return found.id!;
    const id = await db.customers.add({ name, phone, email, totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: nowIso() });
    await logAction('create', 'clients', `${name} (${t('repairs.autoCreated')})`);
    toast.info(t('repairs.customerCreated', { name }));
    return id;
  };

  const save = async () => {
    const r = validateForm(repairSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    const d = r.data;
    const customerId = await ensureCustomer(d.customerName, d.customerPhone, d.customerEmail || undefined);
    const payload = { ...d, customerEmail: d.customerEmail || undefined, customerId };
    if (editing) {
      const delivered = d.status === 'delivered' && editing.status !== 'delivered';
      const dateOut = ['completed', 'delivered'].includes(d.status) ? editing.dateOut ?? nowIso() : undefined;
      await db.repairs.update(editing.id!, { ...payload, dateOut });
      await logAction('update', 'repairs', editing.ticketNumber);
      toast.success(t('common.updated'));
      if (delivered) await maybeInvoice({ ...editing, ...payload, dateOut });
      // Completed from the edit form: the automations send it, else the prompt offers it.
      if (d.status === 'completed' && editing.status !== 'completed') await notifyCompleted({ ...editing, ...payload, dateOut } as Repair);
    } else {
      const last = await db.repairs.toCollection().last();
      const n = last ? (parseInt(last.ticketNumber.replace(/\D/g, ''), 10) || 0) + 1 : 1;
      const now = nowIso();
      const dateOut = ['completed', 'delivered'].includes(d.status) ? now : undefined;
      const rep: Repair = { ...payload, ticketNumber: `R-${pad(n)}`, dateIn: now, createdAt: now, dateOut };
      rep.id = await db.repairs.add(rep);
      await logAction('create', 'repairs', `${rep.ticketNumber} · ${rep.device}`);
      toast.success(t('repairs.created', { ticket: rep.ticketNumber }));
      if (rep.status === 'delivered') await maybeInvoice(rep);
    }
    setOpen(false);
  };

  const changeStatus = async (r: Repair, st: RepairStatus) => {
    const dateOut = ['completed', 'delivered'].includes(st) ? r.dateOut ?? nowIso() : r.dateOut;
    const patch: Partial<Repair> = { status: st, dateOut };
    if (st === 'completed' && r.finalCost === undefined) patch.finalCost = r.estimatedCost;
    await db.repairs.update(r.id!, patch);
    await logAction('status_change', 'repairs', `${r.ticketNumber}: ${t(`repairStatus.${r.status}`)} → ${t(`repairStatus.${st}`)}`);
    toast.success(`${r.ticketNumber} → ${t(`repairStatus.${st}`)}`);
    if (st === 'delivered') await maybeInvoice({ ...r, ...patch });
    if (st === 'completed' && r.status !== 'completed') {
      // The detail modal would sit underneath the prompt, so close it and hand over to the notice.
      setDetail(null);
      await notifyCompleted({ ...r, ...patch });
    } else if (detail?.id === r.id) setDetail({ ...r, ...patch });
  };
  const remove = async (r: Repair) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: r.ticketNumber }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.repairs.delete(r.id!);
    await logAction('delete', 'repairs', r.ticketNumber);
    toast.success(t('common.deleted'));
  };
  const print = (r: Repair) => { printHtml(repairReceiptHtml(r, s, t), r.ticketNumber); logAction('print', 'repairs', r.ticketNumber); };
  const invoiced = (r: Repair) => invoices.some((i) => i.repairId === r.id);

  const vatLine = (n: number | undefined) => {
    if (n === undefined || n === null) return <span className="text-sl-muted">—</span>;
    const v = splitVat(n, s.taxRate);
    return <div className="leading-tight"><div className="font-bold text-sl-text">{f.money(v.total)}</div><div className="text-[10px] text-sl-muted">{f.money(v.base)} + {f.money(v.vat)} {t('tax.vat')}</div></div>;
  };
  const quick = (r: Repair, small = true) => (
    <div className="flex flex-wrap gap-1">
      {(NEXT[r.status] ?? []).map((st) => (
        <Button key={st} size="sm" variant={st === 'cancelled' ? 'ghost' : st === 'delivered' || st === 'completed' ? 'success' : 'secondary'} className={small ? '!h-7 !px-2 !text-[11px]' : ''} onClick={() => changeStatus(r, st)}>
          {REPAIR_STATUS_ICONS[st]} {t(`repairStatus.${st}`)}
        </Button>
      ))}
    </div>
  );
  const rowActions = (r: Repair) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('common.view')} onClick={() => setDetail(r)}><Eye /></IconButton>
      <IconButton title={t('repairs.printReceipt')} onClick={() => print(r)}><Printer /></IconButton>
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(r)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(r)}><Trash /></IconButton>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="🔧" title={t('nav.repairs')} subtitle={t('repairs.subtitle')}
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('repairs.new')}</Button></>} />

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
        <button type="button" onClick={() => setStatus('all')} className={`rounded-xl border bg-sl-card p-3 text-start shadow-sm ${status === 'all' ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border hover:border-primary/40'}`}>
          <div className="text-xl font-extrabold text-sl-text">{repairs.length}</div>
          <div className="truncate text-[11px] font-medium text-sl-muted">📋 {t('common.all')}</div>
        </button>
        {REPAIR_STATUSES.map((st) => (
          <button key={st} type="button" onClick={() => setStatus(status === st ? 'all' : st)} className={`rounded-xl border bg-sl-card p-3 text-start shadow-sm ${status === st ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border hover:border-primary/40'}`}>
            <div className="text-xl font-extrabold text-sl-text">{repairs.filter((r) => r.status === st).length}</div>
            <div className="truncate text-[11px] font-medium text-sl-muted">{REPAIR_STATUS_ICONS[st]} {t(`repairStatus.${st}`)}</div>
          </button>
        ))}
      </div>

      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('repairs.searchPlaceholder')} /></Toolbar>

      {list.length === 0 ? <Card><EmptyState icon="🔧" title={t('common.noResults')} action={<Button size="sm" icon={<Plus />} onClick={openNew}>{t('repairs.new')}</Button>} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
          {list.map((r) => (
            <Card key={r.id} className="flex flex-col p-4 animate-slide-up">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-mono text-xs font-bold text-primary">{r.ticketNumber}</div>
                  <div className="mt-0.5 text-base font-bold text-sl-text">📱 {r.device}</div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <RepairStatusBadge status={r.status} />
                  {invoiced(r) && <Badge color="indigo">📄 {t('repairs.invoiced')}</Badge>}
                </div>
              </div>
              <div className="mt-2 text-sm text-sl-text">👤 {r.customerName} · <span className="text-sl-muted">{r.customerPhone}</span></div>
              <div className="mt-1 line-clamp-2 text-xs text-sl-muted">⚠️ {r.problem}</div>
              <div className="mt-1 text-[11px] text-sl-muted">📅 {f.dateTime(r.dateIn)}</div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-sl-hover p-2 text-xs">
                <div><div className="mb-0.5 text-sl-muted">{t('repairs.estimate')}</div>{vatLine(r.estimatedCost)}</div>
                <div><div className="mb-0.5 text-sl-muted">{t('repairs.finalCost')}</div>{vatLine(r.finalCost)}</div>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-sl-border pt-3">
                {quick(r)}
                {rowActions(r)}
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(r) => r.id!} onRowClick={(r) => setDetail(r)} minWidth={1000}
          columns={[
            { key: 'ticketNumber', label: t('repairs.ticket'), render: (r) => <span className="font-mono text-xs font-bold text-primary">{r.ticketNumber}</span> },
            { key: 'dateIn', label: t('common.date'), render: (r) => f.date(r.dateIn) },
            { key: 'customerName', label: t('common.customer'), render: (r) => <div><div className="font-semibold">{r.customerName}</div><div className="text-[11px] text-sl-muted">{r.customerPhone}</div></div> },
            { key: 'device', label: t('repairs.device') },
            { key: 'problem', label: t('repairs.problem'), render: (r) => <span className="line-clamp-1 max-w-[220px] text-sl-muted">{r.problem}</span> },
            { key: 'status', label: t('common.status'), render: (r) => <RepairStatusBadge status={r.status} />, sortValue: (r) => REPAIR_STATUSES.indexOf(r.status) },
            { key: 'estimatedCost', label: t('repairs.estimate'), render: (r) => vatLine(r.estimatedCost) },
            { key: 'finalCost', label: t('repairs.finalCost'), render: (r) => vatLine(r.finalCost) },
            { key: '_a', label: '', sortable: false, render: rowActions },
          ]} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? `✏️ ${editing.ticketNumber}` : `➕ ${t('repairs.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="rounded-xl border border-sl-border bg-sl-card2 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">👤 {t('common.customer')}</div>
            <Select label={t('repairs.existingCustomer')} value={existing} onChange={(e) => (e.target.value ? pickCustomer(e.target.value) : setExisting(''))}>
              <option value="">➕ {t('repairs.newCustomerOption')}</option>
              {customers.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.phone}</option>)}
            </Select>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Input label={t('common.name')} requiredMark value={form.customerName} onChange={(e) => setForm({ ...form, customerName: e.target.value })} error={errors.customerName} />
              <Input label={t('common.phone')} requiredMark value={form.customerPhone} onChange={(e) => setForm({ ...form, customerPhone: e.target.value })} error={errors.customerPhone} />
              <Input label={t('common.email')} type="email" value={form.customerEmail} onChange={(e) => setForm({ ...form, customerEmail: e.target.value })} error={errors.customerEmail} />
            </div>
            {!existing && <p className="mt-2 text-[11px] text-sl-muted">💡 {t('repairs.autoCustomerHint')}</p>}
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('repairs.device')} requiredMark placeholder="iPhone 13, Galaxy S23…" value={form.device} onChange={(e) => setForm({ ...form, device: e.target.value })} error={errors.device} />
            <Input label="IMEI" hint={t('common.optional')} value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} />
            <div className="sm:col-span-2"><TextArea label={t('repairs.problem')} requiredMark value={form.problem} onChange={(e) => setForm({ ...form, problem: e.target.value })} error={errors.problem} /></div>
            <TextArea label={t('repairs.diagnosis')} value={form.diagnosis} onChange={(e) => setForm({ ...form, diagnosis: e.target.value })} />
            <TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <Select label={t('common.status')} value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as RepairStatus })}>
              {REPAIR_STATUSES.map((st) => <option key={st} value={st}>{REPAIR_STATUS_ICONS[st]} {t(`repairStatus.${st}`)}</option>)}
            </Select>
            <div className="grid grid-cols-2 gap-3">
              <Input label={`${t('repairs.estimate')} (${t('tax.included')})`} type="number" step="0.01" min="0" value={form.estimatedCost} onChange={(e) => setForm({ ...form, estimatedCost: e.target.value })} error={errors.estimatedCost} />
              <Input label={t('repairs.finalCost')} type="number" step="0.01" min="0" value={form.finalCost} onChange={(e) => setForm({ ...form, finalCost: e.target.value })} error={errors.finalCost} />
            </div>
          </div>
          {Number(form.estimatedCost) > 0 && (
            <div className="rounded-lg bg-sl-hover p-3 text-xs text-sl-muted">
              🧮 {t('repairs.estimate')}: {(() => { const v = splitVat(Number(form.finalCost || form.estimatedCost), s.taxRate); return <><b>{f.money(v.base)}</b> + <b>{f.money(v.vat)}</b> {t('tax.vat')} ({s.taxRate}%) = <b className="text-sl-text">{f.money(v.total)}</b></>; })()}
            </div>
          )}
        </div>
      </Modal>

      <Modal open={!!detail} onClose={() => setDetail(null)} size="lg" title={detail ? `🔧 ${detail.ticketNumber} · ${detail.device}` : ''}
        footer={detail && <>
          <Button variant="secondary" icon={<Printer />} onClick={() => print(detail)}>{t('repairs.printReceipt')}</Button>
          {canSendWa && !!detail.customerPhone && <Button variant="success" icon={<MessageCircle />} disabled={sending} loading={sending} onClick={() => { void sendMessage(detail, 'whatsapp'); }}>{t('channels.sendWhatsApp')}</Button>}
          {canSendMail && !!detail.customerEmail && <Button variant="secondary" icon={<Mail />} disabled={sending} loading={sending} onClick={() => { void sendMessage(detail, 'email'); }}>{t('channels.sendEmail')}</Button>}
          <Button variant="outline" icon={<Pencil />} onClick={() => { const d = detail; setDetail(null); openEdit(d); }}>{t('common.edit')}</Button>
        </>}>
        {detail && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2"><RepairStatusBadge status={detail.status} />{invoiced(detail) && <Badge color="indigo">📄 {t('repairs.invoiced')}</Badge>}</div>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <InfoRow label={t('common.customer')} value={detail.customerName} />
                <InfoRow label={t('common.phone')} value={detail.customerPhone} />
                <InfoRow label={t('common.email')} value={detail.customerEmail || '—'} />
                <InfoRow label={t('repairs.dateIn')} value={f.dateTime(detail.dateIn)} />
                <InfoRow label={t('repairs.dateOut')} value={f.dateTime(detail.dateOut)} />
              </div>
              <div>
                <InfoRow label={t('repairs.device')} value={detail.device} />
                <InfoRow label="IMEI" value={detail.imei ? (
                  <button type="button" onClick={() => setDevice(detail.imei)} title={t('device.open')}
                    className="rounded px-1 font-mono hover:bg-sl-hover hover:text-primary">📟 {detail.imei}</button>
                ) : <span className="font-mono">—</span>} />
                <InfoRow label={t('repairs.estimate')} value={vatLine(detail.estimatedCost)} />
                <InfoRow label={t('repairs.finalCost')} value={vatLine(detail.finalCost)} />
              </div>
            </div>
            <div className="rounded-lg bg-sl-hover p-3 text-sm"><b>⚠️ {t('repairs.problem')}:</b> {detail.problem}</div>
            {detail.diagnosis && <div className="rounded-lg bg-sl-hover p-3 text-sm"><b>🔍 {t('repairs.diagnosis')}:</b> {detail.diagnosis}</div>}
            {detail.notes && <div className="rounded-lg bg-sl-hover p-3 text-sm"><b>📝 {t('common.notes')}:</b> {detail.notes}</div>}
            {(NEXT[detail.status] ?? []).length > 0 && <div><div className="mb-2 text-xs font-bold uppercase text-sl-muted">{t('repairs.quickStatus')}</div>{quick(detail, false)}</div>}
          </div>
        )}
      </Modal>

      <Modal open={!!notify} onClose={() => setNotify(null)} size="sm"
        title={notify ? `✅ ${t('repairStatus.completed')} · ${notify.ticketNumber}` : ''}
        footer={notify && <>
          {canNotifyWa(notify) && <Button variant="success" icon={<MessageCircle />} disabled={sending} loading={sending} onClick={() => { const r = notify; setNotify(null); void sendMessage(r, 'whatsapp'); }}>{t('channels.sendWhatsApp')}</Button>}
          {canNotifyMail(notify) && <Button variant="secondary" icon={<Mail />} disabled={sending} loading={sending} onClick={() => { const r = notify; setNotify(null); void sendMessage(r, 'email'); }}>{t('channels.sendEmail')}</Button>}
          {!canNotifyWa(notify) && !canNotifyMail(notify) && <Button variant="secondary" onClick={goToChannels}>📡 {t('channels.configure')}</Button>}
          <Button variant="secondary" onClick={() => setNotify(null)}>{t('common.close')}</Button>
        </>}>
        {notify && (
          <div className="space-y-3">
            <p className="text-sm text-sl-muted">{t('automations.wa_repair_ready_desc')}</p>
            <div className="rounded-lg bg-sl-hover p-3 text-sm">
              <div className="font-semibold text-sl-text">{notify.customerName}</div>
              <div className="text-xs text-sl-muted">{notify.customerPhone}{notify.customerEmail ? ` · ${notify.customerEmail}` : ''}</div>
            </div>
            <div className="rounded-lg bg-sl-hover p-3 text-sm"><b>📱 {t('repairs.device')}:</b> {notify.device}</div>
          </div>
        )}
      </Modal>

      {device && <DeviceHistory imei={device} onClose={() => setDevice('')} />}
    </div>
  );
}