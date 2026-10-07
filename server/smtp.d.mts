export interface SmtpSendOptions {
  host: string;
  port?: number;
  secure?: boolean;
  user?: string;
  password?: string;
  from: string;
  fromName?: string;
  to: string;
  subject?: string;
  body?: string;
}

/** Sends one email over SMTP (STARTTLS when the server offers it). */
export function smtpSend(opts: SmtpSendOptions): Promise<{ ok: true }>;
