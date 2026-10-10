import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, Download, ExternalLink, Eye, EyeOff, RotateCcw, Save, Upload } from 'lucide-react';
import { db, getSettings, TABLE_NAMES, type TableName } from '../db/database';
import { confirmDialog, toast, useStore } from '../store/store';
import { useFormat } from '../lib/format';
import { logAction } from '../lib/audit';
import { peekInvoiceNumber } from '../lib/invoices';
import { backupCounts, downloadBackup, formatBytes, importBackup, parseBackup, resetTables, tableCounts, type BackupData } from '../lib/backup';
import { exportTableCsv } from '../lib/csv';
import type { Accent, Channels, ChannelId, ChannelStatus, EmailChannel, InvoiceNumbering, InvoiceStatus, MailProvider, NormalPrinterConfig, PaymentMethod, PrinterConfig, PrinterConnection, Settings as TSettings, WhatsAppChannel, WhatsAppMode } from '../types';
import { ACCENTS, CURRENCIES, INVOICE_STATUSES, INVOICE_STATUS_ICONS, PAYMENT_METHODS } from '../types';
import { DEFAULT_CHANNELS, MAIL_PRESETS, MAIL_PROVIDERS, TEMPLATE_PLACEHOLDERS, WHATSAPP_MODES } from '../data/channels';
import { channelIssues, channelStatusOf, mailtoLink, previewParams, renderTemplate, waLink, type SendTarget } from '../lib/channels';
import { dispatchMessage, MAX_OUTBOX_ATTEMPTS, retryOutbox } from '../lib/messaging';
import { sanitize } from '../schemas';
import { PageHeader } from './shared/PageHeader';
import { Badge, Card, SectionTitle } from './shared/UI';
import { Button, fieldClass, Input, Select, TextArea, Toggle } from './shared/Forms';
import { Modal } from './shared/Modal';
import { LoadingPage } from './shared/Skeleton';
import { ACCENT_META } from './Layout';
import { DEFAULT_SETTINGS } from '../db/database';
import { ChangePassword } from './ChangePassword';
import { BrandMark } from './shared/Brand';
import { fileToLogoDataUrl } from '../lib/image';
import { INTERVAL_OPTIONS, IS_DESKTOP, onUpdate, requestUpdateCheck, updatePrefs, applyUpdate } from '../lib/update';
import type { UpdateSnapshot } from '../lib/update';

/** Live status + controls of the app self-updater (service worker based). */
function UpdateCard() {
  const { t } = useTranslation();
  const [snap, setSnap] = useState<UpdateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onUpdate(setSnap), []);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => { if (IS_DESKTOP) void window.shoplogicDesktop?.getVersion().then(setAppVersion); }, []);
  if (!snap) return null;
  const readyToInstall = snap.state === 'updateReady' || snap.state === 'downloaded';
  const check = () => { setBusy(true); requestUpdateCheck(); setTimeout(() => setBusy(false), 800); };
  return (
    <div className="rounded-xl border border-sl-border bg-sl-hover/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wide text-sl-muted">🔄 {t('settings.updTitle')}</div>
        <div className="flex gap-2">
          {readyToInstall && !snap.autoInstall && <Button size="sm" onClick={() => applyUpdate()}>{t('settings.updApply')}</Button>}
          <Button size="sm" variant="secondary" loading={busy} onClick={check}>{t('settings.updCheck')}</Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-sl-muted">
        {readyToInstall ? <b className="text-sl-text">✨ {t('settings.updReady')}</b> : t('settings.updDesc')}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-end pb-1">
          <Toggle checked={snap.autoInstall} onChange={(v) => updatePrefs.setAuto(v)} label={t('settings.updAuto')} />
        </div>
        <Select label={t('settings.updInterval')} value={String(snap.intervalSeconds)} onChange={(e) => updatePrefs.setInterval(Number(e.target.value))}>
          {INTERVAL_OPTIONS.map((o) => <option key={o.seconds} value={o.seconds}>{t(o.label)}</option>)}
        </Select>
      </div>
      <p className="mt-3 text-[11px] text-sl-muted">
        {t('settings.updHint')} · {t(`settings.updState_${snap.supported ? snap.state : 'unsupported'}`)}{appVersion ? ` · v${appVersion}` : ''}
      </p>
    </div>
  );
}

