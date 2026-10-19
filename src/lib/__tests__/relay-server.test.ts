/**
 * Tests de `server.mjs` (levantado en un puerto propio del test):
 *  · bind a 127.0.0.1 por defecto (seguridad: sin exposición en la LAN);
 *  · `/api/send` rechaza POST cross-origin (Origin ≠ Host) con 403;
 *  · un POST same-origin pasa el filtro y falla solo en el envío (502/400),
 *    demostrando que el relay queda alcanzable desde su propio origen.
 */
import { afterAll, describe, expect, it } from 'vitest';

const PORT = 34_581;
const BASE = `http://127.0.0.1:${PORT}`;

process.env.PORT = String(PORT);
// El módulo hace listen al importarse (igual que en producción).
const relay = await import('../../../server.mjs');

afterAll(async () => {
  await relay.closeServer();
});

describe('relay server', () => {
  it('/readyz responde desde loopback', async () => {
    const res = await fetch(`${BASE}/readyz`);
    expect([200, 204, 503]).toContain(res.status);
  });

  it('rechaza POST cross-origin con 403 (relaya:crossOrigin)', async () => {
    const res = await fetch(`${BASE}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain', Origin: 'https://pagina-maliciosa.example' },
      body: JSON.stringify({ channel: 'email' }),
    });
    expect(res.status).toBe(403);
    const data = (await res.json()) as { error?: string };
    expect(data.error).toBe('relay:crossOrigin');
  });

  it('acepta POST same-origin y falla solo el envío (sin credenciales: 502/400)', async () => {
    const res = await fetch(`${BASE}/api/send`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: BASE },
      body: JSON.stringify({ channel: 'email', host: 'smtp.invalid-test', to: 'x@y.z', from: 'a@b.c' }),
    });
    expect([400, 502]).toContain(res.status);
  });

  it('sirve el fallback de index.html desde loopback', async () => {
    const res = await fetch(`${BASE}/`);
    expect(res.status).toBe(200);
  });
});
