import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash, Eye } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { logAction } from '../lib/audit';
import { customerSchema, validateForm, type FormErrors } from '../schemas';
import type { Customer } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';
import { ClientDossier } from './ClientDossier';

type CForm = { name: string; phone: string; email: string; address: string; dni: string; notes: string };
const empty: CForm = { name: '', phone: '', email: '', address: '', dni: '', notes: '' };

export function loyaltyTier(spent: number): { label: string; color: 'amber' | 'slate' | 'orange' | 'cyan' } {
  if (spent >= 1000) return { label: '🥇 Gold', color: 'amber' };
  if (spent >= 300) return { label: '🥈 Silver', color: 'slate' };
  if (spent > 0) return { label: '🥉 Bronze', color: 'orange' };
  return { label: '🆕', color: 'cyan' };
}

export function Clients() {
  const { t } = useTranslation();
  const f = useFormat();
  const customers = useLiveQuery(() => db.customers.toArray(), []);
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('clients');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Customer | null>(null);
  const [form, setForm] = useState<CForm>(empty);
  const [errors, setErrors] = useState<FormErrors>({});
  const [dossier, setDossier] = useState<Customer | null>(null);

  const list = useMemo(() => (customers ?? []).filter((c) => matches(q, c.name, c.phone, c.email, c.dni)), [customers, q]);
  if (!customers) return <LoadingPage />;

  const openNew = () => { setEditing(null); setForm(empty); setErrors({}); setOpen(true); };
  const openEdit = (c: Customer) => { setEditing(c); setForm({ name: c.name, phone: c.phone, email: c.email ?? '', address: c.address ?? '', dni: c.dni ?? '', notes: c.notes ?? '' }); setErrors({}); setOpen(true); };
  const save = async () => {
    const r = validateForm(customerSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    const d = { ...r.data, email: r.data.email || undefined };
    if (editing) { await db.customers.update(editing.id!, d); await logAction('update', 'clients', d.name); toast.success(t('common.updated')); }
    else { await db.customers.add({ ...d, totalSpent: 0, visits: 0, loyaltyPoints: 0, createdAt: new Date().toISOString() }); await logAction('create', 'clients', d.name); toast.success(t('common.created')); }
    setOpen(false);
  };
  const remove = async (c: Customer) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: c.name }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.customers.delete(c.id!); await logAction('delete', 'clients', c.name); toast.success(t('common.deleted'));
  };
  const actions = (c: Customer) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('clients.dossier')} onClick={() => setDossier(c)}><Eye /></IconButton>
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(c)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(c)}><Trash /></IconButton>
    </div>
  );
  const total = customers.reduce((a, c) => a + c.totalSpent, 0);
  const points = customers.reduce((a, c) => a + (c.loyaltyPoints ?? 0), 0);
  const top = [...customers].sort((a, b) => b.totalSpent - a.totalSpent)[0];

  return (
    <div className="space-y-4">
      <PageHeader icon="👥" title={t('nav.clients')} subtitle={t('clients.subtitle')} actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('clients.new')}</Button></>} />
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="👥" tone="indigo" label={t('clients.total')} value={customers.length} />
        <StatCard icon="💶" tone="green" label={t('clients.totalSpent')} value={f.money(total)} sub={t('clients.avg', { value: f.money(customers.length ? total / customers.length : 0) })} />
        <StatCard icon="⭐" tone="purple" label={t('clients.pointsTotal')} value={points} sub={t('clients.pointsHint', { rate: f.settings.loyaltyRate })} />
        <StatCard icon="🏆" tone="amber" label={t('clients.best')} value={top?.name ?? '—'} sub={top ? f.money(top.totalSpent) : undefined} />
      </div>
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('clients.searchPlaceholder')} /></Toolbar>
      {list.length === 0 ? <Card><EmptyState icon="👥" title={t('common.noResults')} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((c) => {
            const tier = loyaltyTier(c.totalSpent);
            return (
              <Card key={c.id} className="p-4 animate-slide-up">
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 text-lg font-bold text-white">{c.name.charAt(0).toUpperCase()}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-sl-text">{c.name}</div>
                    <div className="text-xs text-sl-muted">🪪 {c.dni || '—'}</div>
                  </div>
                  {actions(c)}
                </div>
                <div className="mt-3 space-y-1 text-xs text-sl-muted">
                  <div className="truncate">📞 {c.phone}</div>
                  <div className="truncate">✉️ {c.email || '—'}</div>
                  <div className="truncate">⭐ {c.loyaltyPoints ?? 0} {t('clients.points')}</div>
                  <div className="truncate">📍 {c.address || '—'}</div>
                </div>
                <div className="mt-3 flex items-center justify-between rounded-lg bg-sl-hover p-2 text-xs">
                  <div><div className="text-sl-muted">{t('clients.totalSpent')}</div><div className="font-bold text-sl-text">{f.money(c.totalSpent)}</div></div>
                  <div className="text-end"><div className="text-sl-muted">{t('clients.visits')}</div><div className="font-bold text-sl-text">{c.visits}</div></div>
                  <Badge color={tier.color}>{tier.label}</Badge>
                </div>
              </Card>
            );
          })}
        </div>
      ) : (
        <DataTable data={list} rowKey={(c) => c.id!} onRowClick={(c) => setDossier(c)}
          columns={[
            { key: 'name', label: t('common.name'), render: (c) => <div className="flex items-center gap-2"><span className="flex size-7 items-center justify-center rounded-full bg-primary/15 text-xs font-bold text-primary">{c.name.charAt(0)}</span><span className="font-semibold">{c.name}</span></div> },
            { key: 'phone', label: t('common.phone') },
            { key: 'email', label: t('common.email'), render: (c) => c.email || '—' },
            { key: 'dni', label: t('clients.dni'), render: (c) => c.dni || '—' },
            { key: 'totalSpent', label: t('clients.totalSpent'), render: (c) => <b>{f.money(c.totalSpent)}</b> },
            { key: 'visits', label: t('clients.visits') },
            { key: 'loyaltyPoints', label: t('clients.points'), render: (c) => <Badge color="purple">⭐ {c.loyaltyPoints ?? 0}</Badge> },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? `✏️ ${editing.name}` : `➕ ${t('clients.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t('common.name')} requiredMark value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label={t('common.phone')} requiredMark value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Input label={t('clients.dni')} value={form.dni} onChange={(e) => setForm({ ...form, dni: e.target.value })} />
          <div className="sm:col-span-2"><Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} /></div>
          <div className="sm:col-span-2"><TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
      {dossier && (
        <ClientDossier customer={dossier} onClose={() => setDossier(null)}
          onEdit={() => { const c = dossier; setDossier(null); openEdit(c); }} />
      )}
    </div>
  );
}