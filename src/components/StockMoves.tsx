import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { subDays, subMonths, subYears } from 'date-fns';
import { X } from 'lucide-react';
import { db } from '../db/database';
import { useStore } from '../store/store';
import { toDate, useFormat } from '../lib/format';
import { matches } from '../lib/hooks';
import { STOCK_MOVE_ICONS, STOCK_MOVE_TYPES } from '../types';
import type { StockMove, StockMoveType } from '../types';
import type { BadgeColor } from '../lib/colors';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, Pill, SearchInput, StatCard, Toolbar, ViewToggle, useViewMode } from './shared/UI';
import { Button } from './shared/Forms';
import { DataTable } from './shared/SortableTable';
import { LoadingPage } from './shared/Skeleton';

type Period = 'week' | 'month' | 'year' | 'all';

const TYPE_COLORS: Record<StockMoveType, BadgeColor> = {
  initial: 'slate', sale: 'indigo', purchase: 'green', adjustment: 'amber', create: 'blue', delete: 'red', repair: 'purple', return: 'orange',
};

export function StockMoves() {
  const { t } = useTranslation();
  const f = useFormat();
  const moves = useLiveQuery(() => db.stockMoves.orderBy('timestamp').reverse().toArray(), []);
  const products = useLiveQuery(() => db.products.toArray(), []);
  const focusId = useStore((s) => s.stockFocusProductId);
  const setFocus = useStore((s) => s.setStockFocusProductId);
  const [type, setType] = useState<StockMoveType | 'all'>('all');
  const [period, setPeriod] = useState<Period>('month');
  const [q, setQ] = useState('');
  const [view, setView] = useViewMode('stock', 'table');

  const since = useMemo(() => {
    const n = new Date();
    return period === 'week' ? subDays(n, 7) : period === 'month' ? subMonths(n, 1) : period === 'year' ? subYears(n, 1) : null;
  }, [period]);

  const inPeriod = useMemo(
    () => (m: StockMove) => { if (!since) return true; const d = toDate(m.timestamp); return !!d && d >= since; },
    [since],
  );

  const scoped = useMemo(() => (moves ?? []).filter(inPeriod), [moves, inPeriod]);
  const list = useMemo(() => scoped.filter((m) =>
    (type === 'all' || m.type === type) &&
    (focusId === null || m.productId === focusId) &&
    matches(q, m.productName, m.reference, m.note)), [scoped, type, focusId, q]);

  if (!moves) return <LoadingPage />;

  const focus = products?.find((p) => p.id === focusId);
  const entries = scoped.filter((m) => m.qty > 0).reduce((a, m) => a + m.qty, 0);
  const exits = scoped.filter((m) => m.qty < 0).reduce((a, m) => a - m.qty, 0);
  const todayKey = new Date().toDateString();
  const today = scoped.filter((m) => toDate(m.timestamp)?.toDateString() === todayKey).length;

  const qtyChip = (m: StockMove) => (
    <span className={`font-mono font-bold ${m.qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>
      {m.qty > 0 ? '+' : ''}{m.qty}
    </span>
  );
  const typeBadge = (m: StockMove) => <Badge color={TYPE_COLORS[m.type]}>{STOCK_MOVE_ICONS[m.type]} {t(`stockType.${m.type}`)}</Badge>;
  const productCell = (m: StockMove) => (
    <div className="min-w-0">
      <div className="truncate font-semibold text-sl-text">{m.productName}</div>
      {m.reference ? <div className="font-mono text-[11px] text-sl-muted">{m.reference}</div> : null}
    </div>
  );
  const dateCell = (m: StockMove) => (
    <div>
      <div className="whitespace-nowrap text-xs">{f.dateTime(m.timestamp)}</div>
      <div className="text-[11px] text-sl-muted">{m.userName || '—'}</div>
    </div>
  );

  return (
    <div className="space-y-4">
      <PageHeader icon="📜" title={t('nav.stock')} subtitle={t('stock.subtitle')} actions={<ViewToggle value={view} onChange={setView} />} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="📜" tone="indigo" label={t('stock.total')} value={scoped.length} />
        <StatCard icon="📥" tone="green" label={t('stock.entries')} value={`+${entries}`} />
        <StatCard icon="📤" tone="red" label={t('stock.exits')} value={`-${exits}`} />
        <StatCard icon="📅" tone="amber" label={t('stock.today')} value={today} />
      </div>

      <Toolbar>
        <SearchInput value={q} onChange={setQ} placeholder={t('stock.searchPlaceholder')} />
      </Toolbar>
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        <Pill active={period === 'month'} onClick={() => setPeriod('month')}>{t('reports.period_month')}</Pill>
        <Pill active={period === 'week'} onClick={() => setPeriod('week')}>{t('reports.period_week')}</Pill>
        <Pill active={period === 'year'} onClick={() => setPeriod('year')}>{t('reports.period_year')}</Pill>
        <Pill active={period === 'all'} onClick={() => setPeriod('all')}>{t('reports.period_all')}</Pill>
      </div>
      <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
        <Pill active={type === 'all'} onClick={() => setType('all')} count={scoped.length}>🏷️ {t('stock.allTypes')}</Pill>
        {STOCK_MOVE_TYPES.map((ty) => (
          <Pill key={ty} active={type === ty} onClick={() => setType(ty)} count={scoped.filter((m) => m.type === ty).length}>
            {STOCK_MOVE_ICONS[ty]} {t(`stockType.${ty}`)}
          </Pill>
        ))}
      </div>
      {focusId !== null && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/40 bg-primary/5 px-3 py-2 text-sm">
          <span className="text-sl-muted">{t('stock.focus')}:</span>
          <b className="text-sl-text">{focus?.name ?? `#${focusId}`}</b>
          <Button size="sm" variant="ghost" className="ms-auto" icon={<X />} onClick={() => setFocus(null)}>{t('stock.clearFocus')}</Button>
        </div>
      )}

      {list.length === 0 ? <Card><EmptyState icon="📜" title={t('stock.noMoves')} /></Card> : view === 'cards' ? (
        <div className="space-y-2">
          {list.map((m) => (
            <Card key={m.id} className="flex items-center gap-3 p-3 animate-slide-up">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-sl-hover text-lg">{STOCK_MOVE_ICONS[m.type]}</div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate font-semibold text-sl-text">{m.productName}</span>
                  {typeBadge(m)}
                </div>
                <div className="mt-0.5 text-xs text-sl-muted">{f.dateTime(m.timestamp)}{m.reference ? ` · ${m.reference}` : ''}{m.note ? ` · ${m.note}` : ''}</div>
              </div>
              <div className="shrink-0 text-end">
                <div className={`text-lg font-extrabold ${m.qty > 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500'}`}>{m.qty > 0 ? '+' : ''}{m.qty}</div>
                <div className="text-[11px] text-sl-muted">{t('stock.stockAfter')}: <b className="text-sl-text">{m.stockAfter}</b></div>
              </div>
            </Card>
          ))}
        </div>
      ) : (
        <DataTable data={list} rowKey={(m) => m.id!} minWidth={880} initialSort={{ key: 'timestamp', direction: 'desc' }}
          columns={[
            { key: 'timestamp', label: t('common.date'), render: dateCell },
            { key: 'productName', label: t('stock.product'), render: productCell },
            { key: 'type', label: t('stock.type'), render: typeBadge, sortValue: (m) => STOCK_MOVE_TYPES.indexOf(m.type) },
            { key: 'qty', label: t('stock.qty'), render: qtyChip, sortValue: (m) => m.qty, className: 'text-end' },
            { key: 'stockAfter', label: t('stock.stockAfter'), render: (m) => <span className="font-mono">{m.stockAfter}</span>, className: 'text-end', headerClassName: 'text-end' },
            { key: 'note', label: t('common.notes'), render: (m) => <span className="text-xs text-sl-muted">{m.note || '—'}</span> },
          ]} />
      )}
    </div>
  );
}
