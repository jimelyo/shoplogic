/**
 * Password hashing.
 *
 * Current format: `pbkdf2$<iterations>$<saltB64>$<hashB64>` using PBKDF2-SHA256
 * with a per-password random salt. Older records store a plain SHA-256 of
 * `shoplogic::<password>` (or, without WebCrypto, a djb2 checksum); they are
 * still accepted by {@link verifyPassword} and silently upgraded on the first
 * successful login, so no existing user is locked out.
 */

export const PBKDF2_ITERATIONS = 210_000;
export const HASH_PREFIX = 'pbkdf2$';
const SALT_BYTES = 16;
const KEY_BITS = 256;

const te = new TextEncoder();

const toB64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));
const fromB64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

async function deriveBits(password: string, salt: Uint8Array, iterations: number): Promise<Uint8Array> {
  // WebCrypto's BufferSource is typed against ArrayBuffer only, while Uint8Array
  // is generic over ArrayBufferLike: assert once, at the boundary.
  const key = await crypto.subtle.importKey('raw', te.encode(password) as BufferSource, 'PBKDF2', false, ['deriveBits']);
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations }, key, KEY_BITS,
  );
  return new Uint8Array(bits);
}

/** Legacy schemes, kept only to verify (and upgrade) previously stored hashes. */
async function legacyHash(pw: string): Promise<string> {
  const input = 'shoplogic::' + pw;
  if (globalThis.crypto?.subtle) {
    const buf = await crypto.subtle.digest('SHA-256', te.encode(input));
    return toHex(new Uint8Array(buf));
  }
  let h = 5381;
  for (const c of input) h = ((h << 5) + h + c.charCodeAt(0)) | 0;
  return 'djb2_' + (h >>> 0).toString(16);
}

/** Constant-time comparison: same length, no early exit on the first difference. */
function equals(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

/** Hashes a password with a fresh random salt. */
export async function hashPassword(pw: string): Promise<string> {
  if (!globalThis.crypto?.subtle) return legacyHash(pw);
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const hash = await deriveBits(pw, salt, PBKDF2_ITERATIONS);
  return `${HASH_PREFIX}${PBKDF2_ITERATIONS}$${toB64(salt)}$${toB64(hash)}`;
}

export interface VerifyResult {
  ok: boolean;
  /** True when the password was correct but the stored hash uses an outdated scheme. */
  needsRehash: boolean;
}

/** Verifies a password against whatever format the stored hash uses. */
export async function verifyPassword(stored: string, pw: string): Promise<VerifyResult> {
  if (!stored) return { ok: false, needsRehash: false };

  if (stored.startsWith(HASH_PREFIX)) {
    const [, iter, saltB64, hashB64] = stored.split('$');
    const iterations = Number(iter);
    if (!Number.isFinite(iterations) || !saltB64 || !hashB64) return { ok: false, needsRehash: false };
    if (!globalThis.crypto?.subtle) return { ok: false, needsRehash: false };
    try {
      const salt = fromB64(saltB64);
      const expected = fromB64(hashB64);
      const actual = await deriveBits(pw, salt, iterations);
      const ok = equals(actual, expected);
      return { ok, needsRehash: ok && iterations !== PBKDF2_ITERATIONS };
    } catch {
      return { ok: false, needsRehash: false };
    }
  }

  if (!globalThis.crypto?.subtle) {
    const ok = stored === (await legacyHash(pw));
    return { ok, needsRehash: false };
  }
  const ok = stored === (await legacyHash(pw));
  return { ok, needsRehash: ok };
}

/** True when a stored hash already uses the current algorithm. */
export const isModernHash = (stored: string) => stored.startsWith(HASH_PREFIX);