type Section = 'store' | 'locale' | 'ticket' | 'billing' | 'security' | 'channels' | 'printers' | 'appearance' | 'data';
const SECTIONS: { id: Section; icon: string }[] = [
  { id: 'store', icon: '🏪' }, { id: 'locale', icon: '🌍' }, { id: 'ticket', icon: '🧾' }, { id: 'billing', icon: '📄' },
  { id: 'security', icon: '🔐' }, { id: 'channels', icon: '📡' }, { id: 'printers', icon: '🖨️' }, { id: 'appearance', icon: '🎨' }, { id: 'data', icon: '💾' },
];
const CONNECTIONS: PrinterConnection[] = ['usb', 'network', 'bluetooth', 'system'];
const DARK_BG: Record<Accent, string> = { default: '#0f172a', green: '#064e3b', red: '#7f1d1d', blue: '#1e3a5f', purple: '#3b0764', orange: '#7c2d12' };
const LIGHT_CARD: Record<Accent, string> = { default: '#ffffff', green: '#f0fdf4', red: '#fff5f5', blue: '#f0f7ff', purple: '#faf5ff', orange: '#fffaf5' };

export function Settings() {
  const { t } = useTranslation();
  const f = useFormat();
  const stored = useLiveQuery(() => db.settings.toCollection().first(), []);
  const [section, setSection] = useState<Section>(() => (localStorage.getItem('sl_settings_section') as Section) || 'store');
  const [form, setForm] = useState<TSettings | null>(null);
  const [dirty, setDirty] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const logoRef = useRef<HTMLInputElement>(null);

  useEffect(() => { if (stored && !dirty) setForm({ ...DEFAULT_SETTINGS, ...stored }); }, [stored, dirty]);
  if (!form) return <LoadingPage />;

  const go = (s: Section) => { localStorage.setItem('sl_settings_section', s); setSection(s); };
  const up = (patch: Partial<TSettings>) => { setForm({ ...form, ...patch }); setDirty(true); };
  /** Reads the picked image, downscales it to a 256 px PNG and stages it in the form. */
  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('settings.logoInvalid')); return; }
    try { up({ logo: await fileToLogoDataUrl(file) }); }
    catch { toast.error(t('settings.logoInvalid')); }
  };
  const upTp = (patch: Partial<PrinterConfig>) => up({ ticketPrinter: { ...(form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!), ...patch } });
  const upNp = (patch: Partial<NormalPrinterConfig>) => up({ normalPrinter: { ...(form.normalPrinter ?? DEFAULT_SETTINGS.normalPrinter!), ...patch } });

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
    await db.settings.update(s.id!, clean);
    await logAction('update', 'settings', t(`settings.s_${section}`));
    setDirty(false);
    toast.success(t('common.saved'));
  };
  const tp = form.ticketPrinter ?? DEFAULT_SETTINGS.ticketPrinter!;
  const np = form.normalPrinter ?? DEFAULT_SETTINGS.normalPrinter!;

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

      {section === 'store' && (
        <Card className="p-5">
          <SectionTitle>🏪 {t('settings.s_store')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label={t('settings.storeName')} requiredMark value={form.storeName} onChange={(e) => up({ storeName: e.target.value })} />
            <Input label={t('settings.cif')} value={form.cif} onChange={(e) => up({ cif: e.target.value })} />
            <div className="md:col-span-2"><Input label={t('common.address')} value={form.address} onChange={(e) => up({ address: e.target.value })} /></div>
            <Input label={t('common.phone')} value={form.phone} onChange={(e) => up({ phone: e.target.value })} />
            <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => up({ email: e.target.value })} />
            <Input label={t('settings.appName')} value={form.appName ?? ''} onChange={(e) => up({ appName: e.target.value })} hint={t('settings.appNameHint')} />
          </div>
          <div className="mt-3 flex items-center gap-3 rounded-lg border border-sl-border p-3">
            <BrandMark logo={form.logo} className="size-16 shrink-0 rounded-xl border border-sl-border bg-sl-card" emojiClass="text-2xl" />
            <div className="min-w-0 flex-1">
              <div className="text-xs font-semibold text-sl-muted">{t('settings.logo')}</div>
              <div className="mt-1.5 flex flex-wrap gap-2">
                <Button size="sm" variant="secondary" icon={<Upload />} onClick={() => logoRef.current?.click()}>{t('settings.uploadLogo')}</Button>
                {form.logo && <Button size="sm" variant="ghost" onClick={() => up({ logo: undefined })}>{t('settings.removeLogo')}</Button>}
              </div>
              <p className="mt-1 text-[11px] text-sl-muted">{t('settings.logoHint')}</p>
            </div>
            <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
          </div>
        </Card>
      )}

      {section === 'locale' && (
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
      )}

      {section === 'ticket' && (
        <Card className="p-5">
          <SectionTitle>🧾 {t('settings.s_ticket')}</SectionTitle>
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <TextArea label={t('settings.ticketFooter')} value={form.ticketFooter ?? ''} onChange={(e) => up({ ticketFooter: e.target.value })} rows={5} />
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-3 font-mono text-[11px] text-slate-800">
              <div className="text-center font-bold">{tp.header || form.storeName}</div>
              <div className="text-center text-slate-500">{form.cif} · {form.phone}</div>
              <div className="my-1 border-t border-dashed border-slate-400" />
              <div className="flex justify-between"><span>1 x Funda</span><span>19,99</span></div>
              <div className="my-1 border-t border-dashed border-slate-400" />
              <div className="text-center text-slate-500">{form.ticketFooter}</div>
            </div>
          </div>
        </Card>
      )}

      {section === 'billing' && (
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
        </Card>
      )}

      {section === 'security' && (
        <Card className="p-5">
          <SectionTitle>🔐 {t('settings.s_security')}</SectionTitle>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Input label={t('settings.lockAfterMinutes')} type="number" min="0" step="1"
              value={form.lockAfterMinutes ?? 0}
              onChange={(e) => up({ lockAfterMinutes: Math.max(0, Math.min(480, Number(e.target.value) || 0)) })}
              hint={t('settings.lockAfterHint')} />
            <div className="flex items-end">
              <Button variant="secondary" className="w-full" onClick={() => setPwOpen(true)}>🔑 {t('auth.changePassword')}</Button>
            </div>
          </div>
          <div className="mt-4 rounded-lg bg-sl-hover p-3 text-sm text-sl-muted">🛡️ {t('settings.securityNote')}</div>
        </Card>
      )}

      {section === 'channels' && (
        <ChannelsSection channels={form.channels ?? DEFAULT_CHANNELS} store={form} onChange={(next) => up({ channels: next })} />
      )}

      {section === 'printers' && (
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
      )}

      {section === 'appearance' && <Appearance />}
      {section === 'data' && <DataSection />}
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}

