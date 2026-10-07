import { db } from '../db/database';
import { channelSendLink, phoneDigits, renderTemplate, type SendTarget } from './channels';
import type { ChannelId, Channels, OutboxEntry, Settings } from '../types';

/**
 * Where a message ended up: `relay` = the server sent it for real, `link` = no
 * relay is running so the caller must open the wa.me / mailto: deep link (the
 * pre-relay behaviour), `failed` = the relay answered with an error, the attempt
 * is stored in the outbox for retry and the deep link is opened as a fallback.
 */
export type SendOutcome = 'relay' | 'link' | 'failed';

const RELAY_PATH = '/api/send';
const RELAY_TIMEOUT_MS = 25_000;
export const MAX_OUTBOX_ATTEMPTS = 3;

function buildParams(storeName: string, target: SendTarget) {
  return { tienda: storeName, cliente: target.customer, referencia: target.reference, detalle: target.detail };
}

function payloadFor(channels: Channels, storeName: string, id: ChannelId, target: SendTarget) {
  const params = buildParams(storeName, target);
  if (id === 'whatsapp') {
    const text = renderTemplate(channels.whatsapp.template, params);
    return {
      text, subject: '',
      payload: {
        channel: 'whatsapp', to: phoneDigits(target.contact), text,
        phoneNumberId: channels.whatsapp.phoneNumberId, token: channels.whatsapp.token,
      } as Record<string, unknown>,
    };
  }
  const subject = renderTemplate(channels.email.subject, params);
  const body = renderTemplate(channels.email.template, params);
  return {
    text: body, subject,
    payload: {
      channel: 'email', to: target.contact, subject, body,
      host: channels.email.host, port: channels.email.port, secure: channels.email.secure,
      user: channels.email.user, password: channels.email.password,
      from: channels.email.fromAddress, fromName: channels.email.fromName,
    } as Record<string, unknown>,
  };
}

function payloadForEntry(entry: OutboxEntry, channels: Channels): Record<string, unknown> {
  if (entry.channel === 'whatsapp') {
    return {
      channel: 'whatsapp', to: phoneDigits(entry.to), text: entry.body,
      phoneNumberId: channels.whatsapp.phoneNumberId, token: channels.whatsapp.token,
    };
  }
  return {
    channel: 'email', to: entry.to, subject: entry.subject, body: entry.body,
    host: channels.email.host, port: channels.email.port, secure: channels.email.secure,
    user: channels.email.user, password: channels.email.password,
    from: channels.email.fromAddress, fromName: channels.email.fromName,
  };
}

/** `true` sent · `null` no relay running · throws when the relay reports an error. */
async function post(payload: Record<string, unknown>): Promise<boolean | null> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), RELAY_TIMEOUT_MS);
  try {
    const res = await fetch(RELAY_PATH, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const data = await res.json().catch(() => null);
    // Without the relay (static hosting) the path answers with index.html.
    if (!data || typeof data.ok !== 'boolean') return null;
    if (data.ok) return true;
    throw new Error(String(data.error || 'relay:error'));
  } catch (e) {
    if (e instanceof SyntaxError || e instanceof TypeError || (e as Error).name === 'AbortError') return null;
    throw e;
  } finally {
    window.clearTimeout(timer);
  }
}

async function enqueue(
  entry: Omit<OutboxEntry, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'>,
  status: OutboxEntry['status'], error?: string,
): Promise<void> {
  const now = new Date().toISOString();
  try {
    await db.outbox.add({ ...entry, status, attempts: 1, lastError: error, createdAt: now, updatedAt: now });
  } catch {
    /* the outbox must never break the send it is describing */
  }
}

/**
 * Sends a rendered message through the server relay when one is running.
 * `link` means the relay is absent: the caller falls back to the deep link, so
 * a static deployment behaves exactly as it did before the relay existed.
 */
export async function dispatchMessage(
  channels: Channels, storeName: string, id: ChannelId, target: SendTarget,
): Promise<SendOutcome> {
  const { payload, text, subject } = payloadFor(channels, storeName, id, target);
  const meta = { channel: id, to: target.contact, subject: subject || undefined, body: text, reference: target.reference };

  try {
    const sent = await post(payload);
    if (sent) { await enqueue(meta, 'sent'); return 'relay'; }
    return sent === null ? 'link' : 'failed';
  } catch (e) {
    await enqueue(meta, 'failed', String((e as Error).message || e));
    return 'failed';
  }
}

async function attempt(entry: OutboxEntry, channels: Channels): Promise<'sent' | 'failed' | 'absent'> {
  try {
    const sent = await post(payloadForEntry(entry, channels));
    if (sent === null) return 'absent';
    const now = new Date().toISOString();
    await db.outbox.update(entry.id!, sent
      ? { status: 'sent', attempts: entry.attempts + 1, lastError: undefined, updatedAt: now }
      : { status: 'failed', attempts: entry.attempts + 1, updatedAt: now });
    return sent ? 'sent' : 'failed';
  } catch (e) {
    await db.outbox.update(entry.id!, {
      status: 'failed', attempts: entry.attempts + 1,
      lastError: String((e as Error).message || e), updatedAt: new Date().toISOString(),
    });
    return 'failed';
  }
}

const settingsChannels = async (): Promise<Channels | undefined> => {
  const s = (await db.settings.toCollection().first()) as Settings | undefined;
  return s?.channels;
};

/** Re-sends failed messages (up to MAX_OUTBOX_ATTEMPTS) when the app starts. */
export async function flushOutbox(): Promise<number> {
  const pending = await db.outbox.where('status').anyOf('pending', 'failed').toArray();
  if (!pending.length) return 0;
  const channels = await settingsChannels();
  if (!channels) return 0;

  let sent = 0;
  for (const entry of pending) {
    if (entry.attempts >= MAX_OUTBOX_ATTEMPTS) continue;
    const result = await attempt(entry, channels);
    if (result === 'absent') break; // no relay running: try again next launch
    if (result === 'sent') sent += 1;
  }
  return sent;
}

/** Manual retry from the automations screen. */
export async function retryOutbox(id: number): Promise<boolean> {
  const entry = await db.outbox.get(id);
  if (!entry) return false;
  const channels = await settingsChannels();
  if (!channels) return false;
  return (await attempt(entry, channels)) === 'sent';
}

/** The fallback deep link, exported so every caller keeps one code path. */
export const fallbackLink = (channels: Channels, storeName: string, id: ChannelId, target: SendTarget) =>
  channelSendLink(channels, storeName, id, target);
