import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Pencil, Plus, Trash } from 'lucide-react';
import { db } from '../db/database';
import { confirmDialog, toast } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { isoDate } from '../lib/calc';
import { logAction } from '../lib/audit';
import { expenseSchema, validateForm, type FormErrors } from '../schemas';
import type { Expense, ExpenseCategory } from '../types';
import { EXPENSE_CATEGORIES } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, SearchInput, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

const icon = (c: ExpenseCategory) => EXPENSE_CATEGORIES.find((x) => x.id === c)?.icon ?? '📋';

export function Expenses() {
  const { t } = useTranslation();
  const f = useFormat();
  const expenses = useLiveQuery(() => db.expenses.reverse().sortBy('date'), []);
  const [q, setQ] = useState('');
  const [cat, setCat] = useState<ExpenseCategory | 'all'>('all');
  const [view, setView] = useViewMode('expenses');
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Expense | null>(null);
  const [form, setForm] = useState({ date: isoDate(), category: 'other' as ExpenseCategory, description: '', amount: '' });
  const [errors, setErrors] = useState<FormErrors>({});

  const list = useMemo(() => (expenses ?? []).filter((e) => (cat === 'all' || e.category === cat) && matches(q, e.description, t(`expenseCat.${e.category}`))), [expenses, q, cat, t]);
  if (!expenses) return <LoadingPage />;
  const total = expenses.reduce((a, e) => a + e.amount, 0);

  const openNew = () => { setEditing(null); setForm({ date: isoDate(), category: cat === 'all' ? 'other' : cat, description: '', amount: '' }); setErrors({}); setOpen(true); };
  const openEdit = (e: Expense) => { setEditing(e); setForm({ date: e.date, category: e.category, description: e.description, amount: String(e.amount) }); setErrors({}); setOpen(true); };
  const save = async () => {
    const r = validateForm(expenseSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    if (editing) { await db.expenses.update(editing.id!, r.data); await logAction('update', 'expenses', `${r.data.description} · ${f.money(r.data.amount)}`); toast.success(t('common.updated')); }
    else { await db.expenses.add({ ...r.data, createdAt: new Date().toISOString() }); await logAction('create', 'expenses', `${r.data.description} · ${f.money(r.data.amount)}`); toast.success(t('common.created')); }
    setOpen(false);
  };
  const remove = async (e: Expense) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: e.description }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.expenses.delete(e.id!); await logAction('delete', 'expenses', e.description); toast.success(t('common.deleted'));
  };
  const actions = (e: Expense) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(e)}><Pencil /></IconButton>
      <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(e)}><Trash /></IconButton>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="💸" title={t('nav.expenses')} subtitle={<>{t('expenses.total')}: <b className="text-red-500">{f.money(total)}</b> · {t('expenses.count', { count: expenses.length })}</>}
        actions={<><ViewToggle value={view} onChange={setView} /><Button icon={<Plus />} onClick={openNew}>{t('expenses.new')}</Button></>} />
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
        {EXPENSE_CATEGORIES.map((c) => {
          const items = expenses.filter((e) => e.category === c.id);
          const sum = items.reduce((a, e) => a + e.amount, 0);
          return (
            <button key={c.id} type="button" onClick={() => setCat(cat === c.id ? 'all' : c.id)}
              className={`rounded-xl border bg-sl-card p-3 text-start shadow-sm ${cat === c.id ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border hover:border-primary/40'}`}>
              <div className="flex items-center justify-between"><span className="text-xl">{c.icon}</span><span className="text-[10px] font-bold text-sl-muted">{items.length}</span></div>
              <div className="mt-1 truncate text-[11px] font-medium text-sl-muted">{t(`expenseCat.${c.id}`)}</div>
              <div className="truncate text-sm font-bold text-sl-text">{f.money(sum)}</div>
              <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-sl-hover"><div className="h-full bg-red-500" style={{ width: `${total ? (sum / total) * 100 : 0}%` }} /></div>
            </button>
          );
        })}
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} />
        {cat !== 'all' && <Button size="sm" variant="ghost" onClick={() => setCat('all')}>✕ {t(`expenseCat.${cat}`)}</Button>}
      </Toolbar>
      {list.length === 0 ? <Card><EmptyState icon="💸" title={t('common.noResults')} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
          {list.map((e) => (
            <Card key={e.id} className="flex items-start gap-3 p-4 animate-slide-up">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-xl">{icon(e.category)}</div>
              <div className="min-w-0 flex-1">
                <Badge color="red">{t(`expenseCat.${e.category}`)}</Badge>
                <div className="mt-1 truncate text-sm font-semibold text-sl-text">{e.description}</div>
                <div className="text-xs text-sl-muted">📅 {f.date(e.date)}</div>
                <div className="mt-1 text-lg font-extrabold text-red-500">-{f.money(e.amount)}</div>
              </div>
              {actions(e)}
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(e) => e.id!} onRowClick={openEdit} minWidth={600}
          columns={[
            { key: 'date', label: t('common.date'), render: (e) => f.date(e.date) },
            { key: 'category', label: t('common.category'), render: (e) => <Badge color="red">{icon(e.category)} {t(`expenseCat.${e.category}`)}</Badge>, sortValue: (e) => t(`expenseCat.${e.category}`) },
            { key: 'description', label: t('common.description') },
            { key: 'amount', label: t('expenses.amount'), render: (e) => <b className="text-red-500">-{f.money(e.amount)}</b> },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}
      <Modal open={open} onClose={() => setOpen(false)} title={editing ? `✏️ ${t('expenses.edit')}` : `➕ ${t('expenses.new')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label={t('common.date')} type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} error={errors.date} />
          <Select label={t('common.category')} value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value as ExpenseCategory })}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c.id} value={c.id}>{c.icon} {t(`expenseCat.${c.id}`)}</option>)}
          </Select>
          <div className="sm:col-span-2"><Input label={t('common.description')} requiredMark value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} error={errors.description} /></div>
          <Input label={t('expenses.amount')} type="number" step="0.01" min="0" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} error={errors.amount} />
        </div>
      </Modal>
    </div>
  );
}