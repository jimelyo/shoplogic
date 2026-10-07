/**
 * Minimal SMTP client used by the relay endpoint in `server.mjs`.
 *
 * Implemented with `node:net` / `node:tls` only, so the app keeps its
 * zero-dependency policy. It covers what the shop's providers (Gmail, Outlook,
 * generic SMTP) need: EHLO, optional STARTTLS, AUTH LOGIN, MAIL/RCPT/DATA.
 */

import net from 'node:net';
import tls from 'node:tls';

const CONNECT_TIMEOUT_MS = 15_000;
const COMMAND_TIMEOUT_MS = 20_000;

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}:timeout`)), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** Line-oriented reply reader: SMTP sends `250-...` continuations ending in `250 `. */
class SmtpSession {
  constructor(socket) {
    this.socket = socket;
    this.buffer = '';
    this.current = [];
    this.waiters = [];
    this.pending = [];
    this.error = null;
    this.bind(socket);
  }

  bind(socket) {
    this.socket = socket;
    socket.setEncoding('utf8');
    socket.on('data', (chunk) => this.onData(chunk));
    socket.on('error', (err) => this.fail(err));
    socket.on('close', () => this.fail(new Error('smtp:closed')));
  }

  /** After STARTTLS the connection is re-wrapped: move listeners to the TLS socket. */
  rebind(socket) {
    this.socket.removeAllListeners('data');
    this.socket.removeAllListeners('error');
    this.socket.removeAllListeners('close');
    this.buffer = '';
    this.current = [];
    this.bind(socket);
  }

  onData(chunk) {
    this.buffer += chunk;
    let idx = this.buffer.search(/\r?\n/);
    while (idx !== -1) {
      const line = this.buffer.slice(0, idx);
      this.buffer = this.buffer.slice(idx + (this.buffer[idx] === '\r' ? 2 : 1));
      this.onLine(line);
      idx = this.buffer.search(/\r?\n/);
    }
  }

  onLine(line) {
    if (!line) return;
    this.current.push(line);
    const final = /^(\d{3})[ ]/.exec(line);
    if (!final) return;
    const reply = { code: Number(final[1]), lines: this.current };
    this.current = [];
    const waiter = this.waiters.shift();
    if (waiter) waiter.resolve(reply);
    else this.pending.push(reply);
  }

  fail(err) {
    this.error = err;
    while (this.waiters.length) this.waiters.shift().reject(err);
  }

  read() {
    if (this.error) return Promise.reject(this.error);
    const buffered = this.pending.shift();
    if (buffered) return Promise.resolve(buffered);
    return new Promise((resolve, reject) => this.waiters.push({ resolve, reject }));
  }

  async cmd(command) {
    if (this.error) throw this.error;
    if (command !== undefined) this.socket.write(`${command}\r\n`);
    return withTimeout(this.read(), COMMAND_TIMEOUT_MS, command || 'banner');
  }
}

function connect(host, port, secure) {
  return new Promise((resolve, reject) => {
    const socket = secure
      ? tls.connect({ host, port, servername: host }, () => resolve(socket))
      : net.connect({ host, port }, () => resolve(socket));
    socket.setTimeout(CONNECT_TIMEOUT_MS, () => socket.destroy(new Error('connect:timeout')));
    socket.once('error', reject);
  }).then((socket) => {
    socket.setTimeout(0);
    return socket;
  });
}

async function upgradeToTls(session, host) {
  const plain = session.socket;
  const secure = await new Promise((resolve, reject) => {
    const s = tls.connect({ socket: plain, servername: host }, () => resolve(s));
    s.once('error', reject);
  });
  session.rebind(secure);
}

const ok = (reply, ...codes) => codes.includes(reply.code);

/**
 * Sends one email and resolves when the server accepts it (or rejects it).
 * `secure: true` connects straight over TLS (port 465); otherwise STARTTLS is
 * used when the server advertises it (port 587).
 */
export async function smtpSend(opts) {
  const host = String(opts.host || '').trim();
  const port = Number(opts.port) || 587;
  const secure = !!opts.secure;
  const user = String(opts.user || '');
  const password = String(opts.password || '');
  const from = String(opts.from || '').trim();
  const fromName = String(opts.fromName || '').trim();
  const to = String(opts.to || '').trim();
  const subject = String(opts.subject || '');
  const body = String(opts.body || '');

  if (!host) throw new Error('smtp:host');
  if (!from || !to) throw new Error('smtp:address');
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw new Error('smtp:address');

  const socket = await connect(host, port, secure);
  const session = new SmtpSession(socket);
  try {
    const banner = await session.cmd();
    if (!ok(banner, 220)) throw new Error(`smtp:banner:${banner.code}`);

    let ehlo = await session.cmd(`EHLO shoplogic.local`);
    if (!ok(ehlo, 250)) throw new Error(`smtp:ehlo:${ehlo.code}`);

    if (!secure && ehlo.lines.join(' ').toUpperCase().includes('STARTTLS')) {
      const start = await session.cmd('STARTTLS');
      if (!ok(start, 220)) throw new Error(`smtp:starttls:${start.code}`);
      await upgradeToTls(session, host);
      ehlo = await session.cmd('EHLO shoplogic.local');
      if (!ok(ehlo, 250)) throw new Error(`smtp:ehlo2:${ehlo.code}`);
    }

    if (user) {
      const auth = await session.cmd('AUTH LOGIN');
      if (!ok(auth, 334)) throw new Error(`smtp:auth:${auth.code}`);
      const userStep = await session.cmd(Buffer.from(user, 'utf8').toString('base64'));
      if (!ok(userStep, 334)) throw new Error(`smtp:authUser:${userStep.code}`);
      const passStep = await session.cmd(Buffer.from(password, 'utf8').toString('base64'));
      if (!ok(passStep, 235)) throw new Error(`smtp:authPass:${passStep.code}`);
    }

    const sender = await session.cmd(`MAIL FROM:<${from}>`);
    if (!ok(sender, 250)) throw new Error(`smtp:from:${sender.code}`);

    const recipient = await session.cmd(`RCPT TO:<${to}>`);
    if (!ok(recipient, 250, 251)) throw new Error(`smtp:rcpt:${recipient.code}`);

    const data = await session.cmd('DATA');
    if (!ok(data, 354)) throw new Error(`smtp:data:${data.code}`);

    const encodedSubject = /^[\x20-\x7E]*$/.test(subject)
      ? subject
      : `=?UTF-8?B?${Buffer.from(subject, 'utf8').toString('base64')}?=`;
    const headers = [
      `From: ${fromName ? `${fromName} <${from}>` : from}`,
      `To: <${to}>`,
      `Subject: ${encodedSubject}`,
      'MIME-Version: 1.0',
      'Content-Type: text/plain; charset=utf-8',
      'Content-Transfer-Encoding: 8bit',
      `Date: ${new Date().toUTCString()}`,
    ].join('\r\n');
    // Dot-stuffing: a lone leading dot would otherwise end the message.
    const payload = `${headers}\r\n\r\n${body.replace(/\r?\n/g, '\r\n').replace(/(^|\r?\n)\./g, '$1..')}\r\n.`;
    const queued = await session.cmd(payload);
    if (!ok(queued, 250)) throw new Error(`smtp:queue:${queued.code}`);

    await session.cmd('QUIT').catch(() => undefined);
    return { ok: true };
  } finally {
    session.socket.removeAllListeners('close');
    session.socket.destroy();
  }
}
