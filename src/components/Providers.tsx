import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { matches } from '../lib/hooks';
import { logAction } from '../lib/audit';
import { providerSchema, validateForm, type FormErrors } from '../schemas';
import type { Provider } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Card, EmptyState, IconButton, SearchInput, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type PForm = { name: string; contact: string; phone: string; email: string; address: string; cif: string; notes: string };
const empty: PForm = { name: '', contact: '', phone: '', email: '', address: '', cif: '', notes: '' };

export function Providers() {
  const { t } = useTranslation();
  const providers = useLiveQuery(() => db.providers.toArray(), []);
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('providers');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Provider | null>(null);
  const [form, setForm] = useState<PForm>(empty);
  const [errors, setErrors] = useState<FormErrors>({});

  const list = useMemo(() => (providers ?? []).filter((p) => matches(q, p.name, p.contact, p.phone, p.email, p.cif)), [providers, q]);
  if (!providers) return <LoadingPage />;

  const openNew = () => { setEditing(null); setForm(empty); setErrors({}); setOpen(true); };
  const openEdit = (p: Provider) => { setEditing(p); setForm({ name: p.name, contact: p.contact, phone: p.phone, email: p.email ?? '', address: p.address ?? '', cif: p.cif ?? '', notes: p.notes ?? '' }); setErrors({}); setOpen(true); };
  const save = async () => {
    const r = validateForm(providerSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    const d = { ...r.data, email: r.data.email || undefined };
    if (editing) { await db.providers.update(editing.id!, d); await logAction('update', 'providers', d.name); toast.success(t('common.updated')); }
    else { await db.providers.add({ ...d, createdAt: new Date().toISOString() }); await logAction('create', 'providers', d.name); toast.success(t('common.created')); }
    setOpen(false);
  };
  const remove = async (p: Provider) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: p.name }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.providers.delete(p.id!); await logAction('delete', 'providers', p.name); toast.success(t('common.deleted'));
  };
  const actions = (p: Provider) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(p)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(p)}><Trash /></IconButton>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="🚚" title={t('nav.providers')} subtitle={t('providers.subtitle', { count: providers.length })} actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('providers.new')}</Button></>} />
      <Toolbar><SearchInput value={q} onChange={setQ} placeholder={t('providers.searchPlaceholder')} /></Toolbar>
      {list.length === 0 ? <Card><EmptyState icon="🚚" title={t('common.noResults')} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((p) => (
            <Card key={p.id} className="p-4 animate-slide-up">
              <div className="flex items-start gap-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 text-xl text-white">🏢</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-sl-text">{p.name}</div>
                  <div className="text-xs text-sl-muted">{t('providers.cif')}: {p.cif || '—'}</div>
                </div>
                {actions(p)}
              </div>
              <div className="mt-3 space-y-1 text-xs text-sl-muted">
                <div className="truncate">👤 {p.contact}</div>
                <div className="truncate">📞 {p.phone}</div>
                <div className="truncate">✉️ {p.email || '—'}</div>
                <div className="truncate">📍 {p.address || '—'}</div>
              </div>
              {p.notes && <div className="mt-3 rounded-lg bg-sl-hover p-2 text-xs text-sl-muted">📝 {p.notes}</div>}
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(p) => p.id!} onRowClick={openEdit}
          columns={[
            { key: 'name', label: t('providers.company'), render: (p) => <span className="font-semibold">🏢 {p.name}</span> },
            { key: 'contact', label: t('providers.contact') },
            { key: 'phone', label: t('common.phone') },
            { key: 'email', label: t('common.email'), render: (p) => p.email || '—' },
            { key: 'cif', label: t('providers.cif'), render: (p) => p.cif || '—' },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}
      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? `✏️ ${editing.name}` : `➕ ${t('providers.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t('providers.company')} requiredMark value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <Input label={t('providers.cif')} value={form.cif} onChange={(e) => setForm({ ...form, cif: e.target.value })} />
          <Input label={t('providers.contact')} requiredMark value={form.contact} onChange={(e) => setForm({ ...form, contact: e.target.value })} error={errors.contact} />
          <Input label={t('common.phone')} requiredMark value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} error={errors.phone} />
          <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Input label={t('common.address')} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
          <div className="sm:col-span-2"><TextArea label={t('common.notes')} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} /></div>
        </div>
      </Modal>
    </div>
  );
}