import type { Channels, MailProvider, WhatsAppMode } from '../types';

export const WHATSAPP_MODES: WhatsAppMode[] = ['link', 'cloud'];
export const MAIL_PROVIDERS: MailProvider[] = ['gmail', 'outlook', 'smtp'];

/** Server presets applied when picking a provider (generic SMTP starts blank). */
export const MAIL_PRESETS: Record<MailProvider, { host: string; port: number; secure: boolean }> = {
  gmail: { host: 'smtp.gmail.com', port: 587, secure: false },
  outlook: { host: 'smtp.office365.com', port: 587, secure: false },
  smtp: { host: '', port: 587, secure: true },
};

/** Placeholders available in both channel templates. */
export const TEMPLATE_PLACEHOLDERS = ['{tienda}', '{cliente}', '{referencia}', '{detalle}'];

export const DEFAULT_CHANNELS: Channels = {
  whatsapp: {
    enabled: false,
    mode: 'link',
    phone: '',
    phoneNumberId: '',
    token: '',
    template: 'Hola {cliente}, te escribimos de {tienda} sobre {referencia}: {detalle}',
  },
  email: {
    enabled: false,
    provider: 'gmail',
    fromName: '',
    fromAddress: '',
    host: MAIL_PRESETS.gmail.host,
    port: MAIL_PRESETS.gmail.port,
    secure: MAIL_PRESETS.gmail.secure,
    user: '',
    password: '',
    subject: '{tienda} · {referencia}',
    template: 'Hola {cliente},\n\nTe escribimos de {tienda} sobre {referencia}.\n\n{detalle}\n\nGracias por tu confianza.',
  },
};
