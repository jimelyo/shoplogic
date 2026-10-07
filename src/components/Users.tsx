import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { hashPassword } from '../lib/hash';
import { logAction } from '../lib/audit';
import { ADMIN_ONLY } from '../lib/permissions';
import { userSchema, validateForm, type FormErrors } from '../schemas';
import type { NavSection, Role, User } from '../types';
import { ALL_MODULES, DEFAULT_ROLE_PERMISSIONS, ROLES, ROLE_ICONS } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, Pill, SearchInput, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, Toggle } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';
import { MODULE_ICONS, PermissionGrid, RoleBadge, RolePermissionsMatrix } from './shared/RolePermissions';

type UForm = { name: string; email: string; password: string; role: Role; isActive: boolean; permissions: NavSection[] };

type ActionColor = 'green' | 'blue' | 'red' | 'amber' | 'purple' | 'slate' | 'cyan' | 'orange';
const ACTION_COLORS: Record<string, ActionColor> = {
  create: 'green', update: 'blue', delete: 'red', login: 'cyan', logout: 'slate', sale: 'purple', payment: 'green', status_change: 'amber',
  export: 'blue', import: 'amber', reset: 'red', password_change: 'amber', toggle_on: 'green', toggle_off: 'slate', activate: 'green', deactivate: 'red',  print: 'slate', test: 'cyan', send: 'green', open: 'green', close: 'amber', refund: 'orange',
};

