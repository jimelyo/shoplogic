import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import type { NavSection } from '../types';
import { db } from '../db/database';
import { useStore } from '../store/store';
import { canAccess } from '../lib/permissions';

/**
 * Global search (#15): `Ctrl/Cmd+K` opens a fuzzy palette across products,
 * customers, invoices, repairs and quotes; picking a result navigates to its
 * module. Results are grouped by entity, keyboard-driven (↑↓ enter esc).
 */

interface Hit {
  id: string;         // stable key
  module: NavSection; // where to navigate
  title: string;
  subtitle?: string;
  score: number;
}

/** Subsequence fuzzy score: higher is better; -1 means no match. */
function fuzzy(hay: string, needle: string): number {
  if (!needle) return 0;
  const h = hay.toLowerCase();
  const n = needle.toLowerCase();
  let i = 0, score = 0, streak = 0;
  for (const c of n) {
    const idx = h.indexOf(c, i);
    if (idx < 0) return -1;
    streak = idx === i ? streak + 1 : 0;
    score += 10 + streak * 5 - Math.min(idx - i, 10);
    i = idx + 1;
  }
  if (h.startsWith(n)) score += 25;
  return score;
}

const MAX_PER_GROUP = 5;

export function CommandPalette() {
  const { t } = useTranslation();
  const user = useStore((s) => s.currentUser);
  const active = useStore((s) => s.activeModule);
  const setActive = useStore((s) => s.setActiveModule);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const products = useLiveQuery(() => db.products.limit(500).toArray(), []);
  const customers = useLiveQuery(() => db.customers.limit(500).toArray(), []);
  const invoices = useLiveQuery(() => db.invoices.limit(500).toArray(), []);
  const repairs = useLiveQuery(() => db.repairs.limit(500).toArray(), []);
  const quotes = useLiveQuery(() => db.quotes.limit(500).toArray(), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        setQ('');
        setSel(0);
      } else if (e.key === 'Escape' && open) {
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  const hits = useMemo<Hit[]>(() => {
    if (!q.trim()) return [];
    const out: Hit[] = [];
    const push = (module: NavSection, id: string, title: string, subtitle?: string) => {
      if (!user || !canAccess(user, module)) return;
      const score = fuzzy(`${title} ${subtitle ?? ''}`, q.trim());
      if (score >= 0) out.push({ id: `${module}:${id}`, module, title, subtitle, score });
    };
    products?.forEach((p) => push('inventory', String(p.id), p.name, p.barcode || undefined));
    customers?.forEach((c) => push('clients', String(c.id), c.name, c.phone || undefined));
    invoices?.forEach((i) => push('billing', String(i.id), i.number, `${i.customerName} ${i.date}`));
    repairs?.forEach((r) => push('repairs', String(r.id), r.ticketNumber, `${r.device} ${r.imei} ${r.customerName}`));
    quotes?.forEach((qq) => push('quotes', String(qq.id), qq.number, qq.customerName));
    out.sort((a, b) => b.score - a.score);
    // Keep the palette balanced: at most MAX_PER_GROUP per module, 24 total.
    const per = new Map<NavSection, number>();
    const balanced = out.filter((h) => (per.get(h.module) ?? 0) < MAX_PER_GROUP && (per.set(h.module, (per.get(h.module) ?? 0) + 1), true)).slice(0, 24);
    // Jumping to the current module would feel like a no-op; still allowed but ranked last is fine.
    return balanced.filter((h) => h.module !== active || true);
  }, [q, products, customers, invoices, repairs, quotes, user, active]);

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setActive(h.module);
    setOpen(false);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel((s) => Math.min(s + 1, hits.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((s) => Math.max(s - 1, 0)); }
    else if (e.key === 'Enter') { go(hits[sel]); }
  };

  // Scroll the selection into view.
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${sel}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 px-4 pt-[12vh] backdrop-blur-sm" onMouseDown={() => setOpen(false)}>
      <div
        className="w-full max-w-xl animate-scale-in overflow-hidden rounded-2xl border border-sl-border bg-sl-card shadow-2xl"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 border-b border-sl-border px-4 py-3">
          <span className="text-sl-muted">🔍</span>
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => { setQ(e.target.value); setSel(0); }}
            onKeyDown={onKeyDown}
            placeholder={t('palette.placeholder')}
            className="w-full bg-transparent text-sm text-sl-text outline-none placeholder:text-sl-muted"
            aria-label={t('palette.title')}
          />
          <kbd className="rounded border border-sl-border px-1.5 py-0.5 text-[10px] text-sl-muted">Esc</kbd>
        </div>
        <div ref={listRef} className="max-h-80 overflow-y-auto p-2">
          {hits.length === 0 && (
            <div className="px-3 py-8 text-center text-sm text-sl-muted">{q ? t('palette.noResults') : t('palette.hint')}</div>
          )}
          {hits.map((h, i) => (
            <button
              key={h.id}
              data-idx={i}
              type="button"
              onMouseEnter={() => setSel(i)}
              onClick={() => go(h)}
              className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-start ${i === sel ? 'bg-primary/10' : 'hover:bg-sl-hover'}`}
            >
              <span className="rounded-md bg-sl-hover px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-sl-muted">{t(`nav.${h.module}`)}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-sl-text">{h.title}</span>
                {h.subtitle && <span className="block truncate text-[11px] text-sl-muted">{h.subtitle}</span>}
              </span>
              {i === sel && <kbd className="rounded border border-sl-border px-1.5 text-[10px] text-sl-muted">↵</kbd>}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-between border-t border-sl-border px-4 py-2 text-[11px] text-sl-muted">
          <span>{t('palette.title')}</span>
          <span>↑↓ · ↵ · Esc</span>
        </div>
      </div>
    </div>
  );
}
