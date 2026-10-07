import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { subDays, subMonths, subYears } from 'date-fns';
import { Download, FileText } from 'lucide-react';
import { db } from '../db/database';
import { toast } from '../store/store';
import { plainMoney, toDate, useFormat } from '../lib/format';
import { round2, splitVat } from '../lib/calc';
import { logAction } from '../lib/audit';
import { downloadFile } from '../lib/backup';
import { pdfT, tablePdf, type PdfColumn } from '../lib/pdf';
import { DEFAULT_CATEGORIES, categoryLabel } from '../data/categories';
import { PageHeader } from './shared/PageHeader';
import { Card, SectionTitle, StatCard } from './shared/UI';
import { Button } from './shared/Forms';
import { LoadingPage } from './shared/Skeleton';
import { DataTable } from './shared/SortableTable';

type ReportType = 'sales' | 'balance' | 'repairs' | 'expenses' | 'inventory';
type Period = 'week' | 'month' | 'year' | 'all';
const TYPES: { id: ReportType; icon: string }[] = [
  { id: 'sales', icon: '🧾' }, { id: 'balance', icon: '⚖️' }, { id: 'repairs', icon: '🔧' }, { id: 'expenses', icon: '💸' }, { id: 'inventory', icon: '📦' },
];
const PERIODS: Period[] = ['week', 'month', 'year', 'all'];

interface ReportData { columns: (PdfColumn & { key: string })[]; rows: string[][]; kpis: [string, string][] }

