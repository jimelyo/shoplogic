import { describe, expect, it } from 'vitest';
import { HASH_PREFIX, PBKDF2_ITERATIONS, hashPassword, isModernHash, verifyPassword } from '../hash';

const subtle = typeof globalThis.crypto?.subtle !== 'undefined';

// The environment must expose WebCrypto: jsdom does not implement `subtle`, but
// Node's crypto global is still reachable from the test runner.
describe.skipIf(!subtle)('hashPassword / verifyPassword', () => {
  it('produces a salted PBKDF2 hash in the documented format', async () => {
    const hash = await hashPassword('admin123');
    expect(hash.startsWith(`${HASH_PREFIX}${PBKDF2_ITERATIONS}$`)).toBe(true);
    expect(isModernHash(hash)).toBe(true);
    const [, iterations, salt, digest] = hash.split('$');
    expect(Number(iterations)).toBe(PBKDF2_ITERATIONS);
    expect(salt.length).toBeGreaterThan(10);
    expect(digest.length).toBeGreaterThan(20);
  });

  it('salts every hash differently', async () => {
    const [a, b] = await Promise.all([hashPassword('admin123'), hashPassword('admin123')]);
    expect(a).not.toBe(b);
  });

  it('accepts the right password and rejects the wrong one', async () => {
    const hash = await hashPassword('admin123');
    expect(await verifyPassword(hash, 'admin123')).toEqual({ ok: true, needsRehash: false });
    expect((await verifyPassword(hash, 'admin124')).ok).toBe(false);
    expect((await verifyPassword(hash, '')).ok).toBe(false);
  });

  it('accepts a legacy unsalted SHA-256 hash and flags it for rehashing', async () => {
    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode('shoplogic::admin123'));
    const legacy = Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');

    expect(await verifyPassword(legacy, 'admin123')).toEqual({ ok: true, needsRehash: true });
    expect((await verifyPassword(legacy, 'otra')).ok).toBe(false);
    expect(isModernHash(legacy)).toBe(false);
  });

  it('never authenticates against a missing or malformed hash', async () => {
    expect(await verifyPassword('', 'admin123')).toEqual({ ok: false, needsRehash: false });
    expect(await verifyPassword('pbkdf2$abc$xx', 'admin123')).toEqual({ ok: false, needsRehash: false });
    expect(await verifyPassword('no-existe', 'admin123')).toEqual({ ok: false, needsRehash: false });
  });
});

describe('hash without WebCrypto', () => {
  it('falls back to the legacy digest so login keeps working', async () => {
    const original = globalThis.crypto;
    try {
      Object.defineProperty(globalThis, 'crypto', { value: { getRandomValues: original?.getRandomValues?.bind(original) }, configurable: true });
      const stored = await hashPassword('admin123');
      const check = await verifyPassword(stored, 'admin123');
      expect(check.ok).toBe(true);
      expect(check.needsRehash).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'crypto', { value: original, configurable: true });
    }
  });
});