export function Users() {
  const { t } = useTranslation();
  const f = useFormat();
  const me = useStore((s) => s.currentUser);
  const users = useLiveQuery(() => db.users.toArray(), []);
  const logs = useLiveQuery(() => db.logs.orderBy('timestamp').reverse().limit(500).toArray(), []);
  const [tab, setTab] = useState<'users' | 'audit' | 'matrix'>('users');
  const [view, setView] = useViewMode('users');
  const [q, setQ] = useState('');
  const [logQ, setLogQ] = useState('');
  const [logModule, setLogModule] = useState('all');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<User | null>(null);
  const [form, setForm] = useState<UForm>({ name: '', email: '', password: '', role: 'cashier', isActive: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.cashier] });
  const [errors, setErrors] = useState<FormErrors>({});

  const list = useMemo(() => (users ?? []).filter((u) => matches(q, u.name, u.email, t(`roles.${u.role}`))), [users, q, t]);
  const logList = useMemo(() => (logs ?? []).filter((l) => (logModule === 'all' || l.module === logModule) && matches(logQ, l.userName, l.action, l.details, l.module)), [logs, logQ, logModule]);
  if (!users || !logs) return <LoadingPage />;
  const admins = users.filter((u) => u.role === 'admin' && u.isActive);

  const openNew = () => { setEditing(null); setForm({ name: '', email: '', password: '', role: 'cashier', isActive: true, permissions: [...DEFAULT_ROLE_PERMISSIONS.cashier] }); setErrors({}); setOpen(true); };
  const openEdit = (u: User) => { setEditing(u); setForm({ name: u.name, email: u.email, password: '', role: u.role, isActive: u.isActive, permissions: [...u.permissions] }); setErrors({}); setOpen(true); };
  const changeRole = (role: Role) => setForm({ ...form, role, permissions: [...DEFAULT_ROLE_PERMISSIONS[role]] });

  const save = async () => {
    const r = validateForm(userSchema, form);
    const errs = { ...r.errors };
    if (!editing && !form.password) errs.password = 'validation.min6';
    setErrors(errs);
    if (!r.success || Object.keys(errs).length) return;
    const d = r.data;
    const dup = await db.users.where('email').equalsIgnoreCase(d.email).first();
    if (dup && dup.id !== editing?.id) { setErrors({ email: 'validation.duplicate' }); return; }
    const permissions = (d.permissions as NavSection[]).filter((m) => d.role === 'admin' || !ADMIN_ONLY.includes(m));
    if (editing) {
      const lastAdmin = editing.role === 'admin' && admins.length <= 1 && (d.role !== 'admin' || !d.isActive);
      if (lastAdmin) { toast.error(t('users.lastAdmin')); return; }
      const patch: Partial<User> = { name: d.name, email: d.email, role: d.role, isActive: d.isActive, permissions };
      if (d.password) patch.password = await hashPassword(d.password);
      await db.users.update(editing.id!, patch);
      await logAction('update', 'users', `${d.email} · ${t(`roles.${d.role}`)} · ${permissions.length}/${ALL_MODULES.length}`);
      if (d.password) await logAction('password_change', 'users', d.email);
      toast.success(t('common.updated'));
    } else {
      await db.users.add({ name: d.name, email: d.email, password: await hashPassword(d.password), role: d.role, permissions, isActive: d.isActive, createdAt: new Date().toISOString() });
      await logAction('create', 'users', `${d.email} · ${t(`roles.${d.role}`)}`);
      toast.success(t('common.created'));
    }
    setOpen(false);
  };
  const toggleActive = async (u: User) => {
    if (u.id === me?.id) { toast.warning(t('users.cantSelf')); return; }
    if (u.isActive && u.role === 'admin' && admins.length <= 1) { toast.error(t('users.lastAdmin')); return; }
    await db.users.update(u.id!, { isActive: !u.isActive });
    await logAction(u.isActive ? 'deactivate' : 'activate', 'users', u.email);
    toast.success(u.isActive ? t('users.deactivated') : t('users.activated'));
  };
  const remove = async (u: User) => {
    if (u.id === me?.id) { toast.warning(t('users.cantSelf')); return; }
    if (u.role === 'admin' && admins.length <= 1) { toast.error(t('users.lastAdmin')); return; }
    if (!(await confirmDialog(t('common.confirmDelete', { name: u.name }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.users.delete(u.id!); await logAction('delete', 'users', u.email); toast.success(t('common.deleted'));
  };
  const actions = (u: User) => (
    <div className="flex items-center justify-end gap-1">
      <Toggle size="sm" checked={u.isActive} onChange={() => toggleActive(u)} />
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(u)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(u)}><Trash /></IconButton>
    </div>
  );
  const modules = [...new Set(logs.map((l) => l.module))];

  return (
    <div className="space-y-4">
      <PageHeader icon="👤" title={t('nav.users')} subtitle={t('users.subtitle')}
        actions={tab === 'users' && <><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('users.new')}</Button></>} />
      <div className="flex gap-2 overflow-x-auto">
        <Pill active={tab === 'users'} onClick={() => setTab('users')} count={users.length}>👥 {t('nav.users')}</Pill>
        <Pill active={tab === 'audit'} onClick={() => setTab('audit')} count={logs.length}>🕵️ {t('users.audit')}</Pill>
        <Pill active={tab === 'matrix'} onClick={() => setTab('matrix')}>🔐 {t('users.rolesMatrix')}</Pill>
      </div>

      {tab === 'users' && <>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {ROLES.map((r) => <Card key={r} className="flex items-center gap-3 p-3"><span className="text-2xl">{ROLE_ICONS[r]}</span><div><div className="text-lg font-bold text-sl-text">{users.filter((u) => u.role === r).length}</div><div className="text-xs text-sl-muted">{t(`roles.${r}`)}</div></div></Card>)}
        </div>
        <Toolbar><SearchInput value={q} onChange={setQ} /></Toolbar>
        {list.length === 0 ? <Card><EmptyState /></Card> : view === 'cards' ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 2xl:grid-cols-3">
            {list.map((u) => (
              <Card key={u.id} className={`p-4 animate-slide-up ${u.isActive ? '' : 'opacity-60'}`}>
                <div className="flex items-start gap-3">
                  <div className="flex size-11 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-lg font-bold text-white">{u.name.charAt(0)}</div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold text-sl-text">{u.name} {u.id === me?.id && <Badge color="indigo">{t('users.you')}</Badge>}</div>
                    <div className="truncate text-xs text-sl-muted">{u.email}</div>
                    <div className="mt-1 flex flex-wrap gap-1"><RoleBadge role={u.role} /><Badge color={u.isActive ? 'green' : 'slate'}>{u.isActive ? `● ${t('users.active')}` : `○ ${t('users.inactive')}`}</Badge></div>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-1">{u.permissions.map((m) => <span key={m} title={t(`nav.${m}`)} className="rounded-md bg-sl-hover px-1.5 py-0.5 text-sm">{MODULE_ICONS[m]}</span>)}</div>
                <div className="mt-3 flex items-center justify-between border-t border-sl-border pt-2">
                  <span className="text-[11px] text-sl-muted">🕐 {t('users.lastLogin')}: {u.lastLogin ? f.dateTime(u.lastLogin) : t('users.never')}</span>
                  {actions(u)}
                </div>
              </Card>
            ))}
          </div>
        ) : (
          <DataTable data={list} rowKey={(u) => u.id!} onRowClick={openEdit} minWidth={900}
            columns={[
              { key: 'name', label: t('common.name'), render: (u) => <div><div className="font-semibold">{u.name}</div><div className="text-xs text-sl-muted">{u.email}</div></div> },
              { key: 'role', label: t('users.role'), render: (u) => <RoleBadge role={u.role} />, sortValue: (u) => ROLES.indexOf(u.role) },
              { key: 'permissions', label: t('users.permissions'), render: (u) => <span className="text-xs">{u.permissions.length}/{ALL_MODULES.length}</span>, sortValue: (u) => u.permissions.length },
              { key: 'isActive', label: t('common.status'), render: (u) => <Badge color={u.isActive ? 'green' : 'slate'}>{u.isActive ? t('users.active') : t('users.inactive')}</Badge> },
              { key: 'lastLogin', label: t('users.lastLogin'), render: (u) => (u.lastLogin ? f.dateTime(u.lastLogin) : t('users.never')) },
              { key: '_a', label: '', sortable: false, render: actions },
            ]} />
        )}
      </>}

      {tab === 'audit' && <>
        <Toolbar>
          <SearchInput value={logQ} onChange={setLogQ} />
          <Select value={logModule} onChange={(e) => setLogModule(e.target.value)} className="!h-10 !w-auto">
            <option value="all">{t('common.all')}</option>
            {modules.map((m) => <option key={m} value={m}>{t(`nav.${m}`, { defaultValue: m })}</option>)}
          </Select>
        </Toolbar>
        <DataTable data={logList} rowKey={(l) => l.id!} minWidth={800} initialSort={{ key: 'timestamp', direction: 'desc' }}
          empty={<EmptyState icon="🕵️" />}
          columns={[
            { key: 'timestamp', label: t('users.when'), render: (l) => <span className="whitespace-nowrap text-xs">{f.dateTime(l.timestamp)}</span> },
            { key: 'userName', label: t('users.who'), render: (l) => <span className="font-semibold">{l.userName}</span> },
            { key: 'action', label: t('users.what'), render: (l) => <Badge color={ACTION_COLORS[l.action] ?? 'slate'}>{t(`audit.${l.action}`, { defaultValue: l.action })}</Badge> },
            { key: 'module', label: t('users.module'), render: (l) => t(`nav.${l.module}`, { defaultValue: l.module }) },
            { key: 'details', label: t('users.detail'), render: (l) => <span className="text-xs text-sl-muted">{l.details || '—'}</span> },
          ]} />
      </>}

      {tab === 'matrix' && <RolePermissionsMatrix />}

      <Modal open={open} onClose={() => setOpen(false)} size="xl" title={editing ? `✏️ ${editing.name}` : `➕ ${t('users.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label={t('common.name')} requiredMark value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
            <Input label={t('common.email')} requiredMark type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
            <Input label={editing ? t('users.newPassword') : t('auth.password')} requiredMark={!editing} type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} hint={editing ? t('users.passwordHint') : undefined} />
            <Select label={t('users.role')} value={form.role} onChange={(e) => changeRole(e.target.value as Role)}>
              {ROLES.map((r) => <option key={r} value={r}>{ROLE_ICONS[r]} {t(`roles.${r}`)}</option>)}
            </Select>
          </div>
          <Toggle checked={form.isActive} onChange={(v) => setForm({ ...form, isActive: v })} label={t('users.active')} description={t('users.activeHint')} />
          <div className="rounded-xl border border-sl-border bg-sl-card2 p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">🔐 {t('users.permissions')}</div>
            <PermissionGrid value={form.permissions} onChange={(p) => setForm({ ...form, permissions: p })} role={form.role} />
          </div>
        </div>
      </Modal>
    </div>
  );
}