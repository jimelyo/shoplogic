import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { smtpSend } from './server/smtp.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), 'dist');
const PORT = Number(process.env.PORT || 8080);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8' };
let ready = false;

const MAX_BODY = 64 * 1024;
const digits = (v) => String(v ?? '').replace(/[^\d]/g, '');
const clean = (v, max) => String(v ?? '').slice(0, max);

function readJson(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('payload:tooLarge')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')); }
      catch { reject(new Error('payload:invalid')); }
    });
    req.on('error', reject);
  });
}

/**
 * Delivery relay. The browser cannot talk to WhatsApp/SMTP directly (CORS and
 * credentials), so the client POSTs the rendered message here and the server
 * performs the real send. Requests are same-origin only: JSON bodies from other
 * origins trigger a CORS preflight that is never accepted.
 */
async function relaySend(payload) {
  if (payload?.channel === 'whatsapp') {
    const to = digits(payload.to);
    const phoneNumberId = clean(payload.phoneNumberId, 64);
    const token = clean(payload.token, 512);
    const text = clean(payload.text, 4096);
    if (!to || !phoneNumberId || !token || !text) throw new Error('relay:whatsappFields');
    const res = await fetch(`https://graph.facebook.com/v20.0/${encodeURIComponent(phoneNumberId)}/messages`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { preview_url: false, body: text } }),
      signal: AbortSignal.timeout(20_000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(`relay:whatsapp:${data?.error?.message || res.status}`);
    return { provider: 'whatsapp', id: data?.messages?.[0]?.id };
  }

  if (payload?.channel === 'email') {
    return smtpSend({
      host: clean(payload.host, 120),
      port: Number(payload.port) || 587,
      secure: !!payload.secure,
      user: clean(payload.user, 200),
      password: clean(payload.password, 300),
      from: clean(payload.from, 200),
      fromName: clean(payload.fromName, 120),
      to: clean(payload.to, 200),
      subject: clean(payload.subject, 300),
      body: clean(payload.body, 20_000),
    });
  }

  throw new Error('relay:channel');
}

const json = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');

  if (url.pathname === '/readyz') { res.writeHead(ready ? 204 : 503); return res.end(); }

  if (url.pathname === '/api/send') {
    if (req.method !== 'POST') return json(res, 405, { ok: false, error: 'relay:method' });
    try {
      const payload = await readJson(req);
      const result = await relaySend(payload);
      return json(res, 200, { ok: true, ...result });
    } catch (e) {
      const message = String(e?.message || e);
      return json(res, /payload:invalid|payload:tooLarge/.test(message) ? 400 : 502, { ok: false, error: message });
    }
  }

  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 405, { ok: false, error: 'method' });

  let p = path.normalize(decodeURIComponent(url.pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(ROOT, p);
  if (!file.startsWith(ROOT) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(ROOT, 'index.html');
  const ext = path.extname(file);
  const hashed = url.pathname.startsWith('/assets/');
  res.writeHead(200, { 'Content-Type': TYPES[ext] || 'application/octet-stream', 'Cache-Control': hashed ? 'public, max-age=31536000, immutable' : 'no-store' });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, '0.0.0.0', () => {
  ready = fs.existsSync(path.join(ROOT, 'index.html'));
  console.log('ShopLogic Pro on', PORT, 'ready', ready, '· relay /api/send enabled');
});
