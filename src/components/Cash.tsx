import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { FileDown, LockOpen, Plus, Wallet } from 'lucide-react';
import { db, getSettings } from '../db/database';
import { toast, confirmDialog, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { round2 } from '../lib/calc';
import { logAction } from '../lib/audit';
import { tablePdf } from '../lib/pdf';
import { addAdjustment, closeCashSession, openCashSession, sessionBreakdown, type CashBreakdown } from '../lib/cash';
import type { CashAdjustment } from '../types';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, EmptyState, SectionTitle, StatCard } from './shared/UI';
import { Button, Input, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';
import { LoadingPage } from './shared/Skeleton';

export function Cash() {
  const { t } = useTranslation();
  const f = useFormat();
  const user = useStore((s) => s.currentUser);
  const sessions = useLiveQuery(() => db.cashSessions.orderBy('openedAt').reverse().toArray(), []);
  const [float, setFloat] = useState('');
  const [busy, setBusy] = useState(false);
  const [bd, setBd] = useState<CashBreakdown | null>(null);  const [adjOpen, setAdjOpen] = useState(false);
  const [adjForm, setAdjForm] = useState<{ type: CashAdjustment['type']; amount: string; note: string }>({ type: 'withdraw', amount: '', note: '' });
  const [closeOpen, setCloseOpen] = useState(false);
  const [counted, setCounted] = useState('');
  const [closeNote, setCloseNote] = useState('');

  const current = useMemo(() => sessions?.find((s) => s.status === 'open'), [sessions]);
  const closed = useMemo(() => (sessions ?? []).filter((s) => s.status === 'closed'), [sessions]);

  useEffect(() => {
    let alive = true;
    if (current) sessionBreakdown(current).then((b) => { if (alive) setBd(b); });
    return () => { alive = false; };
  }, [current]);
  // No open session means no expected cash: derive it instead of writing state here.
  const breakdown = current ? bd : null;

  if (!sessions || !user) return <LoadingPage />;

  const open = async () => {
    const amount = round2(Number(float.replace(',', '.')) || 0);
    if (amount < 0) { toast.error(t('validation.positive')); return; }
    if (current) { toast.warning(t('cash.alreadyOpen')); return; }
    setBusy(true);
    try {
      await openCashSession(amount);
      await logAction('open', 'cash', `${t('cash.openingFloat')}: ${f.money(amount)} · ${user.name}`);
      toast.success(`💵 ${t('cash.sessionOpenToast', { amount: f.money(amount) })}`);
      setFloat('');
    } finally {
      setBusy(false);
    }
  };

  const saveAdjustment = async () => {
    if (!current) return;
    const amount = round2(Number(adjForm.amount.replace(',', '.')) || 0);
    if (!(amount > 0)) { toast.error(t('validation.positive')); return; }
    setBusy(true);
    try {
      await addAdjustment(current, adjForm.type, amount, adjForm.note.trim() || undefined);
      await logAction('update', 'cash', `${t(`cash.${adjForm.type}`)} · ${f.money(amount)}`);
      toast.success(`✅ ${t('common.saved')}`);
      setAdjOpen(false);
      setAdjForm({ type: 'withdraw', amount: '', note: '' });
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    if (!current) return;
    const value = Number(counted.replace(',', '.'));
    if (!Number.isFinite(value) || value < 0) { toast.error(t('validation.positive')); return; }
    if (!(await confirmDialog(t('cash.closeConfirm'), { confirmLabel: t('cash.close') }))) return;
    setBusy(true);
    try {
      const closedSession = await closeCashSession(current, value, closeNote.trim() || undefined);
      const diff = closedSession.difference ?? 0;
      await logAction('close', 'cash', `${t('cash.difference')}: ${f.money(diff)} · ${user.name}`);
      toast.success(`🔒 ${t('cash.sessionClosedToast', { amount: f.money(diff) })}`);
      setCloseOpen(false);
      setCounted('');
      setCloseNote('');
    } finally {
      setBusy(false);
    }
  };

  const exportPdf = async () => {
    if (!closed.length) { toast.warning(t('cash.noSessions')); return; }
    const s = await getSettings();
    const [first] = closed;
    tablePdf({
      title: t('nav.cash'),
      subtitle: `${closed.length} ${t('cash.sessions')} · ${f.date(first.openedAt)} → ${f.date(closed[0].closedAt)}`,
      columns: [
        { label: t('cash.closedAt') }, { label: t('cash.openedBy') },
        { label: t('cash.openingFloat'), align: 'right' }, { label: t('cash.expected'), align: 'right' },
        { label: t('cash.counted'), align: 'right' }, { label: t('cash.difference'), align: 'right' },
      ],
      rows: closed.map((x) => [
        f.dateTime(x.closedAt), x.closedBy ?? '—', f.money(x.openingFloat), f.money(x.expected ?? 0),
        f.money(x.counted ?? 0), f.money(x.difference ?? 0),
      ]),
      kpis: [
        [t('cash.sessions'), String(closed.length)],
        [t('cash.expected'), f.money(closed.reduce((a, x) => a + (x.expected ?? 0), 0))],
        [t('cash.difference'), f.money(closed.reduce((a, x) => a + (x.difference ?? 0), 0))],
      ],
      filename: `cierre_caja_${new Date().toISOString().slice(0, 10)}.pdf`,
      settings: s,
    });
    await logAction('print', 'cash', `${closed.length} ${t('cash.sessions')}`);
    toast.success(t('reports.exported'));
  };

  const diff = breakdown ? round2((Number(counted.replace(',', '.')) || 0) - breakdown.expected) : 0;
  const adjustments = current?.adjustments ?? [];

  return (
    <div className="space-y-4">
      <PageHeader icon="💵" title={t('nav.cash')} subtitle={t('cash.subtitle')}
        actions={<Button variant="secondary" icon={<FileDown />} onClick={exportPdf} disabled={!closed.length}>{t('cash.pdf')}</Button>} />

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard icon={current ? '🟢' : '⚪'} tone={current ? 'green' : 'slate'} label={t('cash.status')}
          value={current ? t('cash.opened') : t('cash.closed')} sub={current ? f.dateTime(current.openedAt) : t('cash.noOpen')} />
        <StatCard icon="🏦" tone="indigo" label={t('cash.openingFloat')} value={f.money(current?.openingFloat ?? 0)} />
        <StatCard icon="🧮" tone="blue" label={t('cash.expected')} value={f.money(breakdown?.expected ?? 0)} sub={t('cash.expectedHint')} />
        <StatCard icon="⚖️" tone={current ? 'amber' : 'slate'} label={t('cash.difference')}
          value={current ? '—' : f.money(closed.reduce((a, x) => a + (x.difference ?? 0), 0))} sub={t('cash.closedSessions')} />
      </div>

      {!current ? (
        <Card className="p-5">
          <SectionTitle>🔓 {t('cash.openTitle')}</SectionTitle>
          <p className="mb-3 text-sm text-sl-muted">{t('cash.openHint')}</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-48">
              <Input label={t('cash.openingFloat')} type="number" min="0" step="0.01" value={float}
                onChange={(e) => setFloat(e.target.value)} />
            </div>
            <Button icon={<LockOpen />} loading={busy} onClick={open}>{t('cash.open')}</Button>
          </div>
        </Card>
      ) : (
        <Card className="p-5">
          <SectionTitle right={<div className="flex gap-2">
            <Button size="sm" variant="secondary" icon={<Plus />} onClick={() => setAdjOpen(true)}>{t('cash.addAdjustment')}</Button>
            <Button size="sm" variant="danger" icon={<Wallet />} onClick={() => { setCounted(String(breakdown?.expected ?? '')); setCloseOpen(true); }}>{t('cash.close')}</Button>
          </div>}>
            🟢 {t('cash.opened')} · {f.dateTime(current.openedAt)}
          </SectionTitle>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <BreakdownRow label={t('cash.openingFloat')} value={breakdown?.openingFloat ?? 0} />
            <BreakdownRow label={t('cash.cashSales')} value={breakdown?.cashSales ?? 0} />
            <BreakdownRow label={t('cash.cashInvoices')} value={breakdown?.cashInvoices ?? 0} />
            <BreakdownRow label={t('cash.deposits')} value={breakdown?.deposits ?? 0} positive />
            <BreakdownRow label={t('cash.withdrawals')} value={-(breakdown?.withdrawals ?? 0)} />
            <BreakdownRow label={t('cash.cashReturns')} value={-(breakdown?.cashReturns ?? 0)} />
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-xl border border-primary/30 bg-primary/5 px-4 py-3">
            <span className="text-sm font-semibold text-sl-text">🧮 {t('cash.expected')}</span>
            <span className="text-xl font-extrabold text-primary">{f.money(breakdown?.expected ?? 0)}</span>
          </div>

          {adjustments.length > 0 && (
            <div className="mt-3 space-y-1">
              {adjustments.map((a, i) => (
                <div key={`${a.at}-${i}`} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-2 text-sm">
                  <span className="flex items-center gap-2">
                    <Badge color={a.type === 'deposit' ? 'green' : 'amber'}>{t(`cash.${a.type}`)}</Badge>
                    <span className="text-sl-muted">{f.dateTime(a.at)}{a.userName ? ` · ${a.userName}` : ''}</span>
                    {a.note && <span className="truncate text-sl-muted">— {a.note}</span>}
                  </span>
                  <b className={a.type === 'deposit' ? 'text-green-600' : 'text-amber-600'}>
                    {a.type === 'deposit' ? '+' : '−'}{f.money(a.amount)}
                  </b>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      <Card className="p-5">
        <SectionTitle right={<span className="text-xs text-sl-muted">{closed.length} {t('cash.sessions')}</span>}>
          🕐 {t('cash.history')}
        </SectionTitle>
        {closed.length === 0 ? (
          <EmptyState icon="🪙" title={t('cash.noSessions')} hint={t('cash.noSessionsHint')} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-sl-border text-start text-[11px] uppercase tracking-wide text-sl-muted">
                  <th className="px-2 py-2 text-start font-semibold">{t('cash.closedAt')}</th>
                  <th className="px-2 py-2 text-start font-semibold">{t('cash.closedBy')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{t('cash.openingFloat')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{t('cash.expected')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{t('cash.counted')}</th>
                  <th className="px-2 py-2 text-end font-semibold">{t('cash.difference')}</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((x) => (
                  <tr key={x.id} className="border-b border-sl-border/60 last:border-0">
                    <td className="px-2 py-2 text-sl-text">{f.dateTime(x.closedAt)}</td>
                    <td className="px-2 py-2 text-sl-muted">{x.closedBy ?? '—'}</td>
                    <td className="px-2 py-2 text-end text-sl-text">{f.money(x.openingFloat)}</td>
                    <td className="px-2 py-2 text-end text-sl-text">{f.money(x.expected ?? 0)}</td>
                    <td className="px-2 py-2 text-end text-sl-text">{f.money(x.counted ?? 0)}</td>
                    <td className="px-2 py-2 text-end">
                      <Badge color={(x.difference ?? 0) === 0 ? 'green' : 'red'}>
                        {(x.difference ?? 0) === 0 ? '✅' : '⚠️'} {f.money(x.difference ?? 0)}
                      </Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal open={adjOpen} onClose={() => setAdjOpen(false)} size="sm" title={`💵 ${t('cash.addAdjustment')}`}
        subtitle={t('cash.adjustmentHint')}
        footer={<><Button variant="secondary" onClick={() => setAdjOpen(false)}>{t('common.cancel')}</Button>
          <Button loading={busy} onClick={saveAdjustment}>{t('common.save')}</Button></>}>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {(['deposit', 'withdraw'] as const).map((type) => (
              <button key={type} type="button" onClick={() => setAdjForm({ ...adjForm, type })}
                className={`rounded-lg border px-3 py-2 text-sm font-semibold ${adjForm.type === type ? 'border-primary bg-primary/10 text-primary' : 'border-sl-border text-sl-muted hover:border-primary/40'}`}>
                {type === 'deposit' ? '📥' : '📤'} {t(`cash.${type}`)}
              </button>
            ))}
          </div>
          <Input label={t('cash.amount')} type="number" min="0" step="0.01" autoFocus
            value={adjForm.amount} onChange={(e) => setAdjForm({ ...adjForm, amount: e.target.value })} />
          <TextArea label={t('cash.note')} rows={2} value={adjForm.note} onChange={(e) => setAdjForm({ ...adjForm, note: e.target.value })} />
        </div>
      </Modal>

      <Modal open={closeOpen} onClose={() => setCloseOpen(false)} size="sm" title={`🔒 ${t('cash.closeTitle')}`}
        subtitle={t('cash.closeHint')}
        footer={<><Button variant="secondary" onClick={() => setCloseOpen(false)}>{t('common.cancel')}</Button>
          <Button variant="danger" loading={busy} onClick={doClose}>{t('cash.close')}</Button></>}>
        <div className="space-y-3">
          <div className="flex items-center justify-between rounded-lg bg-sl-hover px-3 py-2 text-sm">
            <span className="text-sl-muted">🧮 {t('cash.expected')}</span>
            <b className="text-sl-text">{f.money(breakdown?.expected ?? 0)}</b>
          </div>
          <Input label={t('cash.counted')} type="number" min="0" step="0.01" autoFocus
            value={counted} onChange={(e) => setCounted(e.target.value)} hint={t('cash.countedHint')} />
          <div className={`flex items-center justify-between rounded-lg px-3 py-2 text-sm ${Math.abs(diff) < 0.005 ? 'bg-green-500/10 text-green-600 dark:text-green-400' : 'bg-red-500/10 text-red-600 dark:text-red-300'}`}>
            <span>{Math.abs(diff) < 0.005 ? '✅' : '⚠️'} {t('cash.difference')}</span>
            <b>{f.money(diff)}</b>
          </div>
          <TextArea label={t('cash.note')} rows={2} value={closeNote} onChange={(e) => setCloseNote(e.target.value)} />
        </div>
      </Modal>
    </div>
  );
}

function BreakdownRow({ label, value, positive = false }: { label: string; value: number; positive?: boolean }) {
  const f = useFormat();
  return (
    <div className="flex items-center justify-between rounded-lg border border-sl-border bg-sl-card2 px-3 py-2 text-sm">
      <span className="text-sl-muted">{label}</span>
      <b className={value < 0 ? 'text-red-500' : positive ? 'text-green-600' : 'text-sl-text'}>{f.money(value)}</b>
    </div>
  );
}
