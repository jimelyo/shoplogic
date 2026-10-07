import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { ArrowLeft, Undo2 } from 'lucide-react';
import { db } from '../db/database';
import { toast, confirmDialog } from '../store/store';
import { useFormat } from '../lib/format';
import { logAction } from '../lib/audit';
import { createReturn, refundable } from '../lib/returns';
import type { Sale } from '../types';
import { Badge, EmptyState } from './shared/UI';
import { Button, Input, TextArea } from './shared/Forms';
import { Modal } from './shared/Modal';

/**
 * Ticket history with the refund action. A refund puts the units back in stock,
 * reverses the customer's points and spend, and cancels the invoice when the
 * whole ticket is given back.
 */
export function SalesReturns({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const sales = useLiveQuery(() => (open ? db.sales.orderBy('date').reverse().toArray() : []), [open]);
  const [q, setQ] = useState('');
  const [target, setTarget] = useState<Sale | null>(null);
  const [qty, setQty] = useState<Record<number, number>>({});
  const [available, setAvailable] = useState<Record<number, number>>({});
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);

  // Opening or leaving a ticket resets the selection in the event that caused it,
  // so the effect only has to wait for the refundable quantities.
  useEffect(() => {
    let alive = true;
    if (target) refundable(target).then((r) => { if (alive) setAvailable(r); });
    return () => { alive = false; };
  }, [target]);

  const list = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return sales ?? [];
    return (sales ?? []).filter((s) =>
      s.ticketNumber.toLowerCase().includes(needle) || (s.customerName ?? '').toLowerCase().includes(needle)
      || s.items.some((i) => i.name.toLowerCase().includes(needle)));
  }, [sales, q]);

  if (!open) return null;

  const setLine = (productId: number, max: number, value: number) => {
    const next = Math.max(0, Math.min(max, Number.isFinite(value) ? Math.trunc(value) : 0));
    setQty((prev) => ({ ...prev, [productId]: next }));
  };

  const submit = async () => {
    if (!target) return;
    const lines = Object.entries(qty)
      .map(([productId, quantity]) => ({ productId: Number(productId), quantity }))
      .filter((l) => l.quantity > 0);
    if (!lines.length) { toast.warning(t('returns.pick')); return; }
    if (!(await confirmDialog(t('returns.confirm', { ticket: target.ticketNumber }), { danger: true, confirmLabel: t('returns.confirm') }))) return;
    setBusy(true);
    try {
      const record = await createReturn(target, lines, reason);
      await logAction('refund', 'pos', `${target.ticketNumber} · ${f.money(record.total)} · ${record.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}`);
      toast.success(`↩️ ${t('returns.done', { ticket: target.ticketNumber, total: f.money(record.total) })}`);
      setTarget(null);
    } catch (e) {
      toast.error((e as Error).message === 'returns.max' ? t('returns.max') : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const total = Object.entries(qty).reduce((a, [productId, quantity]) => {
    const line = target?.items.find((i) => i.productId === Number(productId));
    return a + (line ? line.price * quantity : 0);
  }, 0);

  const openSale = (sale: Sale) => { setTarget(sale); setAvailable({}); setQty({}); setReason(''); };
  const backToList = () => { setTarget(null); setAvailable({}); setQty({}); setReason(''); };

  return (
    <Modal open={open} onClose={() => { backToList(); onClose(); }} size="lg"
      title={target ? `↩️ ${t('returns.title')} · ${target.ticketNumber}` : `🕐 ${t('returns.title')}`}
      subtitle={t('returns.subtitle')}
      footer={target ? (
        <>
          <Button variant="secondary" icon={<ArrowLeft />} onClick={backToList}>{t('returns.back')}</Button>
          <Button variant="danger" icon={<Undo2 />} loading={busy} onClick={submit}>{t('returns.confirmShort')}</Button>
        </>
      ) : <Button variant="secondary" onClick={onClose}>{t('common.close')}</Button>}>

      {!target ? (
        <div className="space-y-3">
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('returns.searchPlaceholder')} />
          {list.length === 0 ? (
            <EmptyState icon="🕐" title={t('common.noResults')} />
          ) : (
            <div className="max-h-[55vh] space-y-2 overflow-y-auto pe-1">
              {list.map((s) => (
                <button key={s.id} type="button" onClick={() => openSale(s)}
                  className="flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-sl-border bg-sl-card px-3 py-2.5 text-start hover:border-primary/50 hover:bg-sl-hover">
                  <span>
                    <span className="font-bold text-sl-text">{s.ticketNumber}</span>
                    <span className="ms-2 text-xs text-sl-muted">{f.dateTime(s.date)}</span>
                    <span className="block text-xs text-sl-muted">{s.customerName ?? t('pos.walkIn')} · {t('pos.units', { count: s.items.length })}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <Badge color="indigo">{t(`payment.${s.paymentMethod}`)}</Badge>
                    <b className="text-sl-text">{f.money(s.total)}</b>
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          <div className="rounded-lg bg-sl-hover px-3 py-2 text-sm text-sl-muted">
            {f.dateTime(target.date)} · {target.customerName ?? t('pos.walkIn')} · <b className="text-sl-text">{f.money(target.total)}</b>
          </div>
          {target.items.map((i) => {
            const max = available[i.productId] ?? 0;
            const value = qty[i.productId] ?? 0;
            return (
              <div key={i.productId} className="flex items-center justify-between gap-3 rounded-xl border border-sl-border px-3 py-2">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold text-sl-text">{i.quantity}× {i.name}</div>
                  <div className="text-xs text-sl-muted">{f.money(i.price)} · {max > 0 ? t('returns.maxAvailable', { count: max }) : t('returns.fullyReturned')}</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button size="sm" variant="ghost" onClick={() => setLine(i.productId, max, value - 1)}>−</Button>
                  <input type="number" min={0} max={max} value={value} disabled={max <= 0}
                    onChange={(e) => setLine(i.productId, max, Number(e.target.value))}
                    className="w-16 rounded-lg border border-sl-border bg-sl-input px-2 py-1 text-center text-sm text-sl-text outline-none focus:border-primary disabled:opacity-40" />
                  <Button size="sm" variant="ghost" onClick={() => setLine(i.productId, max, value + 1)}>+</Button>
                </div>
              </div>
            );
          })}
          <TextArea label={t('returns.reason')} rows={2} value={reason} onChange={(e) => setReason(e.target.value)} />
          <div className="flex items-center justify-between rounded-xl border border-primary/30 bg-primary/5 px-3 py-2 text-sm">
            <span className="font-semibold text-sl-text">{t('returns.total')}</span>
            <b className="text-primary">{f.money(total)}</b>
          </div>
        </div>
      )}
    </Modal>
  );
}
