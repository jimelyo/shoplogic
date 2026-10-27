import { useTranslation } from 'react-i18next';
import { db, getSettings } from '../../db/database';
import type { InvoiceNumbering, InvoiceStatus, PaymentMethod, Settings as TSettings } from '../../types';
import { INVOICE_STATUSES, INVOICE_STATUS_ICONS, PAYMENT_METHODS } from '../../types';
import { peekInvoiceNumber } from '../../lib/invoices';
import { logAction } from '../../lib/audit';
import { downloadFile } from '../../lib/backup';
import { verifyChain, verifactuCsv } from '../../verifactu/audit';
import { DEFAULT_FISCAL_CONFIG } from '../../verifactu/service';
import { FiscalStatus, FiscalConfigFields } from '../shared/FiscalStatus';
import { VerifactuIncidents } from '../shared/VerifactuIncidents';
import { toast } from '../../store/store';
import { Button, Input, Select, TextArea, Toggle } from '../shared/Forms';
import { Card, SectionTitle } from '../shared/UI';

export function BillingSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  return (
    <Card className="p-5">
      <SectionTitle right={<span className="rounded-lg bg-primary/10 px-2 py-1 font-mono text-xs font-bold text-primary">{t('settings.nextInvoice')}: {peekInvoiceNumber(form)}</span>}>📄 {t('settings.s_billing')}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <Select label={t('settings.numbering')} value={form.invoiceNumbering} onChange={(e) => up({ invoiceNumbering: e.target.value as InvoiceNumbering })}>
          {(['sequential', 'date', 'year', 'custom'] as InvoiceNumbering[]).map((n) => <option key={n} value={n}>{t(`settings.num_${n}`)}</option>)}
        </Select>
        <Input label={t('settings.prefix')} value={form.invoicePrefix} onChange={(e) => up({ invoicePrefix: e.target.value })} />
        {form.invoiceNumbering === 'custom' && <Input label={t('settings.customFormat')} value={form.invoiceCustomFormat ?? ''} onChange={(e) => up({ invoiceCustomFormat: e.target.value })} hint="{PREFIX} {YYYY} {YY} {MM} {NUM}" />}
        <Input label={t('settings.digits')} type="number" min="1" max="10" value={form.invoiceDigits} onChange={(e) => up({ invoiceDigits: Number(e.target.value) })} />
        <Input label={t('settings.nextNumber')} type="number" min="1" value={form.invoiceNextNumber} onChange={(e) => up({ invoiceNextNumber: Number(e.target.value) })} />
        <Input label={t('settings.dueDays')} type="number" min="0" value={form.invoiceDefaultDueDays} onChange={(e) => up({ invoiceDefaultDueDays: Number(e.target.value) })} />
        <Select label={t('settings.defaultStatus')} value={form.invoiceDefaultStatus} onChange={(e) => up({ invoiceDefaultStatus: e.target.value as InvoiceStatus })}>
          {INVOICE_STATUSES.map((st) => <option key={st} value={st}>{INVOICE_STATUS_ICONS[st]} {t(`invoiceStatus.${st}`)}</option>)}
        </Select>
        <Select label={t('settings.defaultPayment')} value={form.invoiceDefaultPaymentMethod} onChange={(e) => up({ invoiceDefaultPaymentMethod: e.target.value as PaymentMethod })}>
          {PAYMENT_METHODS.map((m) => <option key={m.id} value={m.id}>{m.icon} {t(`payment.${m.id}`)}</option>)}
        </Select>
        <div className="md:col-span-3"><TextArea label={t('settings.defaultNotes')} value={form.invoiceDefaultNotes ?? ''} onChange={(e) => up({ invoiceDefaultNotes: e.target.value })} /></div>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-3">
        <Toggle checked={form.invoiceYearReset} onChange={(v) => up({ invoiceYearReset: v })} label={t('settings.yearReset')} description={t('settings.yearResetHint')} />
        <Toggle checked={form.invoiceAutoGenerateOnDelivery} onChange={(v) => up({ invoiceAutoGenerateOnDelivery: v })} label={t('settings.autoInvoice')} description={t('settings.autoInvoiceHint')} />
        <Toggle checked={form.invoiceIncludeRepairDetail} onChange={(v) => up({ invoiceIncludeRepairDetail: v })} label={t('settings.repairDetail')} description={t('settings.repairDetailHint')} />
      </div>
      <div className="mt-5 border-t border-sl-border pt-4">
        <SectionTitle right={<Toggle checked={form.verifactu?.enabled ?? false} onChange={(v) => up({ verifactu: { ...(form.verifactu ?? {}), enabled: v } })} />}>🇪. {t('settings.verifactu')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.verifactuHint')}</p>
        <div className={`grid gap-3 md:grid-cols-2 ${(form.verifactu?.enabled ?? false) ? '' : 'pointer-events-none opacity-50'}`}>
          <FiscalConfigFields
            value={{ modality: form.verifactuConfig?.modality ?? 'verifactu', environment: form.verifactuConfig?.environment ?? 'test' }}
            onChange={(v) => up({ verifactuConfig: { modality: v.modality, environment: v.environment, system: form.verifactuConfig?.system ?? DEFAULT_FISCAL_CONFIG.system } })}
          />
          <Select label={t('settings.vfRegime')} value={form.verifactu?.regime ?? 'general'} onChange={(e) => up({ verifactu: { ...(form.verifactu ?? { enabled: true }), regime: e.target.value as 'general' | 'rebu' | 'special' } })}>
            <option value="general">general</option>
            <option value="rebu">REBU (bienes usados)</option>
            <option value="special">régimen especial</option>
          </Select>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={async () => {
              const all = await db.invoices.toArray();
              const broken = await verifyChain(all);
              if (broken) { toast.error(t('settings.vfBroken', { number: broken })); return; }
              const invs = all.filter((i) => i.verifHash);
              if (!invs.length) { toast.info(t('settings.vfEmpty')); return; }
              const s = await getSettings();
              downloadFile(verifactuCsv(invs, s), `verifactu-${new Date().toISOString().slice(0, 10)}.csv`, 'text/csv');
              await logAction('export', 'billing', `verifactu csv (${invs.length})`);
              toast.success(t('settings.vfOk', { n: invs.length }));
            }}>🧾 {t('settings.vfExport')}</Button>
            <span className="text-[11px] text-sl-muted">{t('settings.vfChainNote')}</span>
          </div>
        </div>
        {/* Estado de la cola de remisión AEAT (módulo VERI*FACTU v1.3.0). */}
        {form.verifactu?.enabled && <FiscalStatus />}
        {/* Incidencias: rechazados por la AEAT, errores de envío y reintentos. */}
        {form.verifactu?.enabled && <div className="mt-4"><VerifactuIncidents /></div>}
      </div>
    </Card>
  );
}
