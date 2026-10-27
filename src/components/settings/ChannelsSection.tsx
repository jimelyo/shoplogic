import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Copy, ExternalLink, Eye, EyeOff } from 'lucide-react';
import { db } from '../../db/database';
import type { Channels, ChannelId, ChannelStatus, EmailChannel, MailProvider, Settings as TSettings, WhatsAppChannel, WhatsAppMode } from '../../types';
import { DEFAULT_CHANNELS, MAIL_PRESETS, MAIL_PROVIDERS, TEMPLATE_PLACEHOLDERS, WHATSAPP_MODES } from '../../data/channels';
import { channelIssues, channelStatusOf, mailtoLink, previewParams, renderTemplate, waLink, type SendTarget } from '../../lib/channels';
import { dispatchMessage, MAX_OUTBOX_ATTEMPTS, retryOutbox } from '../../lib/messaging';
import { logAction } from '../../lib/audit';
import { toast } from '../../store/store';
import { Badge } from '../shared/UI';
import { Card, SectionTitle } from '../shared/UI';
import { Button, fieldClass, Input, Select, TextArea, Toggle } from '../shared/Forms';

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
export function ChannelsSection({ channels, store, onChange }: { channels: Channels; store: TSettings; onChange: (next: Channels) => void }) {
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
