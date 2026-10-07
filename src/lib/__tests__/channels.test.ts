import { describe, expect, it } from 'vitest';
import {
  MAILTO_MAX_LENGTH, channelIssues, channelReady, channelSendLink, channelStatusOf, mailtoLink,
  phoneDigits, previewParams, renderTemplate, waLink, whatsappIssues, emailIssues,
} from '../channels';
import { DEFAULT_CHANNELS } from '../../data/channels';
import type { Channels, Settings } from '../../types';

const readyChannels = (): Channels => ({
  whatsapp: { ...DEFAULT_CHANNELS.whatsapp, enabled: true, mode: 'link', phone: '34645678901' },
  email: {
    ...DEFAULT_CHANNELS.email, enabled: true, fromName: 'Tienda', fromAddress: 'tienda@shoplogic.com',
    host: 'smtp.gmail.com', port: 587, secure: false, user: 'tienda@shoplogic.com', password: 'app-password',
  },
});

describe('renderTemplate', () => {
  it('replaces known placeholders', () => {
    expect(renderTemplate('Hola {cliente} de {tienda}', { cliente: 'Ana', tienda: 'Shop' })).toBe('Hola Ana de Shop');
  });
  it('leaves unknown placeholders untouched', () => {
    expect(renderTemplate('{cliente} · {otra}', { cliente: 'Ana' })).toBe('Ana · {otra}');
  });
});

describe('phoneDigits', () => {
  it('keeps only digits for wa.me', () => {
    expect(phoneDigits('+34 612-345 678')).toBe('34612345678');
    expect(phoneDigits('')).toBe('');
  });
});

describe('waLink', () => {
  it('builds an international link without the plus sign', () => {
    expect(waLink({ ...DEFAULT_CHANNELS.whatsapp, phone: '+34 612 345 678' }, 'hola'))
      .toBe('https://wa.me/34612345678?text=hola');
  });
});

describe('mailtoLink', () => {
  const mail = { ...DEFAULT_CHANNELS.email, fromAddress: 'a@b.c', host: 'h', user: 'u', password: 'p' };

  it('carries recipient, subject and body', () => {
    const url = new URL(mailtoLink(mail, 'Cuerpo', 'ana@x.com', 'Asunto'));
    expect(url.pathname).toBe('ana@x.com');
    expect(url.searchParams.get('subject')).toBe('Asunto');
    expect(url.searchParams.get('body')).toBe('Cuerpo');
  });

  it('omits an empty recipient so the user can pick one', () => {
    expect(mailtoLink(mail, 'Cuerpo')).toBe(`mailto:?body=${encodeURIComponent('Cuerpo')}`);
  });

  it('truncates bodies that mail clients would drop', () => {
    expect(MAILTO_MAX_LENGTH).toBe(1800);
    const url = new URL(mailtoLink(mail, 'x'.repeat(5000), 'ana@x.com'));
    expect(url.searchParams.get('body')).toHaveLength(MAILTO_MAX_LENGTH);
  });
});

describe('channel validation', () => {
  it('flags a missing phone number', () => {
    expect(whatsappIssues({ ...DEFAULT_CHANNELS.whatsapp, phone: '' })).toEqual(['channels.phone']);
  });

  it('demands Cloud API credentials only in cloud mode', () => {
    expect(whatsappIssues({ ...DEFAULT_CHANNELS.whatsapp, phone: '34645678901', mode: 'link' })).toEqual([]);
    expect(whatsappIssues({ ...DEFAULT_CHANNELS.whatsapp, phone: '34645678901', mode: 'cloud' }))
      .toEqual(['channels.phoneNumberId', 'channels.token']);
  });

  it('validates every SMTP field', () => {
    expect(emailIssues(readyChannels().email)).toEqual([]);
    expect(emailIssues({ ...readyChannels().email, host: '' })).toEqual(['channels.host']);
    expect(emailIssues({ ...readyChannels().email, port: 0 })).toEqual(['channels.port']);
    expect(emailIssues({ ...readyChannels().email, password: '' })).toEqual(['channels.appPassword']);
    expect(emailIssues({ ...readyChannels().email, fromAddress: 'no-es-email' })).toEqual(['channels.fromAddress']);
  });
});

describe('channel status', () => {
  it('reports off / incomplete / ready', () => {
    const off: Channels = { ...readyChannels(), whatsapp: { ...DEFAULT_CHANNELS.whatsapp, enabled: false, phone: '34645678901' } };
    expect(channelStatusOf(off, 'whatsapp')).toBe('off');
    expect(channelStatusOf(readyChannels(), 'whatsapp')).toBe('ready');
    expect(channelStatusOf({ ...readyChannels(), whatsapp: { ...readyChannels().whatsapp, phone: '' } }, 'whatsapp')).toBe('incomplete');
    expect(channelIssues(readyChannels(), 'email')).toEqual([]);
  });

  it('is never ready without configured channels', () => {
    expect(channelReady(undefined, 'whatsapp')).toBe(false);
    expect(channelReady(readyChannels(), 'email')).toBe(true);
  });
});

describe('channelSendLink', () => {
  const target = { contact: '612345678', customer: 'Ana Martínez', reference: 'R-000001', detail: 'iPhone 13 · Completado' };

  it('targets the customer phone with the rendered template', () => {
    expect(channelSendLink(readyChannels(), 'ShopLogic', 'whatsapp', target)).toBe(
      `https://wa.me/612345678?text=${encodeURIComponent('Hola Ana Martínez, te escribimos de ShopLogic sobre R-000001: iPhone 13 · Completado')}`,
    );
  });

  it('targets the customer email with subject and body', () => {
    const url = new URL(channelSendLink(readyChannels(), 'ShopLogic', 'email', target));
    expect(url.pathname).toBe('612345678');
    expect(url.searchParams.get('subject')).toBe('ShopLogic · R-000001');
    expect(url.searchParams.get('body')).toContain('Hola Ana Martínez,');
    expect(url.searchParams.get('body')).toContain('iPhone 13 · Completado');
  });
});

describe('previewParams', () => {
  it('offers every placeholder used by the templates', () => {
    const p = previewParams({ storeName: 'ShopLogic Mobile Store' } as Settings);
    expect(Object.keys(p).sort()).toEqual(['cliente', 'detalle', 'referencia', 'tienda']);
  });
});
