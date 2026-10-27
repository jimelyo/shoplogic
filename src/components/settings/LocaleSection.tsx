import { useTranslation } from 'react-i18next';
import type { Settings as TSettings } from '../../types';
import { CURRENCIES } from '../../types';
import { useFormat } from '../../lib/format';
import { Card, SectionTitle } from '../shared/UI';
import { Input, Select } from '../shared/Forms';

export function LocaleSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const f = useFormat();
  return (
    <Card className="p-5">
      <SectionTitle>🌍 {t('settings.s_locale')}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Select label={t('settings.currency')} value={form.currency} onChange={(e) => { const c = CURRENCIES.find((x) => x.code === e.target.value)!; up({ currency: c.code, currencySymbol: c.symbol }); }}>
          {CURRENCIES.map((c) => <option key={c.code} value={c.code}>{c.code} — {c.symbol} · {t(`currency.${c.code}`)}</option>)}
        </Select>
        <Input label={t('settings.taxRate')} type="number" min="0" step="0.5" value={form.taxRate} onChange={(e) => up({ taxRate: Number(e.target.value) })} hint={t('settings.taxHint')} />
        <Input label={t('settings.loyaltyRate')} type="number" min="1" step="1" value={form.loyaltyRate} onChange={(e) => up({ loyaltyRate: Math.max(1, Number(e.target.value) || 1) })} hint={t('settings.loyaltyHint')} />
        <Input label={t('settings.warrantyDays')} type="number" min="0" step="1" value={form.warrantyDays ?? 0} onChange={(e) => up({ warrantyDays: Math.max(0, Number(e.target.value) || 0) })} hint={t('settings.warrantyHint')} />
      </div>
      <div className="mt-4 rounded-lg bg-sl-hover p-3 text-sm text-sl-muted">💡 {t('settings.preview')}: <b className="text-sl-text">{f.money(1234.5)}</b> · 121 → {t('tax.base')} {(121 / (1 + (Number(form.taxRate) || 0) / 100)).toFixed(2)} + {t('tax.vat')} {(121 - 121 / (1 + (Number(form.taxRate) || 0) / 100)).toFixed(2)}</div>
    </Card>
  );
}
