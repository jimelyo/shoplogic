import type { ChannelId, Channels, ChannelStatus, EmailChannel, Settings, WhatsAppChannel } from '../types';

export type TemplateParams = Record<string, string | number>;

/** `mailto:` bodies get truncated: very long URLs are dropped by some mail clients. */
export const MAILTO_MAX_LENGTH = 1800;

/** Replaces `{placeholders}` in a template, leaving unknown ones untouched. */
export function renderTemplate(template: string, params: TemplateParams): string {
  return template.replace(/\{(\w+)\}/g, (match, key: string) => (key in params ? String(params[key]) : match));
}

/** wa.me only accepts an international number without `+`, spaces or dashes. */
export const phoneDigits = (phone: string) => phone.replace(/[^\d]/g, '');

const isEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

/** `https://wa.me/<digits>?text=<encoded>` — opens WhatsApp Web or the desktop app. */
export function waLink(channel: WhatsAppChannel, text: string): string {
  return `https://wa.me/${phoneDigits(channel.phone)}?text=${encodeURIComponent(text)}`;
}

/** `mailto:` link; the recipient is optional so the user can pick one in their mail client. */
export function mailtoLink(channel: EmailChannel, body: string, to?: string, subject?: string): string {
  const params = new URLSearchParams();
  if (subject) params.set('subject', subject);
  if (body) params.set('body', body.slice(0, MAILTO_MAX_LENGTH));
  return `mailto:${(to ?? '').trim()}?${params.toString().replace(/\+/g, '%20')}`;
}

/** i18n keys of the fields still missing before this channel can be used. */
export function whatsappIssues(channel: WhatsAppChannel): string[] {
  const out: string[] = [];
  if (phoneDigits(channel.phone).length < 9) out.push('channels.phone');
  if (channel.mode === 'cloud') {
    if (!channel.phoneNumberId.trim()) out.push('channels.phoneNumberId');
    if (!channel.token.trim()) out.push('channels.token');
  }
  return out;
}

export function emailIssues(channel: EmailChannel): string[] {
  const out: string[] = [];
  if (!isEmail(channel.fromAddress)) out.push('channels.fromAddress');
  if (!channel.host.trim()) out.push('channels.host');
  if (!(channel.port >= 1 && channel.port <= 65535)) out.push('channels.port');
  if (!channel.user.trim()) out.push('channels.user');
  if (!channel.password.trim()) out.push('channels.appPassword');
  return out;
}

export function channelIssues(channels: Channels, id: ChannelId): string[] {
  return id === 'whatsapp' ? whatsappIssues(channels.whatsapp) : emailIssues(channels.email);
}

export function channelStatusOf(channels: Channels, id: ChannelId): ChannelStatus {
  if (!channels[id].enabled) return 'off';
  return channelIssues(channels, id).length ? 'incomplete' : 'ready';
}

/** True when the channel is enabled and every required field is filled in. */
export function channelReady(channels: Channels | undefined, id: ChannelId): boolean {
  return !!channels && channelStatusOf(channels, id) === 'ready';
}

/** Live data a sender (repairs, POS receipt) puts into the channel template. */
export interface SendTarget {
  /** Recipient: a phone number for WhatsApp, an address for email. */
  contact: string;
  customer: string;
  reference: string;
  detail: string;
}

/**
 * Deep link that opens the channel pre-filled for a real recipient. WhatsApp uses
 * the customer's number (wa.me is the fallback even in Cloud API mode, since a
 * browser-only app cannot call the API); email targets the customer's address.
 */
export function channelSendLink(channels: Channels, storeName: string, id: ChannelId, target: SendTarget): string {
  const params: TemplateParams = { tienda: storeName, cliente: target.customer, referencia: target.reference, detalle: target.detail };
  if (id === 'whatsapp') return waLink({ ...channels.whatsapp, phone: target.contact }, renderTemplate(channels.whatsapp.template, params));
  return mailtoLink(channels.email, renderTemplate(channels.email.template, params), target.contact, renderTemplate(channels.email.subject, params));
}

/**
 * Sample values used by the preview and the test button. The real senders
 * (repairs, POS receipt) pass live data with the same placeholder names.
 */
export function previewParams(settings: Settings): TemplateParams {
  return {
    tienda: settings.storeName,
    cliente: 'Ana Martínez',
    referencia: 'T-000005',
    detalle: 'Xiaomi 14 Pro · 899,00 €',
  };
}
