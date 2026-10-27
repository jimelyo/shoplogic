import { useTranslation } from 'react-i18next';
import type { Settings as TSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../db/database';
import { Card, SectionTitle } from '../shared/UI';
import { TextArea } from '../shared/Forms';

export function TicketSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const tp = form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!;
  return (
    <Card className="p-5">
      <SectionTitle>🧾 {t('settings.s_ticket')}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-[1fr_280px]">
        <TextArea label={t('settings.ticketFooter')} value={form.ticketFooter ?? ''} onChange={(e) => up({ ticketFooter: e.target.value })} rows={5} />
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 font-mono text-[11px] text-slate-800">
          <div className="text-center font-bold">{(!tp.header || tp.header === 'ShopLogic Mobile Store') ? form.storeName : tp.header}</div>
          <div className="text-center text-slate-500">{form.cif} · {form.phone}</div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="flex justify-between"><span>1 x Funda</span><span>19,99</span></div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="text-center text-slate-500">{form.ticketFooter}</div>
        </div>
      </div>
    </Card>
  );
}
