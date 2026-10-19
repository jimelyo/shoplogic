/**
 * Cifrado opcional de backups con AES-256-GCM y clave derivada PBKDF2-SHA256
 * (WebCrypto, disponible en navegador y Electron).
 *
 * Formato `SLCRYPT` v1: cabecera legible + sal + nonce + resto cifrado. Si el
 * fichero está dañado o la contraseña es errónea, `decryptBackup` falla con
 * `wrongpassword`; nunca se descifra parcialmente (AES-GCM autentica el blob
 * completo antes de liberar el JSON).
 *
 * El JSON cifrado sigue siendo importable por el flujo normal de backups: el
 * usuario elige el fichero y la app pide la contraseña si detecta la cabecera.
 */
import { importBackup, parseBackup, type BackupData } from './backup';

export const ENCRYPTED_PREFIX = 'SLCRYPT';
export const ENCRYPTED_VERSION = 1;
const PBKDF2_ITERATIONS = 310_000;
const SALT_BYTES = 16;
const NONCE_BYTES = 12;

interface EncryptedEnvelope {
  salt: string;   // base64
  iv: string;    // base64
  ct: string;    // base64
}

/** Parsea la cabecera `SLCRYPT v1 <saltB64> <ivB64> <ctB64>` en una línea. */
export function parseEncryptedFile(text: string): EncryptedEnvelope | null {
  const parts = text.trim().split(/\s+/);
  if (parts.length !== 5 || parts[0] !== ENCRYPTED_PREFIX) return null;
  if (parts[1] !== String(ENCRYPTED_VERSION)) return null;
  const salt = parts[2], iv = parts[3], ct = parts[4];
  try {
    if (atob(salt).length % SALT_BYTES !== 0) return null;
  } catch { return null; }
  return { salt, iv, ct };
}

export const isEncryptedBackup = (text: string): boolean => text.trim().startsWith(`${ENCRYPTED_PREFIX} `);

const te = new TextEncoder();
const td = new TextDecoder();
const b64 = (u8: Uint8Array) => btoa(String.fromCharCode(...u8));
const unb64 = (s: string) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const base = await crypto.subtle.importKey('raw', te.encode(password) as BufferSource, 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    base,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Cifra un backup JSON con una contraseña. Devuelve el texto de una línea. */
export async function encryptBackup(json: string, password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const iv = crypto.getRandomValues(new Uint8Array(NONCE_BYTES));
  const key = await deriveKey(password, salt);
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv: iv as BufferSource }, key, te.encode(json) as BufferSource);
  return `${ENCRYPTED_PREFIX} ${ENCRYPTED_VERSION} ${b64(salt)} ${b64(iv)} ${b64(new Uint8Array(ct))}`;
}

/**
 * Descifra un backup cifrado y devuelve el objeto de backup validado.
 * Lanza `wrongpassword` si la contraseña no es correcta.
 */
export async function decryptBackup(text: string, password: string): Promise<BackupData> {
  const env = parseEncryptedFile(text);
  if (!env) throw new Error('invalid');
  const key = await deriveKey(password, unb64(env.salt));
  let plain: string;
  try {
    plain = td.decode(await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: unb64(env.iv) as BufferSource },
      key,
      unb64(env.ct) as BufferSource,
    ));
  } catch {
    throw new Error('wrongpassword');
  }
  return parseBackup(plain);
}

/** Importa un backup (cifrado o no) pidiendo contraseña si hace falta. */
export async function importMaybeEncrypted(text: string, password: string | null): Promise<'plain' | 'decrypted'> {
  if (!isEncryptedBackup(text)) {
    await importBackup(parseBackup(text));
    return 'plain';
  }
  if (!password) throw new Error('encrypted'); // la UI debe pedir contraseña
  const data = await decryptBackup(text, password);
  await importBackup(data);
  return 'decrypted';
}
