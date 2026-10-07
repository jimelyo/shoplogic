import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/database';
import { useFormat } from '../lib/format';
import type { Customer, Invoice, Repair, Sale, SaleReturn } from '../types';
import { Badge, InfoRow } from './shared/UI';
import { Modal } from './shared/Modal';
import { loyaltyTier } from './Clients';

/**
 * 360° view of one customer: contact data next to everything the shop knows
 * about them — purchases, repairs, invoices, returns and loyalty standing.
 */
export function ClientDossier({ customer, onClose, onEdit }: { customer: Customer; onClose: () => void; onEdit: () => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  const id = customer.id;

  const sales = useLiveQuery(() => (id ? db.sales.where('customerId').equals(id).reverse().sortBy('date') : Promise.resolve([] as Sale[])), [id]);
  const repairs = useLiveQuery(() => (id ? db.repairs.where('customerId').equals(id).reverse().sortBy('dateIn') : Promise.resolve([] as Repair[])), [id]);
  const invoices = useLiveQuery(() => (id ? db.invoices.toArray() : Promise.resolve([] as Invoice[])), [id]);
  const returns = useLiveQuery(() => (id ? db.returns.toArray() : Promise.resolve([] as SaleReturn[])), [id]);

  const saleIds = new Set((sales ?? []).map((s) => s.id));
  const myInvoices = (invoices ?? []).filter((i) => (i.saleId !== undefined && saleIds.has(i.saleId)) || i.customerName === customer.name);
  const myReturns = (returns ?? []).filter((r) => r.saleId !== undefined && saleIds.has(r.saleId));
  const tier = loyaltyTier(customer.totalSpent);

  const sectionTitle = (icon: string, label: string, count: number) => (
    <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-sl-muted">
      <span>{icon}</span><span>{label}</span><Badge color="slate">{count}</Badge>
    </div>
  );

  return (
    <Modal open onClose={onClose} size="lg" title={`👤 ${customer.name}`}
      footer={<> <button type="button" onClick={onClose} className="rounded-lg border border-sl-border px-4 py-2 text-sm font-semibold text-sl-text hover:bg-sl-hover">{t('common.close')}</button>
        <button type="button" onClick={onEdit} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:opacity-90">✏️ {t('common.edit')}</button></>}>
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 text-xl font-bold text-white">
            {customer.name.charAt(0).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold text-sl-text">{customer.name}</div>
            <div className="text-xs text-sl-muted">{t('clients.since', { date: f.date(customer.createdAt) })}</div>
          </div>
          <Badge color={tier.color}>{tier.label}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg bg-sl-hover p-3 text-center"><div className="text-lg font-extrabold text-primary">{f.money(customer.totalSpent)}</div><div className="text-[11px] text-sl-muted">{t('clients.totalSpent')}</div></div>
          <div className="rounded-lg bg-sl-hover p-3 text-center"><div className="text-lg font-extrabold text-primary">{customer.visits}</div><div className="text-[11px] text-sl-muted">{t('clients.visits')}</div></div>
          <div className="rounded-lg bg-sl-hover p-3 text-center"><div className="text-lg font-extrabold text-primary">⭐ {customer.loyaltyPoints ?? 0}</div><div className="text-[11px] text-sl-muted">{t('clients.points')}</div></div>
          <div className="rounded-lg bg-sl-hover p-3 text-center"><div className="text-lg font-extrabold text-primary">{sales?.length ?? 0}</div><div className="text-[11px] text-sl-muted">{t('dossier.purchases')}</div></div>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg border border-sl-border p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">📇 {t('common.details')}</div>
            <InfoRow label={t('common.phone')} value={customer.phone} />
            <InfoRow label={t('common.email')} value={customer.email || '—'} />
            <InfoRow label={t('clients.dni')} value={customer.dni || '—'} />
            <InfoRow label={t('common.address')} value={customer.address || '—'} />
            <InfoRow label={t('clients.lastVisit')} value={sales?.length ? f.dateTime(sales[0].date) : t('dossier.never')} />
          </div>
          <div className="rounded-lg border border-sl-border p-3">
            <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">📝 {t('common.notes')}</div>
            <p className="whitespace-pre-line text-sm text-sl-text">{customer.notes || <span className="text-sl-muted">—</span>}</p>
          </div>
        </div>

        <div>
          {sectionTitle('🧾', t('dossier.sales'), sales?.length ?? 0)}
          {!sales?.length ? <p className="text-xs text-sl-muted">{t('dossier.noSales')}</p> : (
            <div className="max-h-44 space-y-1 overflow-y-auto pe-1">
              {sales.slice(0, 20).map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-sl-text">{s.ticketNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-sl-muted">{f.dateTime(s.date)}</span>
                  <span className="text-sl-muted">{t(`payment.${s.paymentMethod}`)}</span>
                  <b className="text-sl-text">{f.money(s.total)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {sectionTitle('🔧', t('dossier.repairs'), repairs?.length ?? 0)}
          {!repairs?.length ? <p className="text-xs text-sl-muted">{t('dossier.noRepairs')}</p> : (
            <div className="max-h-44 space-y-1 overflow-y-auto pe-1">
              {repairs.slice(0, 20).map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-sl-text">{r.ticketNumber}</span>
                  <span className="min-w-0 flex-1 truncate text-sl-muted">{r.device}</span>
                  <Badge color="amber">{t(`repairStatus.${r.status}`)}</Badge>
                  <b className="text-sl-text">{f.money(r.finalCost ?? r.estimatedCost)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          {sectionTitle('📄', t('dossier.invoices'), myInvoices.length)}
          {!myInvoices.length ? <p className="text-xs text-sl-muted">{t('dossier.noInvoices')}</p> : (
            <div className="max-h-36 space-y-1 overflow-y-auto pe-1">
              {myInvoices.map((i) => (
                <div key={i.id} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-sl-text">{i.number}</span>
                  <span className="text-sl-muted">{f.date(i.date)}</span>
                  <Badge color={i.status === 'paid' ? 'green' : i.status === 'overdue' ? 'red' : 'amber'}>{t(`invoiceStatus.${i.status}`)}</Badge>
                  <b className="text-sl-text">{f.money(i.total)}</b>
                </div>
              ))}
            </div>
          )}
        </div>

        {!!myReturns.length && (
          <div>
            {sectionTitle('↩️', t('dossier.returns'), myReturns.length)}
            <div className="max-h-32 space-y-1 overflow-y-auto pe-1">
              {myReturns.map((r) => (
                <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-sl-hover px-3 py-1.5 text-xs">
                  <span className="font-mono font-semibold text-sl-text">{r.ticketNumber}</span>
                  <span className="text-sl-muted">{f.date(r.date)}</span>
                  <b className="text-sl-text">−{f.money(r.total)}</b>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}
