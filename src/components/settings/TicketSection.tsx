import { useTranslation } from 'react-i18next';
import { Printer } from 'lucide-react';
import type { Settings as TSettings, TicketFont } from '../../types';
import { DEFAULT_SETTINGS } from '../../db/database';
import { printHtml, testTicketHtml } from '../../lib/print';
import { Card, SectionTitle } from '../shared/UI';
import { Button, Select, TextArea, Toggle } from '../shared/Forms';

const TICKET_FONTS: TicketFont[] = ['courier', 'arial', 'times'];
/** Bigger sizes help the text read well on thermal ribbon-less heads. */
const TICKET_SIZES: number[] = [9, 10, 11, 12, 13, 14, 16, 18];
const TICKET_FONT_CSS: Record<TicketFont, string> = {
  courier: "'Courier New', Courier, ui-monospace, monospace",
  arial: 'Arial, Helvetica, sans-serif',
  times: "'Times New Roman', Times, serif",
};

export function TicketSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const tp = form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!;
  const upTp = (patch: Partial<typeof tp>) => up({ ticketPrinter: { ...tp, ...patch } });
  return (
    <Card className="p-5">
      <SectionTitle>🧾 {t('settings.s_ticket')}</SectionTitle>
      <div className="grid gap-4 md:grid-cols-[1fr_300px]">
        <div>
          <TextArea label={t('settings.ticketFooter')} value={form.ticketFooter ?? ''} onChange={(e) => up({ ticketFooter: e.target.value })} rows={3} />
          <div className="mt-4 mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('settings.ticketTypeface')}</div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Select label={t('settings.ticketFont')} value={tp.font ?? 'courier'} onChange={(e) => upTp({ font: e.target.value as TicketFont })}>
              {TICKET_FONTS.map((fr) => <option key={fr} value={fr}>{t(`settings.font_${fr}`)}</option>)}
            </Select>
            <Select label={t('settings.ticketFontSize')} value={String(tp.fontSize ?? 12)} onChange={(e) => upTp({ fontSize: Number(e.target.value) })}>
              {TICKET_SIZES.map((px) => <option key={px} value={px}>{px} px</option>)}
            </Select>
            <div className="flex items-end">
              <Toggle checked={tp.bold ?? false} onChange={(v) => upTp({ bold: v })} label={t('settings.ticketBold')} />
            </div>
          </div>
          <p className="mt-2 text-[11px] text-sl-muted">💡 {t('settings.ticketFontHint')}</p>
          <div className="mt-4">
            <Button variant="secondary" icon={<Printer />} onClick={() => printHtml(testTicketHtml(form, t), t('settings.printTestTicket'))}>{t('settings.printTestTicket')}</Button>
          </div>
        </div>
        <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 text-slate-800" style={{ fontFamily: TICKET_FONT_CSS[tp.font ?? 'courier'], fontSize: `${tp.fontSize ?? 12}px`, fontWeight: tp.bold ? 900 : 400 }}>
          <div className="text-center font-bold">{(!tp.header || tp.header === 'ShopLogic Mobile Store') ? form.storeName : tp.header}</div>
          <div className="text-center text-slate-500" style={{ fontSize: `${Math.round((tp.fontSize ?? 12) * 0.92)}px` }}>{form.cif} · {form.phone}</div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="flex justify-between"><span>1 x Funda</span><span>19,99</span></div>
          <div className="my-1 border-t border-dashed border-slate-400" />
          <div className="text-center text-slate-500" style={{ fontSize: `${Math.round((tp.fontSize ?? 12) * 0.92)}px` }}>{form.ticketFooter}</div>
        </div>
      </div>
    </Card>
  );
}
