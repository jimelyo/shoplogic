import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  ArcElement, BarElement, CategoryScale, Chart as ChartJS, Filler, Legend, LinearScale, LineElement, PointElement, Tooltip,
} from 'chart.js';
import { Bar, Doughnut, Line } from 'react-chartjs-2';
import { format, isSameDay, startOfDay, subDays } from 'date-fns';
import { db } from '../db/database';
import { useStore } from '../store/store';
import { useFormat, toDate } from '../lib/format';
import { ACTIVE_REPAIR } from '../lib/notifications';
import { REPAIR_STATUS_HEX, cssVar } from '../lib/colors';
import { CATEGORY_COLOR_HEX, DEFAULT_CATEGORIES, categoryLabel } from '../data/categories';
import { REPAIR_STATUSES } from '../types';
import { round2 } from '../lib/calc';
import { PageHeader } from './shared/PageHeader';
import { Card, SectionTitle, StatCard, Badge, EmptyState } from './shared/UI';
import { LoadingPage } from './shared/Skeleton';
import { canAccess } from '../lib/permissions';

ChartJS.register(CategoryScale, LinearScale, BarElement, ArcElement, PointElement, LineElement, Tooltip, Legend, Filler);

export function Dashboard() {
  const { t } = useTranslation();
  const f = useFormat();
  const mode = useStore((s) => s.mode);
  const accent = useStore((s) => s.accent);
  const user = useStore((s) => s.currentUser);
  const setActive = useStore((s) => s.setActiveModule);
  const data = useLiveQuery(async () => {
    const [sales, repairs, products, expenses, invoices] = await Promise.all([
      db.sales.toArray(), db.repairs.toArray(), db.products.toArray(), db.expenses.toArray(), db.invoices.toArray(),
    ]);
    return { sales, repairs, products, expenses, invoices };
  }, []);

  const stats = useMemo(() => {
    if (!data) return null;
    const rate = f.settings.taxRate;
    const totalSales = round2(data.sales.reduce((a, s) => a + s.total, 0));
    const profit = round2(data.sales.reduce((a, s) => a + s.items.reduce((b, i) => b + (i.price / (1 + rate / 100) - i.cost) * i.quantity, 0), 0));
    const base = round2(totalSales / (1 + rate / 100));
    const pending = data.repairs.filter((r) => ACTIVE_REPAIR.includes(r.status)).length;
    const low = data.products.filter((p) => p.stock <= p.minStock);
    const out = low.filter((p) => p.stock <= 0).length;
    const today = new Date();
    const todaySales = data.sales.filter((s) => { const d = toDate(s.date); return d && isSameDay(d, today); });
    const extraIncome = data.invoices.filter((i) => !i.saleId && i.status !== 'cancelled').reduce((a, i) => a + i.paid, 0);
    const income = round2(totalSales + extraIncome);
    const expenses = round2(data.expenses.reduce((a, e) => a + e.amount, 0));
    return { totalSales, profit, margin: base ? (profit / base) * 100 : 0, pending, low, out, todaySales, income, expenses, balance: round2(income - expenses), extraIncome };
  }, [data, f.settings.taxRate]);

  const charts = useMemo(() => {
    if (!data) return null;
    const primary = cssVar('--sl-primary', '#4f46e5');
    const text = cssVar('--sl-muted', '#64748b');
    const grid = cssVar('--sl-border', '#e2e8f0');
    const days = Array.from({ length: 7 }, (_, i) => startOfDay(subDays(new Date(), 6 - i)));
    const perDay = days.map((d) => round2(data.sales.filter((s) => { const x = toDate(s.date); return x && isSameDay(x, d); }).reduce((a, s) => a + s.total, 0)));
    const cats = f.settings.categories?.length ? f.settings.categories : DEFAULT_CATEGORIES;
    const byCat = new Map<string, number>();
    for (const s of data.sales) for (const i of s.items) byCat.set(i.category, (byCat.get(i.category) ?? 0) + i.price * i.quantity);
    const catKeys = [...byCat.keys()];
    const statusCounts = REPAIR_STATUSES.map((st) => data.repairs.filter((r) => r.status === st).length);
    const scales = {
      x: { ticks: { color: text }, grid: { display: false } },
      y: { ticks: { color: text }, grid: { color: grid }, beginAtZero: true },
    };
    return {
      bar: {
        data: { labels: days.map((d) => format(d, 'EEE dd', { locale: f.locale })), datasets: [{ label: t('dashboard.sales'), data: perDay, backgroundColor: primary, borderRadius: 8, maxBarThickness: 38 }] },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: (c: { raw: unknown }) => f.money(Number(c.raw)) } } }, scales },
      },
      donut: {
        data: {
          labels: catKeys.map((k) => categoryLabel(cats.find((c) => c.id === k), t)),
          datasets: [{ data: catKeys.map((k) => round2(byCat.get(k)!)), backgroundColor: catKeys.map((k, i) => CATEGORY_COLOR_HEX[cats.find((c) => c.id === k)?.color ?? ''] ?? ['#6366f1', '#10b981', '#f59e0b', '#ef4444'][i % 4]), borderWidth: 2, borderColor: cssVar('--sl-card', '#fff') }],
        },
        options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'bottom' as const, labels: { color: text, boxWidth: 10, padding: 12 } }, tooltip: { callbacks: { label: (c: { label: string; raw: unknown }) => `${c.label}: ${f.money(Number(c.raw))}` } } } },
      },
      line: {
        data: {
          labels: REPAIR_STATUSES.map((s) => t(`repairStatus.${s}`)),
          datasets: [{ label: t('dashboard.repairs'), data: statusCounts, borderColor: primary, backgroundColor: primary + '22', fill: true, tension: 0.35, pointBackgroundColor: REPAIR_STATUSES.map((s) => REPAIR_STATUS_HEX[s]), pointRadius: 6, pointHoverRadius: 8 }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { ...scales, y: { ...scales.y, ticks: { color: text, precision: 0 } } } },
      },
    };
    // eslint-disable-next-line
  }, [data, mode, accent, f, t]);

  if (!data || !stats || !charts) return <LoadingPage />;

  const maxFin = Math.max(stats.income, stats.expenses, Math.abs(stats.balance), 1);
  const recent = [...data.sales].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);

  return (
    <div className="space-y-5">
      <PageHeader icon="📊" title={t('nav.dashboard')} subtitle={t('dashboard.subtitle', { date: format(new Date(), 'PPPP', { locale: f.locale }) })} />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon="💰" tone="indigo" label={t('dashboard.totalSales')} value={f.money(stats.totalSales)} sub={t('dashboard.todaySales', { count: stats.todaySales.length, total: f.money(stats.todaySales.reduce((a, s) => a + s.total, 0)) })} />
        <StatCard icon="📈" tone="green" label={t('dashboard.profit')} value={f.money(stats.profit)} sub={t('dashboard.margin', { pct: stats.margin.toFixed(1) })} />
        <StatCard icon="🔧" tone="amber" label={t('dashboard.pendingRepairs')} value={stats.pending} sub={t('dashboard.totalRepairs', { count: data.repairs.length })}
          onClick={user && canAccess(user, 'repairs') ? () => setActive('repairs') : undefined} />
        <StatCard icon="⚠️" tone="red" label={t('dashboard.lowStock')} value={stats.low.length} sub={t('dashboard.outOfStock', { count: stats.out })}
          onClick={user && canAccess(user, 'inventory') ? () => setActive('inventory') : undefined} />
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <SectionTitle right={<Badge color="indigo">{f.money(charts.bar.data.datasets[0].data.reduce((a, b) => a + b, 0))}</Badge>}>📊 {t('dashboard.salesLast7')}</SectionTitle>
          <div className="h-64"><Bar data={charts.bar.data} options={charts.bar.options as never} /></div>
        </Card>
        <Card className="p-4">
          <SectionTitle>🍩 {t('dashboard.salesByCategory')}</SectionTitle>
          <div className="h-64">{charts.donut.data.labels.length ? <Doughnut data={charts.donut.data} options={charts.donut.options as never} /> : <EmptyState />}</div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        <Card className="p-4 xl:col-span-2">
          <SectionTitle>📉 {t('dashboard.repairsByStatus')}</SectionTitle>
          <div className="h-60"><Line data={charts.line.data} options={charts.line.options as never} /></div>
        </Card>
        <Card className="p-4">
          <SectionTitle>💼 {t('dashboard.financialSummary')}</SectionTitle>
          <div className="space-y-4">
            {[
              { k: 'income', v: stats.income, c: 'bg-emerald-500', icon: '⬆️' },
              { k: 'expenses', v: stats.expenses, c: 'bg-red-500', icon: '⬇️' },
              { k: 'balance', v: stats.balance, c: stats.balance >= 0 ? 'bg-primary' : 'bg-orange-500', icon: '⚖️' },
            ].map((r) => (
              <div key={r.k}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-sl-muted">{r.icon} {t(`dashboard.${r.k}`)}</span>
                  <span className={`font-bold ${r.k === 'balance' ? (r.v >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500') : 'text-sl-text'}`}>{f.money(r.v)}</span>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-sl-hover">
                  <div className={`h-full rounded-full ${r.c}`} style={{ width: `${Math.max(3, (Math.abs(r.v) / maxFin) * 100)}%`, transition: 'width .6s ease' }} />
                </div>
              </div>
            ))}
            <p className="text-[11px] text-sl-muted">{t('dashboard.financialNote')}</p>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>🧾 {t('dashboard.recentSales')}</SectionTitle>
          {recent.length ? recent.map((s) => (
            <div key={s.id} className="flex items-center justify-between gap-3 border-b border-sl-border py-2 text-sm last:border-0">
              <div className="min-w-0">
                <div className="font-semibold text-sl-text">{s.ticketNumber} · <span className="font-normal text-sl-muted">{s.customerName || t('pos.walkIn')}</span></div>
                <div className="text-xs text-sl-muted">{f.dateTime(s.date)} · {t(`payment.${s.paymentMethod}`)}</div>
              </div>
              <span className="font-bold text-sl-text">{f.money(s.total)}</span>
            </div>
          )) : <EmptyState />}
        </Card>
        <Card className="p-4">
          <SectionTitle>📦 {t('dashboard.stockAlerts')}</SectionTitle>
          {stats.low.length ? stats.low.slice(0, 6).map((p) => (
            <div key={p.id} className="flex items-center justify-between gap-3 border-b border-sl-border py-2 text-sm last:border-0">
              <span className="truncate text-sl-text">{p.name}</span>
              <Badge color={p.stock <= 0 ? 'red' : 'amber'}>{p.stock <= 0 ? t('inventory.outOfStock') : `${p.stock} / ${p.minStock}`}</Badge>
            </div>
          )) : <EmptyState icon="✅" title={t('dashboard.allStockOk')} />}
        </Card>
      </div>
    </div>
  );
}