function Appearance() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useStore();
  return (
    <Card className="p-5">
      <SectionTitle>🎨 {t('settings.s_appearance')}</SectionTitle>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('theme.mode')}</div>
      <div className="mb-5 grid max-w-md grid-cols-2 gap-3">
        {(['light', 'dark'] as const).map((m) => (
          <button key={m} type="button" onClick={() => { setMode(m); logAction('update', 'settings', `theme: ${m}`); }}
            className={`overflow-hidden rounded-xl border-2 text-start ${mode === m ? 'border-primary' : 'border-sl-border'}`}>
            <div className="flex h-16" style={{ background: m === 'dark' ? '#0f172a' : '#f1f5f9' }}>
              <div className="w-1/4" style={{ background: m === 'dark' ? '#0b1222' : '#fff' }} />
              <div className="m-2 flex-1 rounded" style={{ background: m === 'dark' ? '#1e293b' : '#fff' }} />
            </div>
            <div className="bg-sl-card px-3 py-2 text-sm font-semibold text-sl-text">{m === 'light' ? '☀️' : '🌙'} {t(`theme.${m}`)}</div>
          </button>
        ))}
      </div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('theme.accent')}</div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {ACCENTS.map((a) => (
          <button key={a} type="button" onClick={() => { setAccent(a); logAction('update', 'settings', `accent: ${a}`); }}
            className={`overflow-hidden rounded-xl border-2 ${accent === a ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border'}`}>
            <div className="flex h-14" style={{ background: mode === 'dark' ? DARK_BG[a] : LIGHT_CARD[a] }}>
              <div className="m-2 flex-1 rounded-md" style={{ background: ACCENT_META[a].hex, opacity: 0.9 }} />
            </div>
            <div className="bg-sl-card px-2 py-2 text-xs font-semibold text-sl-text">{ACCENT_META[a].icon} {t(`theme.accent_${a}`)}</div>
          </button>
        ))}
      </div>
      <p className="mt-4 text-xs text-sl-muted">💡 {t('settings.appearanceHint')}</p>
      <div className="mt-6 border-t border-sl-border pt-5">
        <UpdateCard />
      </div>
    </Card>
  );
}

