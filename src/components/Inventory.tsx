import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { History, Pencil, Plus, Tags, Trash } from 'lucide-react';
import { db, getSettings } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { makeMove } from '../lib/stock';
import { logAction } from '../lib/audit';
import { isReadOnly } from '../lib/permissions';
import { generateNotifications } from '../lib/notifications';
import { categorySchema, productSchema, validateForm, type FormErrors } from '../schemas';
import { CATEGORY_COLORS, CATEGORY_ICON_CHOICES, DEFAULT_CATEGORIES, categoryLabel } from '../data/categories';
import type { Product, ProductCategory } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, IconButton, Pill, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button, Input, Select, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';
import { BarcodeScanner, ScanButton } from './BarcodeScanner';
import { DeviceHistory } from './DeviceHistory';

type PForm = Record<keyof Omit<Product, 'id' | 'createdAt'>, string>;
const emptyForm = (cat = 'phones'): PForm => ({ name: '', category: cat, barcode: '', imei: '', cost: '', price: '', stock: '0', minStock: '2', description: '' });

export function stockLevel(p: Product): 'out' | 'low' | 'ok' {
  return p.stock <= 0 ? 'out' : p.stock <= p.minStock ? 'low' : 'ok';
}

export function Inventory() {
  const { t } = useTranslation();
  const f = useFormat();
  const user = useStore((s) => s.currentUser);
  const setActive = useStore((x) => x.setActiveModule);
  const setStockFocus = useStore((x) => x.setStockFocusProductId);
  const readOnly = isReadOnly(user, 'inventory');
  const products = useLiveQuery(() => db.products.toArray(), []);
  const cats = f.settings.categories?.length ? f.settings.categories : DEFAULT_CATEGORIES;
  const [q, setQ] = useState('');
  const [cat, setCat] = useState('all');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out'>('all');
  const [view, setView] = useViewMode('inventory');
  const [editing, setEditing] = useState<Product | null>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<PForm>(emptyForm());
  const [errors, setErrors] = useState<FormErrors>({});
  const [catOpen, setCatOpen] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [device, setDevice] = useState('');

  const list = useMemo(() => (products ?? []).filter((p) =>
    (cat === 'all' || p.category === cat) &&
    (stockFilter === 'all' || (stockFilter === 'low' ? stockLevel(p) === 'low' : stockLevel(p) === 'out')) &&
    matches(q, p.name, p.barcode, p.imei)), [products, q, cat, stockFilter]);

  if (!products) return <LoadingPage />;
  const catOf = (id: string) => cats.find((c) => c.id === id);
  const value = products.reduce((a, p) => a + p.cost * p.stock, 0);
  const retail = products.reduce((a, p) => a + p.price * p.stock, 0);

  const openNew = () => { setEditing(null); setForm(emptyForm(cat !== 'all' ? cat : cats[0]?.id)); setErrors({}); setOpen(true); };
  const openEdit = (p: Product) => {
    setEditing(p);
    setForm({ name: p.name, category: p.category, barcode: p.barcode ?? '', imei: p.imei ?? '', cost: String(p.cost), price: String(p.price), stock: String(p.stock), minStock: String(p.minStock), description: p.description ?? '' });
    setErrors({}); setOpen(true);
  };
  const save = async () => {
    const r = validateForm(productSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    const d = r.data;
    if (d.barcode) {
      const dup = await db.products.where('barcode').equals(d.barcode).first();
      if (dup && dup.id !== editing?.id) { setErrors({ barcode: 'validation.duplicate' }); return; }
    }
    if (editing) {
      const delta = d.stock - editing.stock;
      await db.transaction('rw', db.products, db.stockMoves, async () => {
        await db.products.update(editing.id!, d);
        if (delta !== 0) await db.stockMoves.add(makeMove(editing, delta, 'adjustment', { note: t('stock.adjustNote') }));
      });
      await logAction('update', 'inventory', d.name);
      toast.success(t('common.updated'));
    } else {
      const createdAt = new Date().toISOString();
      await db.transaction('rw', db.products, db.stockMoves, async () => {
        const id = await db.products.add({ ...d, createdAt });
        if (d.stock > 0) await db.stockMoves.add(makeMove({ ...d, createdAt, id }, d.stock, 'create', { note: t('stock.createNote'), before: 0 }));
      });
      await logAction('create', 'inventory', d.name);
      toast.success(t('common.created'));
    }
    setOpen(false);
    generateNotifications().catch(() => undefined);
  };
  const remove = async (p: Product) => {
    if (!(await confirmDialog(t('common.confirmDelete', { name: p.name }), { danger: true, confirmLabel: t('common.delete') }))) return;
    await db.transaction('rw', db.products, db.stockMoves, async () => {
      if (p.stock > 0) await db.stockMoves.add(makeMove(p, -p.stock, 'delete', { note: t('stock.deleteNote') }));
      await db.products.delete(p.id!);
    });
    await logAction('delete', 'inventory', p.name);
    toast.success(t('common.deleted'));
  };
  const viewHistory = (p: Product) => { setStockFocus(p.id!); setActive('stock'); };

  const levelBadge = (p: Product) => {
    const l = stockLevel(p);
    return <Badge color={l === 'out' ? 'red' : l === 'low' ? 'amber' : 'green'}>{l === 'out' ? '🔴' : l === 'low' ? '🟡' : '🟢'} {p.stock} {l === 'out' ? `· ${t('inventory.outOfStock')}` : l === 'low' ? `· ${t('inventory.low')}` : ''}</Badge>;
  };
  const catBadge = (id: string) => {
    const c = catOf(id);
    return <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${CATEGORY_COLORS[c?.color ?? 'slate'] ?? CATEGORY_COLORS.slate}`}>{c?.icon ?? '📦'} {categoryLabel(c, t)}</span>;
  };
  const actions = (p: Product) => (
    <div className="flex justify-end gap-0.5">
      <IconButton title={t('stock.viewHistory')} onClick={() => viewHistory(p)}><History /></IconButton>
      {!readOnly && <>
        <IconButton title={t('common.edit')} tone="primary" onClick={() => openEdit(p)}><Pencil /></IconButton>
        <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(p)}><Trash /></IconButton>
      </>}
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="📦" title={t('nav.inventory')} subtitle={readOnly ? `🔒 ${t('common.readOnlyMode')}` : t('inventory.subtitle')}
        actions={<>
          <ViewToggle value={view} onChange={setView} />
          {!readOnly && <Button variant="secondary" icon={<Tags />} onClick={() => setCatOpen(true)}>{t('inventory.categories')}</Button>}
          {!readOnly && <Button icon={<Plus />} onClick={openNew}>{t('inventory.newProduct')}</Button>}
        </>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="📦" tone="indigo" label={t('inventory.totalProducts')} value={products.length} sub={t('inventory.units', { count: products.reduce((a, p) => a + p.stock, 0) })} />
        <StatCard icon="💶" tone="green" label={t('inventory.stockValue')} value={f.money(value)} sub={`${t('inventory.retailValue')}: ${f.money(retail)}`} />
        <StatCard icon="🟡" tone="amber" label={t('inventory.lowStock')} value={products.filter((p) => stockLevel(p) === 'low').length} onClick={() => setStockFilter(stockFilter === 'low' ? 'all' : 'low')} active={stockFilter === 'low'} />
        <StatCard icon="🔴" tone="red" label={t('inventory.outOfStock')} value={products.filter((p) => stockLevel(p) === 'out').length} onClick={() => setStockFilter(stockFilter === 'out' ? 'all' : 'out')} active={stockFilter === 'out'} />
      </div>
      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={t('inventory.searchPlaceholder')} />
        <ScanButton onClick={() => setScanning(true)} />
      </Toolbar>
      <div className="flex gap-2 overflow-x-auto pb-1">
        <Pill active={cat === 'all'} onClick={() => setCat('all')} count={products.length}>🏷️ {t('common.all')}</Pill>
        {cats.map((c) => <Pill key={c.id} active={cat === c.id} onClick={() => setCat(c.id)} count={products.filter((p) => p.category === c.id).length}>{c.icon} {categoryLabel(c, t)}</Pill>)}
      </div>

      {list.length === 0 ? <Card><EmptyState icon="📦" title={t('common.noResults')} action={!readOnly && <Button size="sm" icon={<Plus />} onClick={openNew}>{t('inventory.newProduct')}</Button>} /></Card> : view === 'cards' ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {list.map((p) => (
            <Card key={p.id} className="flex flex-col p-4 animate-slide-up">
              <div className="flex items-start gap-3">
                <div className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-sl-hover text-2xl">{catOf(p.category)?.icon ?? '📦'}</div>
                <div className="min-w-0 flex-1">
                  <div className="line-clamp-2 font-semibold leading-tight text-sl-text">{p.name}</div>
                  <div className="mt-1">{catBadge(p.category)}</div>
                </div>
                {actions(p)}
              </div>
              <div className="mt-3 space-y-1 text-xs text-sl-muted">
                <div>🔢 <span className="font-mono">{p.barcode || '—'}</span></div>
                {p.imei && (
                  <button type="button" onClick={() => setDevice(p.imei!)} title={t('device.open')}
                    className="rounded px-1 font-mono hover:bg-sl-hover hover:text-primary">
                    📟 IMEI: {p.imei}
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-2 gap-2 rounded-lg bg-sl-hover p-2 text-center text-xs">
                <div><div className="text-sl-muted">{t('inventory.cost')}</div><div className="font-bold text-sl-text">{f.money(p.cost)}</div></div>
                <div><div className="text-sl-muted">{t('common.price')}</div><div className="font-bold text-primary">{f.money(p.price)}</div></div>
              </div>
              <div className="mt-3 flex items-center justify-between text-xs">
                {levelBadge(p)}
                <span className="text-sl-muted">{t('inventory.min')}: {p.minStock}</span>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(p) => p.id!} onRowClick={readOnly ? undefined : openEdit}
          columns={[
            { key: 'name', label: t('common.product'), render: (p) => <div className="flex items-center gap-2"><span className="text-lg">{catOf(p.category)?.icon ?? '📦'}</span><div><div className="font-semibold">{p.name}</div>{p.imei && <button type="button" onClick={(e) => { e.stopPropagation(); setDevice(p.imei!); }} title={t('device.open')} className="font-mono text-[10px] text-sl-muted hover:text-primary">IMEI {p.imei}</button>}</div></div> },
            { key: 'category', label: t('common.category'), render: (p) => catBadge(p.category), sortValue: (p) => categoryLabel(catOf(p.category), t) },
            { key: 'barcode', label: t('inventory.code'), render: (p) => <span className="font-mono text-xs">{p.barcode || '—'}</span> },
            { key: 'cost', label: t('inventory.cost'), render: (p) => f.money(p.cost) },
            { key: 'price', label: t('common.price'), render: (p) => <b className="text-primary">{f.money(p.price)}</b> },
            { key: 'stock', label: t('common.stock'), render: levelBadge },
            { key: '_a', label: '', sortable: false, render: actions },
          ]} />
      )}

      <Modal open={open} onClose={() => setOpen(false)} size="lg" title={editing ? `✏️ ${t('inventory.editProduct')}` : `➕ ${t('inventory.newProduct')}`}
        footer={<><Button variant="secondary" onClick={() => setOpen(false)}>{t('common.cancel')}</Button><Button onClick={save}>{t('common.save')}</Button></>}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2"><Input label={t('common.name')} requiredMark value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} /></div>
          <Select label={t('common.category')} requiredMark value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} error={errors.category}>
            {cats.map((c) => <option key={c.id} value={c.id}>{c.icon} {categoryLabel(c, t)}</option>)}
          </Select>
          <Input label={t('inventory.barcode')} value={form.barcode} onChange={(e) => setForm({ ...form, barcode: e.target.value })} error={errors.barcode} />
          <Input label="IMEI" value={form.imei} onChange={(e) => setForm({ ...form, imei: e.target.value })} hint={t('common.optional')} />
          <div className="grid grid-cols-2 gap-3">
            <Input label={t('inventory.cost')} type="number" step="0.01" min="0" value={form.cost} onChange={(e) => setForm({ ...form, cost: e.target.value })} error={errors.cost} />
            <Input label={`${t('common.price')} (${t('tax.included')})`} type="number" step="0.01" min="0" value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} error={errors.price} />
          </div>
          <Input label={t('common.stock')} type="number" min="0" value={form.stock} onChange={(e) => setForm({ ...form, stock: e.target.value })} error={errors.stock} />
          <Input label={t('inventory.minStock')} type="number" min="0" value={form.minStock} onChange={(e) => setForm({ ...form, minStock: e.target.value })} error={errors.minStock} />
          <div className="sm:col-span-2"><TextArea label={t('common.description')} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} /></div>
          {Number(form.price) > 0 && Number(form.cost) >= 0 && (
            <div className="rounded-lg bg-sl-hover p-3 text-xs text-sl-muted sm:col-span-2">
              💡 {t('tax.base')}: <b>{f.money(Number(form.price) / (1 + f.settings.taxRate / 100))}</b> · {t('inventory.marginLabel')}: <b>{f.money(Number(form.price) / (1 + f.settings.taxRate / 100) - Number(form.cost))}</b>
            </div>
          )}
        </div>
      </Modal>

      <CategoryManager open={catOpen} onClose={() => setCatOpen(false)} products={products} />
      <BarcodeScanner open={scanning} onClose={() => setScanning(false)}
        onCode={(code) => { const v = code.trim(); if (!v) return; setQ(v); setScanning(false); }} />
      {device && <DeviceHistory imei={device} onClose={() => setDevice('')} />}
    </div>
  );
}

function CategoryManager({ open, onClose, products }: { open: boolean; onClose: () => void; products: Product[] }) {
  const { t } = useTranslation();
  const f = useFormat();
  const cats = f.settings.categories?.length ? f.settings.categories : DEFAULT_CATEGORIES;
  const [edit, setEdit] = useState<ProductCategory | null>(null);
  const [form, setForm] = useState({ name: '', icon: '⌚', color: 'green' });
  const [errors, setErrors] = useState<FormErrors>({});

  const persist = async (next: ProductCategory[]) => {
    const s = await getSettings();
    await db.settings.update(s.id!, { categories: next });
  };
  const startEdit = (c: ProductCategory) => { setEdit(c); setForm({ name: categoryLabel(c, t), icon: c.icon, color: c.color }); setErrors({}); };
  const reset = () => { setEdit(null); setForm({ name: '', icon: '⌚', color: 'green' }); setErrors({}); };
  const save = async () => {
    const r = validateForm(categorySchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    if (edit) {
      await persist(cats.map((c) => (c.id === edit.id ? { ...c, name: c.isDefault && r.data.name === categoryLabel(c, t) ? c.name : r.data.name, isDefault: c.isDefault && r.data.name === categoryLabel(c, t), icon: r.data.icon, color: r.data.color } : c)));
      await logAction('update', 'inventory', `${t('common.category')}: ${r.data.name}`);
    } else {
      const id = r.data.name.toLowerCase().normalize('NFD').replace(/[^\w]+/g, '-').replace(/^-|-$/g, '') + '-' + Date.now().toString(36);
      await persist([...cats, { id, name: r.data.name, icon: r.data.icon, color: r.data.color }]);
      await logAction('create', 'inventory', `${t('common.category')}: ${r.data.name}`);
    }
    toast.success(t('common.saved'));
    reset();
  };
  const remove = async (c: ProductCategory) => {
    const used = products.filter((p) => p.category === c.id).length;
    if (used) { toast.warning(t('inventory.categoryInUse', { count: used })); return; }
    if (cats.length <= 1) return;
    if (!(await confirmDialog(t('common.confirmDelete', { name: categoryLabel(c, t) }), { danger: true }))) return;
    await persist(cats.filter((x) => x.id !== c.id));
    await logAction('delete', 'inventory', `${t('common.category')}: ${categoryLabel(c, t)}`);
    toast.success(t('common.deleted'));
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} size="lg" title={`🏷️ ${t('inventory.manageCategories')}`}>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="space-y-2">
          {cats.map((c) => (
            <div key={c.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${edit?.id === c.id ? 'border-primary bg-primary/5' : 'border-sl-border'}`}>
              <span className={`flex size-9 items-center justify-center rounded-lg border text-lg ${CATEGORY_COLORS[c.color] ?? CATEGORY_COLORS.slate}`}>{c.icon}</span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-sl-text">{categoryLabel(c, t)}</div>
                <div className="text-[11px] text-sl-muted">{t('inventory.productsCount', { count: products.filter((p) => p.category === c.id).length })}{c.isDefault ? ` · ${t('inventory.default')}` : ''}</div>
              </div>
              <IconButton title={t('common.edit')} tone="primary" onClick={() => startEdit(c)}><Pencil /></IconButton>
              <IconButton title={t('common.delete')} tone="danger" onClick={() => remove(c)}><Trash /></IconButton>
            </div>
          ))}
        </div>
        <div className="space-y-3 rounded-xl border border-sl-border bg-sl-card2 p-4">
          <div className="text-sm font-bold text-sl-text">{edit ? `✏️ ${t('inventory.editCategory')}` : `➕ ${t('inventory.newCategory')}`}</div>
          <Input label={t('common.name')} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} error={errors.name} />
          <div>
            <span className="mb-1 block text-xs font-semibold text-sl-muted">{t('inventory.icon')}</span>
            <div className="grid grid-cols-8 gap-1">
              {CATEGORY_ICON_CHOICES.map((i) => <button key={i} type="button" onClick={() => setForm({ ...form, icon: i })} className={`rounded-lg p-1.5 text-lg ${form.icon === i ? 'bg-primary/15 ring-2 ring-primary' : 'hover:bg-sl-hover'}`}>{i}</button>)}
            </div>
          </div>
          <div>
            <span className="mb-1 block text-xs font-semibold text-sl-muted">{t('inventory.color')}</span>
            <div className="flex flex-wrap gap-1.5">
              {Object.keys(CATEGORY_COLORS).map((c) => <button key={c} type="button" onClick={() => setForm({ ...form, color: c })} className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${CATEGORY_COLORS[c]} ${form.color === c ? 'ring-2 ring-primary' : ''}`}>{c}</button>)}
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            {edit && <Button variant="ghost" size="sm" onClick={reset}>{t('common.cancel')}</Button>}
            <Button size="sm" onClick={save}>{t('common.save')}</Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}