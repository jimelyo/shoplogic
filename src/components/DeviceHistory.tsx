import { useTranslation } from 'react-i18next';
import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { addDays } from 'date-fns';
import { db } from '../db/database';
import { useFormat, toDate } from '../lib/format';
import { STOCK_MOVE_ICONS } from '../types';
import { Badge, Card, EmptyState, SectionTitle } from './shared/UI';
import { Modal } from './shared/Modal';
import { LoadingPage } from './shared/Skeleton';

/**
 * Everything the shop knows about one device: which unit it is, when it was sold,
 * whether it is still under warranty and its full repair / refund / stock trail.
 * Opened from Inventory and from a repair, so a customer at the counter can be
 * answered from a single screen.
 */
export function DeviceHistory({ imei, onClose }: { imei: string; onClose: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const settings = f.settings;
  const product = useLiveQuery(() => db.products.where('imei').equals(imei).first(), [imei]);
  const repairs = useLiveQuery(() => db.repairs.where('imei').equals(imei).toArray(), [imei]);
  const sales = useLiveQuery(async () => {
    const p = await db.products.where('imei').equals(imei).first();
    if (!p) return [];
    const all = await db.sales.toArray();
    return all
      .filter((s) => s.items.some((i) => i.productId === p.id))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [imei]);
  const returns = useLiveQuery(async () => {
    const p = await db.products.where('imei').equals(imei).first();
    if (!p) return [];
    const all = await db.returns.toArray();
    return all.filter((r) => r.items.some((i) => i.productId === p.id)).sort((a, b) => b.date.localeCompare(a.date));
  }, [imei]);
  const moves = useLiveQuery(
    async () => { const p = await db.products.where('imei').equals(imei).first(); return p ? db.stockMoves.where('productId').equals(p.id!).sortBy('timestamp') : []; },
    [imei],
  );

  // `Date.now()` is impure during render, so the reference instant is captured once.
  const [nowTs] = useState(() => Date.now());

  if (!product && !repairs) return <LoadingPage />;

  const lastSale = sales?.[0];
  const warrantyDays = settings.warrantyDays ?? 90;
  const startsAt = toDate(lastSale?.date) ?? toDate(product?.createdAt);
  const until = startsAt ? addDays(startsAt, warrantyDays) : null;
  const daysLeft = until ? Math.ceil((until.getTime() - nowTs) / 86_400_000) : null;
  const inWarranty = daysLeft !== null && daysLeft > 0;

  return (
    <Modal open onClose={onClose} size="lg" title={`📟 ${t('device.title')}`} subtitle={imei}>
      <div className="space-y-4">
        {!product ? (
          <Card className="p-4"><EmptyState icon="🔍" title={t('device.noProduct')} hint={t('device.noProductHint')} /></Card>
        ) : (
          <Card className="p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-lg font-bold text-sl-text">{product.name}</div>
                <div className="text-xs text-sl-muted">{t('common.stock')}: {product.stock} · {t('common.price')}: {f.money(product.price)}</div>
              </div>
              <Badge color={inWarranty ? 'green' : 'red'}>
                {inWarranty ? '🛡️' : '⚠️'} {inWarranty ? t('device.warrantyOn') : t('device.warrantyOff')}
              </Badge>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
              <Fact label={t('device.purchase')} value={lastSale ? `${lastSale.ticketNumber} · ${f.date(lastSale.date)}` : t('device.none')} />
              <Fact label={t('device.warranty')} value={until ? `${f.date(until.toISOString())} (${warrantyDays} ${t('device.warrantyDays')})` : '—'} />
              <Fact label={t('device.left')} value={daysLeft !== null && daysLeft > 0 ? `${daysLeft} ${t('device.days')}` : '—'} />
            </div>
          </Card>
        )}

        <SectionTitle>🔧 {t('device.repairs')} ({repairs?.length ?? 0})</SectionTitle>
        {!repairs?.length ? (
          <p className="text-sm text-sl-muted">{t('device.none')}</p>
        ) : (
          <div className="space-y-2">
            {repairs.map((r) => (
              <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-2 text-sm">
                <span className="font-semibold text-sl-text">{r.ticketNumber} · {r.device}</span>
                <span className="text-sl-muted">{f.date(r.dateIn)} · {t(`repairStatus.${r.status}`)}</span>
              </div>
            ))}
          </div>
        )}

        <SectionTitle>🛒 {t('device.sales')} ({sales?.length ?? 0})</SectionTitle>
        {!sales?.length ? (
          <p className="text-sm text-sl-muted">{t('device.none')}</p>
        ) : (
          <div className="space-y-2">
            {sales.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-2 text-sm">
                <span className="font-semibold text-sl-text">{s.ticketNumber}</span>
                <span className="text-sl-muted">{f.dateTime(s.date)} · {t(`payment.${s.paymentMethod}`)}</span>
                <b className="text-sl-text">{f.money(s.total)}</b>
              </div>
            ))}
          </div>
        )}

        {returns && returns.length > 0 && (
          <>
            <SectionTitle>↩️ {t('device.returns')} ({returns.length})</SectionTitle>
            <div className="space-y-2">
              {returns.map((r) => (
                <div key={r.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-2 text-sm">
                  <span className="font-semibold text-sl-text">{r.ticketNumber}</span>
                  <span className="text-sl-muted">{f.dateTime(r.date)}{r.reason ? ` · ${r.reason}` : ''}</span>
                  <b className="text-red-500">−{f.money(r.total)}</b>
                </div>
              ))}
            </div>
          </>
        )}

        <SectionTitle>📜 {t('device.stock')} ({moves?.length ?? 0})</SectionTitle>
        {!moves?.length ? (
          <p className="text-sm text-sl-muted">{t('device.none')}</p>
        ) : (
          <div className="space-y-1">
            {[...moves].reverse().map((m) => (
              <div key={m.id} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-1.5 text-xs">
                <span className="text-sl-muted">{f.dateTime(m.timestamp)} · {m.reference ?? '—'}</span>
                <span className="text-sl-text">{STOCK_MOVE_ICONS[m.type]} {t(`stockType.${m.type}`)}</span>
                <b className={m.qty < 0 ? 'text-red-500' : 'text-green-600'}>{m.qty > 0 ? `+${m.qty}` : m.qty}</b>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-sl-border bg-sl-card2 px-3 py-2">
      <div className="text-[10px] font-bold uppercase tracking-wide text-sl-muted">{label}</div>
      <div className="text-sm font-semibold text-sl-text">{value}</div>
    </div>
  );
}