function DataSection() {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Record<TableName, number> | null>(null);
  const [lastExport, setLastExport] = useState<{ name: string; size: number } | null>(null);
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [importName, setImportName] = useState('');
  const [resetSel, setResetSel] = useState<TableName[]>([]);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => tableCounts().then(setCounts);
  useEffect(() => { refresh(); }, []);
  const resettable = TABLE_NAMES.filter((n) => n !== 'users');

  const doExport = async () => {
    const b = await downloadBackup();
    setLastExport({ name: b.filename, size: b.size });
    await logAction('export', 'settings', `${b.filename} (${formatBytes(b.size)})`);
    toast.success(`${t('settings.exported')} · ${formatBytes(b.size)}`);
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const d = parseBackup(await file.text());
      setImportData(d); setImportName(file.name);
    } catch { toast.error(t('settings.invalidFile')); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const doImport = async () => {
    if (!importData) return;
    if (!(await confirmDialog(t('settings.importConfirm1'), { danger: true, confirmLabel: t('common.continue') }))) return;
    if (!(await confirmDialog(t('settings.importConfirm2'), { danger: true, confirmLabel: t('settings.importNow') }))) return;
    setBusy(true);
    try {
      await importBackup(importData);
      await logAction('import', 'settings', importName);
      toast.success(t('settings.imported'));
      setImportData(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const doReset = async () => {
    if (!resetSel.length) return;
    if (!(await confirmDialog(t('settings.resetConfirm', { tables: resetSel.map((n) => t(`tables.${n}`)).join(', ') }), { danger: true, confirmLabel: t('settings.resetNow') }))) return;
    setBusy(true);
    try {
      const b = await downloadBackup('_auto_pre_reset');
      toast.info(`${t('settings.autoBackup')} · ${formatBytes(b.size)}`);
      await resetTables(resetSel);
      await logAction('reset', 'settings', resetSel.join(', '));
      toast.success(t('settings.resetDone'));
      setResetSel([]);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle>📤 {t('settings.export')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.exportHint')}</p>
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">🔐 {t('settings.channelsWarn')}</p>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download />} onClick={doExport}>{t('settings.exportJson')}</Button>
          {TABLE_NAMES.map((n) => (
            <Button key={n} size="sm" variant="ghost" title={t('settings.exportCsvHint', { table: t(`tables.${n}`) })} onClick={async () => {
              const c = await exportTableCsv(n);
              await logAction('export', 'settings', `csv ${n} (${c})`);
              toast.success(`${t('settings.exportCsv')} · ${t(`tables.${n}`)} (${c})`);
            }}>{t('settings.exportCsv')} · {t(`tables.${n}`)}</Button>
          ))}
        </div>
        {lastExport && <p className="mt-2 text-xs text-sl-muted">✅ {lastExport.name} · <b>{formatBytes(lastExport.size)}</b></p>}
      </Card>
      <Card className="p-5">
        <SectionTitle>📥 {t('settings.import')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.importHint')}</p>
        <input ref={fileRef} type="file" accept="application/json,.json" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" icon={<Upload />} onClick={() => fileRef.current?.click()}>{t('settings.selectFile')}</Button>
      </Card>
      <Card className="p-5">
        <SectionTitle right={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setResetSel([...resettable])}>{t('settings.selectAll')}</Button><Button size="sm" variant="ghost" onClick={() => setResetSel([])}>{t('settings.deselectAll')}</Button></div>}>🗑️ {t('settings.reset')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.resetHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_NAMES.map((n) => {
            const locked = n === 'users';
            const on = resetSel.includes(n);
            return (
              <button key={n} type="button" disabled={locked} onClick={() => setResetSel(on ? resetSel.filter((x) => x !== n) : [...resetSel, n])}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-start text-xs font-semibold ${locked ? 'cursor-not-allowed border-sl-border opacity-50' : on ? 'border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-sl-border text-sl-text hover:border-red-500/40'}`}>
                <span>{locked ? '🔒' : on ? '☑️' : '⬜'} {t(`tables.${n}`)}</span>
                <span className="text-sl-muted">{counts?.[n] ?? '…'}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-sl-muted">🔒 {t('settings.usersProtected')}</p>
        <Button className="mt-3" variant="danger" icon={<RotateCcw />} disabled={!resetSel.length} loading={busy} onClick={doReset}>{t('settings.resetNow')} ({resetSel.length})</Button>
      </Card>
      <Card className="p-5">
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={refresh}>↻</Button>}>📊 {t('settings.currentState')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TABLE_NAMES.map((n) => (
            <div key={n} className="rounded-lg border border-sl-border bg-sl-card2 p-2.5">
              <div className="text-[10px] font-bold uppercase text-sl-muted">{t(`tables.${n}`)}</div>
              <div className="text-lg font-bold text-sl-text">{counts?.[n] ?? '…'}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-sl-muted">{t('settings.totalRecords')}: <b>{counts ? Object.values(counts).reduce((a, b) => a + b, 0) : '…'}</b> · IndexedDB (100% local)</p>
      </Card>

      <Modal open={!!importData} onClose={() => setImportData(null)} title={`📥 ${t('settings.importPreview')}`} subtitle={importName}
        footer={<><Button variant="secondary" onClick={() => setImportData(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={busy} onClick={doImport}>{t('settings.importNow')}</Button></>}>
        {importData && (
          <div className="space-y-3">
            {importData._meta && <p className="text-xs text-sl-muted">📅 {importData._meta.exportedAt}</p>}
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(backupCounts(importData)).map(([k, v]) => (
                <div key={k} className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${k === 'users' ? 'border-sl-border opacity-50' : 'border-sl-border'}`}>
                  <span>{k === 'users' ? '🔒 ' : ''}{t(`tables.${k}`)}</span><b>{v}</b>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">⚠️ {t('settings.importWarning')}</div>
          </div>
        )}
      </Modal>
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

const STATUS_ICONS: Record<ChannelStatus, string> = { off: '⏸️', incomplete: '⚠️', ready: '✅' };
const STATUS_COLORS = { off: 'slate', incomplete: 'amber', ready: 'green' } as const;

function ChannelStatusChip({ status }: { status: ChannelStatus }) {
  const { t } = useTranslation();
  return <Badge color={STATUS_COLORS[status]}>{STATUS_ICONS[status]} {t(`channels.status_${status}`)}</Badge>;
}

/** Masked field for tokens and passwords, with a reveal toggle. */
function SecretField({ label, value, onChange, hint }: { label: string; value: string; onChange: (v: string) => void; hint?: string }) {
  const { t } = useTranslation();
  const [show, setShow] = useState(false);
  return (
    <label className="block min-w-0">
      <span className="mb-1 block text-xs font-semibold text-sl-muted">{label}</span>
      <div className="relative">
        <input type={show ? 'text' : 'password'} value={value} autoComplete="new-password" onChange={(e) => onChange(e.target.value)}
          className={`${fieldClass()} pe-10`} />
        <button type="button" onClick={() => setShow(!show)} title={t('channels.reveal')} aria-label={t('channels.reveal')}
          className="absolute end-2 top-1/2 -translate-y-1/2 rounded p-1 text-sl-muted hover:text-sl-text [&_svg]:size-4">
          {show ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {hint && <span className="mt-1 block text-[11px] text-sl-muted">{hint}</span>}
    </label>
  );
}

function ChannelPreview({ text, url, issues, onTest, onCopy }: {
  text: string; url: string; issues: string[]; onTest: () => void; onCopy: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="mt-3 rounded-lg border border-sl-border bg-sl-hover/60 p-3">
      <div className="mb-1 text-xs font-bold uppercase tracking-wide text-sl-muted">{t('channels.preview')}</div>
      <p className="whitespace-pre-line text-sm text-sl-text">{text}</p>
      <div className="mt-2 break-all rounded-lg border border-sl-border bg-sl-input p-2 font-mono text-[11px] text-sl-muted">{url}</div>
      {issues.length > 0 && (
        <p className="mt-2 text-[11px] text-amber-600 dark:text-amber-400">
          ⚠️ {t('channels.missingFields')}: {issues.map((k) => t(k)).join(', ')}
        </p>
      )}
      <div className="mt-2 flex flex-wrap gap-2">
        <Button size="sm" variant="secondary" icon={<ExternalLink />} disabled={issues.length > 0} onClick={onTest}>{t('channels.test')}</Button>
        <Button size="sm" variant="ghost" icon={<Copy />} onClick={onCopy}>{t('channels.copy')}</Button>
      </div>
    </div>
  );
}

/**
 * WhatsApp + email configuration. Both channels are consumed by the `whatsapp`
 * and `email` automations. The preview renders the real deep link, and `Probar`
 * opens it: WhatsApp targets the channel's own number and email the store
 * address, so the test is a self-test.
 */
function ChannelsSection({ channels, store, onChange }: { channels: Channels; store: TSettings; onChange: (next: Channels) => void }) {
  const { t } = useTranslation();
  const wa = channels.whatsapp;
  const mail = channels.email;
  const setWa = (patch: Partial<WhatsAppChannel>) => onChange({ ...channels, whatsapp: { ...wa, ...patch } });
  const setMail = (patch: Partial<EmailChannel>) => onChange({ ...channels, email: { ...mail, ...patch } });

  const params = previewParams(store);
  const waText = renderTemplate(wa.template, params);
  const mailText = renderTemplate(mail.template, params);
  const mailSubject = renderTemplate(mail.subject, params);
  const waUrl = waLink(wa, waText);
  const mailUrl = mailtoLink(mail, mailText, store.email || mail.fromAddress, mailSubject);
  const waIssues = channelIssues(channels, 'whatsapp');
  const mailIssues = channelIssues(channels, 'email');

  const test = async (id: ChannelId, url: string, issues: string[]) => {
    if (issues.length) { toast.error(`${t('channels.missingFields')}: ${issues.map((k) => t(k)).join(', ')}`); return; }
    // Self-test: WhatsApp targets the channel's own number, email the store address.
    const target: SendTarget = {
      contact: id === 'whatsapp' ? wa.phone : (store.email || mail.fromAddress),
      customer: t('channels.testCustomer'),
      reference: 'TEST',
      detail: id === 'whatsapp' ? waText : mailText,
    };
    const outcome = await dispatchMessage(channels, store.storeName, id, target);
    if (outcome === 'relay') {
      toast.success(t('channels.testSent', { channel: t(`channels.${id}`) }));
    } else {
      if (outcome === 'failed') toast.warning(t('channels.sendQueued'));
      window.open(url, '_blank', 'noopener,noreferrer');
      if (outcome === 'link') toast.success(t('channels.testOk', { channel: t(`channels.${id}`) }));
    }
    await logAction('test', 'settings', `channel: ${id} · ${outcome}`);
  };
  const copy = async (url: string) => {
    try { await navigator.clipboard.writeText(url); toast.success(t('channels.copied')); }
    catch { toast.error(t('channels.copyFailed')); }
  };

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle>📡 {t('settings.s_channels')}</SectionTitle>
        <p className="text-sm text-sl-muted">{t('channels.subtitle')}</p>
        <p className="mt-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">🔐 {t('settings.channelsWarn')}</p>
      </Card>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <SectionTitle right={<div className="flex items-center gap-2"><ChannelStatusChip status={channelStatusOf(channels, 'whatsapp')} /><Toggle checked={wa.enabled} onChange={(v) => setWa({ enabled: v })} /></div>}>
            📱 {t('channels.whatsapp')}
          </SectionTitle>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${wa.enabled ? '' : 'pointer-events-none opacity-50'}`}>
            <Select label={t('channels.mode')} value={wa.mode} onChange={(e) => setWa({ mode: e.target.value as WhatsAppMode })}>
              {WHATSAPP_MODES.map((m) => <option key={m} value={m}>{t(`channels.mode_${m}`)}</option>)}
            </Select>
            <Input label={t('channels.phone')} value={wa.phone} onChange={(e) => setWa({ phone: e.target.value })} hint={t('channels.phoneHint')} />
            {wa.mode === 'cloud' && (
              <>
                <Input label={t('channels.phoneNumberId')} value={wa.phoneNumberId} onChange={(e) => setWa({ phoneNumberId: e.target.value })} />
                <SecretField label={t('channels.token')} value={wa.token} onChange={(v) => setWa({ token: v })} hint={t('channels.tokenHint')} />
              </>
            )}
            <div className="sm:col-span-2">
              <TextArea label={t('channels.template')} rows={3} value={wa.template} onChange={(e) => setWa({ template: e.target.value })} hint={`${t('channels.templateHint')} ${TEMPLATE_PLACEHOLDERS.join(' ')}`} />
            </div>
          </div>
          <ChannelPreview text={waText} url={waUrl} issues={waIssues} onTest={() => test('whatsapp', waUrl, waIssues)} onCopy={() => copy(waUrl)} />
        </Card>
        <Card className="p-5">
          <SectionTitle right={<div className="flex items-center gap-2"><ChannelStatusChip status={channelStatusOf(channels, 'email')} /><Toggle checked={mail.enabled} onChange={(v) => setMail({ enabled: v })} /></div>}>
            📧 {t('channels.email')}
          </SectionTitle>
          <div className={`grid grid-cols-1 gap-3 sm:grid-cols-2 ${mail.enabled ? '' : 'pointer-events-none opacity-50'}`}>
            <Select label={t('channels.provider')} value={mail.provider} onChange={(e) => { const p = e.target.value as MailProvider; setMail({ provider: p, ...MAIL_PRESETS[p] }); }}>
              {MAIL_PROVIDERS.map((p) => <option key={p} value={p}>{t(`channels.provider_${p}`)}</option>)}
            </Select>
            <Input label={t('channels.fromAddress')} type="email" value={mail.fromAddress} onChange={(e) => setMail({ fromAddress: e.target.value })} />
            <Input label={t('channels.fromName')} value={mail.fromName} onChange={(e) => setMail({ fromName: e.target.value })} />
            <Input label={t('channels.host')} value={mail.host} onChange={(e) => setMail({ host: e.target.value })} />
            <Input label={t('channels.port')} type="number" min="1" max="65535" value={mail.port} onChange={(e) => setMail({ port: Number(e.target.value) })} hint={t('channels.portHint')} />
            <div className="flex items-end pb-1"><Toggle checked={mail.secure} onChange={(v) => setMail({ secure: v })} label={t('channels.secure')} /></div>
            <Input label={t('channels.user')} value={mail.user} onChange={(e) => setMail({ user: e.target.value })} />
            <SecretField label={t('channels.appPassword')} value={mail.password} onChange={(v) => setMail({ password: v })} hint={t('channels.appPasswordHint')} />
            <div className="sm:col-span-2"><Input label={t('channels.subject')} value={mail.subject} onChange={(e) => setMail({ subject: e.target.value })} /></div>
            <div className="sm:col-span-2">
              <TextArea label={t('channels.template')} rows={3} value={mail.template} onChange={(e) => setMail({ template: e.target.value })} hint={`${t('channels.templateHint')} ${TEMPLATE_PLACEHOLDERS.join(' ')}`} />
            </div>
          </div>
          <ChannelPreview text={mailText} url={mailUrl} issues={mailIssues} onTest={() => test('email', mailUrl, mailIssues)} onCopy={() => copy(mailUrl)} />
        </Card>
      </div>
      <p className="text-center text-xs text-sl-muted">💡 {t('channels.testHint')}</p>
      <OutboxCard />
    </div>
  );
}

/** Failed / queued sends with a manual retry (the app also retries on launch). */
function OutboxCard() {
  const { t } = useTranslation();
  const entries = useLiveQuery(() => db.outbox.orderBy('createdAt').reverse().limit(10).toArray(), []);
  const [busy, setBusy] = useState<number | null>(null);
  if (!entries?.length) {
    return (
      <Card className="p-5">
        <SectionTitle>📤 {t('outbox.title')}</SectionTitle>
        <p className="text-sm text-sl-muted">{t('outbox.empty')}</p>
      </Card>
    );
  }
  const retry = async (id: number) => {
    setBusy(id);
    try {
      const ok = await retryOutbox(id);
      if (ok) toast.success(t('outbox.retryOk')); else toast.warning(t('outbox.retryFail'));
    } finally { setBusy(null); }
  };
  return (
    <Card className="p-5">
      <SectionTitle>📤 {t('outbox.title')}</SectionTitle>
      <p className="mb-3 text-xs text-sl-muted">{t('outbox.hint', { max: MAX_OUTBOX_ATTEMPTS })}</p>
      <div className="space-y-2">
        {entries.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-sl-border bg-sl-hover/60 px-3 py-2 text-xs">
            <Badge color={e.status === 'sent' ? 'green' : e.status === 'failed' ? 'red' : 'amber'}>
              {e.status === 'sent' ? '✅' : e.status === 'failed' ? '❌' : '⏳'} {t(`outbox.status_${e.status}`)}
            </Badge>
            <span className="font-semibold text-sl-text">{e.channel === 'whatsapp' ? '📱' : '📧'} {e.to}</span>
            {e.reference && <span className="text-sl-muted">{e.reference}</span>}
            <span className="min-w-0 flex-1 truncate text-sl-muted">{e.subject || e.body}</span>
            <span className="text-sl-muted">{t('outbox.attempts', { n: e.attempts })}{e.attempts < MAX_OUTBOX_ATTEMPTS ? '' : ` · ${t('outbox.maxed')}`}</span>
            {e.status !== 'sent' && e.attempts < MAX_OUTBOX_ATTEMPTS && (
              <Button size="sm" variant="secondary" loading={busy === e.id} onClick={() => { void retry(e.id!); }}>{t('outbox.retry')}</Button>
            )}
          </div>
        ))}
      </div>
    </Card>
  );
}