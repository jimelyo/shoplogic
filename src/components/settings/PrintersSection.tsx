import { useTranslation } from 'react-i18next';
import type { NormalPrinterConfig, PrinterConfig as TicketPrinterConfig, PrinterConnection, Settings as TSettings } from '../../types';
import { DEFAULT_SETTINGS } from '../../db/database';
import { Card, SectionTitle } from '../shared/UI';
import { Input, Select, Toggle } from '../shared/Forms';

const CONNECTIONS: PrinterConnection[] = ['usb', 'network', 'bluetooth', 'system'];

export function PrintersSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const tp = form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!;
  const np = form.normalPrinter ?? DEFAULT_SETTINGS.normalPrinter!;
  const upTp = (patch: Partial<TicketPrinterConfig>) => up({ ticketPrinter: { ...(form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!), ...patch } });
  const upNp = (patch: Partial<NormalPrinterConfig>) => up({ normalPrinter: { ...(form.normalPrinter ?? DEFAULT_SETTINGS.normalPrinter!), ...patch } });
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle right={<Toggle checked={tp.enabled} onChange={(v) => upTp({ enabled: v })} />}>🧾 {t('settings.ticketPrinter')}</SectionTitle>
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${tp.enabled ? '' : 'pointer-events-none opacity-50'}`}>
          <Input label={t('common.name')} value={tp.name} onChange={(e) => upTp({ name: e.target.value })} />
          <Select label={t('settings.connection')} value={tp.connection} onChange={(e) => upTp({ connection: e.target.value as PrinterConnection })}>
            {CONNECTIONS.map((c) => <option key={c} value={c}>{t(`settings.conn_${c}`)}</option>)}
          </Select>
          <Select label={t('settings.width')} value={tp.width} onChange={(e) => upTp({ width: e.target.value as '80mm' | '58mm' })}>
            <option value="80mm">80 mm</option><option value="58mm">58 mm</option>
          </Select>
          <Input label={t('settings.header')} value={tp.header ?? ''} onChange={(e) => upTp({ header: e.target.value })} />
          <Toggle checked={tp.showLogo !== false} onChange={(v) => upTp({ showLogo: v })} label={t('settings.showLogo')} />
        </div>
      </Card>
      <Card className="p-5">
        <SectionTitle right={<Toggle checked={np.enabled} onChange={(v) => upNp({ enabled: v })} />}>🖨️ {t('settings.normalPrinter')}</SectionTitle>
        <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${np.enabled ? '' : 'pointer-events-none opacity-50'}`}>
          <Input label={t('common.name')} value={np.name} onChange={(e) => upNp({ name: e.target.value })} />
          <Select label={t('settings.connection')} value={np.connection} onChange={(e) => upNp({ connection: e.target.value as PrinterConnection })}>
            {CONNECTIONS.map((c) => <option key={c} value={c}>{t(`settings.conn_${c}`)}</option>)}
          </Select>
          <Select label={t('settings.paper')} value={np.paper} onChange={(e) => upNp({ paper: e.target.value as 'A4' | 'Letter' })}>
            <option value="A4">A4</option><option value="Letter">{t('settings.letter')}</option>
          </Select>
          <Input label={t('settings.copies')} type="number" min="1" max="5" value={np.copies} onChange={(e) => upNp({ copies: Math.min(5, Math.max(1, Number(e.target.value) || 1)) })} />
          <Input label={t('settings.watermark')} value={np.watermark ?? ''} onChange={(e) => upNp({ watermark: e.target.value })} hint={t('common.optional')} />
          <Toggle checked={np.color} onChange={(v) => upNp({ color: v })} label={t('settings.color')} />
        </div>
      </Card>
    </div>
  );
}
