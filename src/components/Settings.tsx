import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Save } from 'lucide-react';
import { db, getSettings, DEFAULT_SETTINGS } from '../db/database';
import { toast } from '../store/store';
import { logAction } from '../lib/audit';
import { sanitize } from '../schemas';
import type { Channels, Settings as TSettings } from '../types';
import { DEFAULT_CHANNELS } from '../data/channels';
import { PageHeader } from './shared/PageHeader';
import { VerifactuCompanion } from './shared/VerifactuCompanion';
import { Button } from './shared/Forms';
import { LoadingPage } from './shared/Skeleton';
import { ChangePassword } from './ChangePassword';
import { StoreSection } from './settings/StoreSection';
import { LocaleSection } from './settings/LocaleSection';
import { TicketSection } from './settings/TicketSection';
import { BillingSection } from './settings/BillingSection';
import { SecuritySection } from './settings/SecuritySection';
import { PrintersSection } from './settings/PrintersSection';
import { ChannelsSection } from './settings/ChannelsSection';
import { AppearanceSection } from './settings/AppearanceSection';
import { DataSection } from './settings/DataSection';

type Section = 'store' | 'locale' | 'ticket' | 'billing' | 'security' | 'channels' | 'printers' | 'appearance' | 'data' | 'verifactu';
const SECTIONS: { id: Section; icon: string }[] = [
  { id: 'store', icon: '🏪' }, { id: 'locale', icon: '🌍' }, { id: 'ticket', icon: '🧾' }, { id: 'billing', icon: '📄' },
  { id: 'verifactu', icon: '🧙' }, { id: 'security', icon: '🔐' }, { id: 'channels', icon: '📡' }, { id: 'printers', icon: '🖨️' }, { id: 'appearance', icon: '🎨' }, { id: 'data', icon: '💾' },
];

export function Settings() {
  const { t } = useTranslation();
  const stored = useLiveQuery(() => db.settings.toCollection().first(), []);
  const [section, setSection] = useState<Section>(() => (localStorage.getItem('sl_settings_section') as Section) || 'store');
  const [form, setForm] = useState<TSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => { if (stored && !dirty) setForm({ ...DEFAULT_SETTINGS, ...stored }); }, [stored, dirty]);
  if (!form) return <LoadingPage />;

  const go = (s: Section) => { localStorage.setItem('sl_settings_section', s); setSection(s); };
  const up = (patch: Partial<TSettings>) => { setForm({ ...form, ...patch }); setDirty(true); };

  const save = async () => {
    if (!form.storeName.trim()) { toast.error(t('validation.required')); go('store'); return; }
    const clean: TSettings = {
      ...form,
      storeName: sanitize(form.storeName), cif: sanitize(form.cif), address: sanitize(form.address), phone: sanitize(form.phone), email: sanitize(form.email),
      appName: sanitize(form.appName ?? ''),
      ticketFooter: sanitize(form.ticketFooter ?? ''), invoicePrefix: sanitize(form.invoicePrefix), invoiceDefaultNotes: sanitize(form.invoiceDefaultNotes ?? ''),
      taxRate: Math.max(0, Number(form.taxRate) || 0), invoiceDigits: Math.min(10, Math.max(1, Number(form.invoiceDigits) || 4)),
      loyaltyRate: Math.max(1, Number(form.loyaltyRate) || 1),
      invoiceNextNumber: Math.max(1, Number(form.invoiceNextNumber) || 1), invoiceDefaultDueDays: Math.max(0, Number(form.invoiceDefaultDueDays) || 0),
      channels: cleanChannels(form.channels ?? DEFAULT_CHANNELS),
    };
    const s = await getSettings();
    // El ticket imprime ticketPrinter.header (no storeName). Si ese encabezado
    // seguía el nombre de la tienda (vacío, igual al anterior o el sembrado por
    // defecto), se sincroniza con el nuevo nombre para no imprimir uno caducado.
    const prevHeader = s.ticketPrinter?.header;
    const headerFollows = !prevHeader || prevHeader === s.storeName || prevHeader === 'ShopLogic Mobile Store';
    if (clean.storeName !== s.storeName && headerFollows) {
      clean.ticketPrinter = { ...(clean.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!), header: clean.storeName };
    }
    await db.settings.put(clean);
    await logAction('update', 'settings', t(`settings.s_${section}`));
    setDirty(false);
    toast.success(t('common.saved'));
  };

  return (
    <div className="space-y-4">
      <PageHeader icon="⚙️" title={t('nav.settings')} subtitle={t('settings.subtitle')}
        actions={section !== 'appearance' && section !== 'data' && <Button icon={<Save />} disabled={!dirty} onClick={save}>{t('common.save')}</Button>} />
      <div className="flex gap-2 overflow-x-auto pb-1">
        {SECTIONS.map((s) => (
          <button key={s.id} type="button" onClick={() => go(s.id)}
            className={`inline-flex shrink-0 items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${section === s.id ? 'border-primary bg-primary text-white shadow shadow-primary/30' : 'border-sl-border bg-sl-card text-sl-text hover:border-primary/40'}`}>
            <span>{s.icon}</span>{t(`settings.s_${s.id}`)}
          </button>
        ))}
      </div>
      {dirty && section !== 'appearance' && section !== 'data' && <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-700 dark:text-amber-300">⚠️ {t('settings.unsaved')}</div>}

      {section === 'store' && <StoreSection form={form} up={up} />}
      {section === 'locale' && <LocaleSection form={form} up={up} />}
      {section === 'ticket' && <TicketSection form={form} up={up} />}
      {section === 'billing' && <BillingSection form={form} up={up} />}
      {section === 'security' && <SecuritySection form={form} up={up} openPw={() => setPwOpen(true)} />}
      {section === 'channels' && <ChannelsSection channels={form.channels ?? DEFAULT_CHANNELS} store={form} onChange={(next) => up({ channels: next })} />}
      {section === 'printers' && <PrintersSection form={form} up={up} />}
      {section === 'appearance' && <AppearanceSection />}
      {section === 'data' && <DataSection form={form} up={up} />}
      {section === 'verifactu' && <VerifactuCompanion form={form} up={up} />}
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

const clip = (v: string | undefined, max: number) => (v ?? '').trim().slice(0, max);

/** Trim, cap and clamp every channel field before it is written to the database. */
function cleanChannels(c: Channels): Channels {
  return {
    whatsapp: {
      ...c.whatsapp,
      phone: clip(c.whatsapp.phone, 24),
      phoneNumberId: clip(c.whatsapp.phoneNumberId, 60),
      token: clip(c.whatsapp.token, 400),
      template: clip(c.whatsapp.template, 1000),
    },
    email: {
      ...c.email,
      fromName: sanitize(clip(c.email.fromName, 80)),
      fromAddress: clip(c.email.fromAddress, 160),
      host: clip(c.email.host, 120),
      port: Math.min(65535, Math.max(1, Number(c.email.port) || 587)),
      user: clip(c.email.user, 160),
      // Secrets are only trimmed: sanitizing them could silently break a valid password.
      password: clip(c.email.password, 200),
      subject: clip(c.email.subject, 160),
      template: clip(c.email.template, 2000),
    },
  };
}