export function Reports() {
  const { t } = useTranslation();
  const f = useFormat();
  const s = f.settings;
  const [type, setType] = useState<ReportType>('sales');
  const [period, setPeriod] = useState<Period>('month');
  const data = useLiveQuery(async () => {
    const [sales, repairs, expenses, products, invoices] = await Promise.all([db.sales.toArray(), db.repairs.toArray(), db.expenses.toArray(), db.products.toArray(), db.invoices.toArray()]);
    return { sales, repairs, expenses, products, invoices };
  }, []);

  const since = useMemo(() => {
    const n = new Date();
    return period === 'week' ? subDays(n, 7) : period === 'month' ? subMonths(n, 1) : period === 'year' ? subYears(n, 1) : null;
  }, [period]);

  const build = (tt: (k: string, o?: Record<string, unknown>) => string, money: (n: number) => string): ReportData | null => {
    if (!data) return null;
    const inP = (d?: string) => { if (!since) return true; const x = toDate(d); return !!x && x >= since; };
    const sales = data.sales.filter((x) => inP(x.date));
    const repairs = data.repairs.filter((x) => inP(x.dateIn));
    const expenses = data.expenses.filter((x) => inP(x.date));
    const invoices = data.invoices.filter((x) => inP(x.date) && x.status !== 'cancelled');
    const totSales = round2(sales.reduce((a, x) => a + x.total, 0));
    const totExp = round2(expenses.reduce((a, x) => a + x.amount, 0));
    const cats = s.categories?.length ? s.categories : DEFAULT_CATEGORIES;
    switch (type) {
      case 'sales': {
        const v = splitVat(totSales, s.taxRate);
        return {
          columns: [{ key: 'ticket', label: tt('pos.ticket') }, { key: 'date', label: tt('common.date') }, { key: 'customer', label: tt('common.customer'), weight: 1.5 }, { key: 'items', label: tt('reports.units'), align: 'right', weight: 0.6 }, { key: 'pm', label: tt('pos.paymentMethod') }, { key: 'base', label: tt('tax.base'), align: 'right' }, { key: 'vat', label: tt('tax.vat'), align: 'right' }, { key: 'total', label: tt('common.total'), align: 'right' }],
          rows: [...sales].sort((a, b) => b.date.localeCompare(a.date)).map((x) => [x.ticketNumber, f.dateTime(x.date), x.customerName || tt('pos.walkIn'), String(x.items.reduce((a, i) => a + i.quantity, 0)), tt(`payment.${x.paymentMethod}`), money(x.subtotal), money(x.tax), money(x.total)]),
          kpis: [[tt('reports.salesCount'), String(sales.length)], [tt('tax.base'), money(v.base)], [tt('tax.vat'), money(v.vat)], [tt('common.total'), money(totSales)]],
        };
      }
      case 'balance': {
        const rate = s.taxRate;
        const cogs = round2(sales.reduce((a, x) => a + x.items.reduce((b, i) => b + i.cost * i.quantity, 0), 0));
        const otherInc = round2(invoices.filter((i) => !i.saleId).reduce((a, i) => a + i.paid, 0));
        const income = round2(totSales + otherInc);
        const vatOut = round2(splitVat(totSales, rate).vat + invoices.filter((i) => !i.saleId).reduce((a, i) => a + (i.paid / (i.total || 1)) * i.totalTax, 0));
        const rows: string[][] = [
          [tt('reports.salesIncome'), money(totSales)], [tt('reports.otherIncome'), money(otherInc)], [tt('reports.totalIncome'), money(income)],
          [tt('reports.cogs'), '-' + money(cogs)], [tt('nav.expenses'), '-' + money(totExp)], [tt('reports.vatCollected'), money(vatOut)],
          [tt('reports.netBalance'), money(round2(income - totExp))], [tt('reports.grossMargin'), money(round2(income - vatOut - cogs - totExp))],
        ];
        return { columns: [{ key: 'concept', label: tt('reports.concept'), weight: 2 }, { key: 'amount', label: tt('expenses.amount'), align: 'right' }], rows, kpis: [[tt('reports.totalIncome'), money(income)], [tt('nav.expenses'), money(totExp)], [tt('reports.netBalance'), money(round2(income - totExp))]] };
      }
      case 'repairs': {
        const revenue = round2(repairs.filter((r) => ['completed', 'delivered'].includes(r.status)).reduce((a, r) => a + (r.finalCost ?? r.estimatedCost), 0));
        return {
          columns: [{ key: 'ticket', label: tt('repairs.ticket') }, { key: 'date', label: tt('common.date') }, { key: 'customer', label: tt('common.customer'), weight: 1.4 }, { key: 'device', label: tt('repairs.device'), weight: 1.4 }, { key: 'status', label: tt('common.status') }, { key: 'est', label: tt('repairs.estimate'), align: 'right' }, { key: 'final', label: tt('repairs.finalCost'), align: 'right' }],
          rows: repairs.map((r) => [r.ticketNumber, f.date(r.dateIn), r.customerName, r.device, tt(`repairStatus.${r.status}`), money(r.estimatedCost), r.finalCost !== undefined ? money(r.finalCost) : '—']),
          kpis: [[tt('reports.repairsCount'), String(repairs.length)], [tt('reports.completed'), String(repairs.filter((r) => ['completed', 'delivered'].includes(r.status)).length)], [tt('reports.repairRevenue'), money(revenue)]],
        };
      }
      case 'expenses':
        return {
          columns: [{ key: 'date', label: tt('common.date') }, { key: 'cat', label: tt('common.category') }, { key: 'desc', label: tt('common.description'), weight: 2.5 }, { key: 'amount', label: tt('expenses.amount'), align: 'right' }],
          rows: [...expenses].sort((a, b) => b.date.localeCompare(a.date)).map((e) => [f.date(e.date), tt(`expenseCat.${e.category}`), e.description, money(e.amount)]),
          kpis: [[tt('expenses.total'), money(totExp)], [tt('reports.expensesCount'), String(expenses.length)]],
        };
      case 'inventory': {
        const prods = data.products;
        return {
          columns: [{ key: 'name', label: tt('common.product'), weight: 2.4 }, { key: 'cat', label: tt('common.category') }, { key: 'code', label: tt('inventory.code'), weight: 1.3 }, { key: 'cost', label: tt('inventory.cost'), align: 'right' }, { key: 'price', label: tt('common.price'), align: 'right' }, { key: 'stock', label: tt('common.stock'), align: 'right', weight: 0.6 }, { key: 'value', label: tt('inventory.stockValue'), align: 'right' }],
          rows: prods.map((p) => [p.name, categoryLabel(cats.find((c) => c.id === p.category), tt), p.barcode || '—', money(p.cost), money(p.price), String(p.stock), money(p.cost * p.stock)]),
          kpis: [[tt('inventory.totalProducts'), String(prods.length)], [tt('inventory.stockValue'), money(prods.reduce((a, p) => a + p.cost * p.stock, 0))], [tt('inventory.lowStock'), String(prods.filter((p) => p.stock <= p.minStock).length)]],
        };
      }
    }
  };

  const report = useMemo(() => build(t, f.money), [data, type, period, t, f]);
  if (!data || !report) return <LoadingPage />;

  const fileBase = `shoplogic_${type}_${period}_${new Date().toISOString().slice(0, 10)}`;
  const exportPdf = () => {
    const pt = pdfT();
    const r = build(pt, (n) => plainMoney(n, s))!;
    tablePdf({ title: `${pt('reports.report')}: ${pt(`reports.type_${type}`)}`, subtitle: pt(`reports.period_${period}`), columns: r.columns, rows: r.rows, kpis: r.kpis, filename: `${fileBase}.pdf`, settings: s });
    logAction('export', 'reports', `PDF ${type} ${period}`);
    toast.success(t('reports.exported'));
  };
  const exportCsv = () => {
    const r = build(t, (n) => n.toFixed(2));
    if (!r) return;
    const escCsv = (v: string) => `"${String(v).replace(/"/g, '""')}"`;
    const csv = '\uFEFF' + [r.columns.map((c) => escCsv(c.label)).join(';'), ...r.rows.map((row) => row.map(escCsv).join(';'))].join('\r\n');
    downloadFile(csv, `${fileBase}.csv`, 'text/csv;charset=utf-8');
    logAction('export', 'reports', `CSV ${type} ${period}`);
    toast.success(t('reports.exported'));
  };

  const inP = (d?: string) => { if (!since) return true; const x = toDate(d); return !!x && x >= since; };
  const kSales = data.sales.filter((x) => inP(x.date)).reduce((a, x) => a + x.total, 0);
  const kExp = data.expenses.filter((x) => inP(x.date)).reduce((a, x) => a + x.amount, 0);
  const kRep = data.repairs.filter((x) => inP(x.dateIn)).length;

  return (
    <div className="space-y-4">
      <PageHeader icon="📈" title={t('nav.reports')} subtitle={t('reports.subtitle')}
        actions={<><Button variant="secondary" icon={<FileText />} onClick={exportCsv}>CSV</Button><Button icon={<Download />} onClick={exportPdf}>PDF</Button></>} />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <StatCard icon="🧾" tone="indigo" label={t('dashboard.sales')} value={f.money(kSales)} />
        <StatCard icon="💸" tone="red" label={t('nav.expenses')} value={f.money(kExp)} />
        <StatCard icon="🔧" tone="amber" label={t('dashboard.repairs')} value={kRep} />
        <StatCard icon="⚖️" tone={kSales - kExp >= 0 ? 'green' : 'red'} label={t('dashboard.balance')} value={f.money(kSales - kExp)} />
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-4">
          <SectionTitle>📋 {t('reports.type')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {TYPES.map((x) => (
              <button key={x.id} type="button" onClick={() => setType(x.id)} className={`flex items-center gap-2 rounded-xl border p-3 text-start text-sm font-semibold ${type === x.id ? 'border-primary bg-primary/10 text-primary' : 'border-sl-border text-sl-text hover:border-primary/40'}`}>
                <span className="text-xl">{x.icon}</span>{t(`reports.type_${x.id}`)}
              </button>
            ))}
          </div>
        </Card>
        <Card className="p-4">
          <SectionTitle>📅 {t('reports.period')}</SectionTitle>
          <div className="grid grid-cols-2 gap-2">
            {PERIODS.map((p) => (
              <button key={p} type="button" onClick={() => setPeriod(p)} className={`rounded-xl border p-3 text-sm font-semibold ${period === p ? 'border-primary bg-primary/10 text-primary' : 'border-sl-border text-sl-text hover:border-primary/40'}`}>{t(`reports.period_${p}`)}</button>
            ))}
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1" icon={<Download />} onClick={exportPdf}>{t('reports.exportPdf')}</Button>
            <Button className="flex-1" variant="secondary" icon={<FileText />} onClick={exportCsv}>{t('reports.exportCsv')}</Button>
          </div>
        </Card>
      </div>
      <Card className="p-4">
        <SectionTitle right={<span className="text-xs text-sl-muted">{t('reports.rows', { count: report.rows.length })}</span>}>👁️ {t('reports.preview')}: {t(`reports.type_${type}`)} · {t(`reports.period_${period}`)}</SectionTitle>
        <div className="mb-3 grid grid-cols-2 gap-2 md:grid-cols-4">
          {report.kpis.map(([l, v]) => <div key={l} className="rounded-lg border border-sl-border bg-sl-card2 p-2.5"><div className="text-[10px] font-bold uppercase text-sl-muted">{l}</div><div className="font-bold text-sl-text">{v}</div></div>)}
        </div>
        <DataTable data={report.rows.map((r, i) => ({ _i: i, ...Object.fromEntries(report.columns.map((c, j) => [c.key, r[j]])) }) as Record<string, string | number>)}
          rowKey={(r) => r._i} minWidth={report.columns.length * 110}
          columns={report.columns.map((c) => ({ key: c.key, label: c.label, className: c.align === 'right' ? 'text-end' : '', sortValue: (r: Record<string, string | number>) => { const v = String(r[c.key] ?? ''); const n = Number(v.replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.')); return c.align === 'right' && !Number.isNaN(n) ? n : v; } }))} />
      </Card>
    </div>
  );
}