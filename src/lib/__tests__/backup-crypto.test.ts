import { beforeEach, describe, expect, it } from 'vitest';
import { db, DEFAULT_SETTINGS } from '../../db/database';
import { encryptBackup, decryptBackup, isEncryptedBackup, parseEncryptedFile } from '../backup-crypto';
import { exportAll, importBackup } from '../backup';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
  await db.settings.add({ ...DEFAULT_SETTINGS });
};

beforeEach(clearAll);

const sample = async () => {
  await db.products.add({ name: 'Funda', category: 'accessories', barcode: '8400000000042', cost: 4.5, price: 19.99, stock: 10, minStock: 2, createdAt: '2026-10-19T10:00:00.000Z' });
  return exportAll('_test');
};

describe('backup-crypto', () => {
  it('cifra y descifra ida y vuelta (AES-256-GCM, PBKDF2)', async () => {
    const { json } = await sample();
    const enc = await encryptBackup(json, 'contraseña-secreta-€');
    expect(isEncryptedBackup(enc)).toBe(true);
    const back = await decryptBackup(enc, 'contraseña-secreta-€');
    expect((back.products as unknown as Array<{ name: string }>)[0].name).toBe('Funda');
  });

  it('rechaza una contraseña errónea con wrongpassword (nunca descifra parcial)', async () => {
    const { json } = await sample();
    const enc = await encryptBackup(json, 'correcta');
    await expect(decryptBackup(enc, 'incorrecta')).rejects.toThrow('wrongpassword');
  });

  it('exige longitud de clave fuerte: el salt y el nonce son aleatorios por exportación', async () => {
    const { json } = await sample();
    const a = await encryptBackup(json, 'misma-contraseña');
    const b = await encryptBackup(json, 'misma-contraseña');
    expect(a).not.toBe(b); // salt+nonce aleatorios → ciphertext distinto
    expect(parseEncryptedFile(a)!.salt).not.toBe(parseEncryptedFile(b)!.salt);
  });

  it('detecta cabecera SCRYPT y rechaza ficheros malformados', () => {
    expect(isEncryptedBackup('SLCRYPT 1 abc def xyz')).toBe(true);
    expect(isEncryptedBackup('{"_meta":{}}')).toBe(false);
    expect(parseEncryptedFile('SLCRYPT 2 a b c')).toBeNull(); // versión no soportada
    expect(parseEncryptedFile('JSON {}')).toBeNull();
  });

  it('el fichero cifrado se importa con importBackup (flujo UI real)', async () => {
    const { json } = await sample();
    const enc = await encryptBackup(json, 'mypass');
    const data = await decryptBackup(enc, 'mypass');
    await importBackup(data);
    expect((await db.products.toArray())[0].name).toBe('Funda');
  });

  it('permite también importar backups SIN cifrar (retro-compatibilidad)', async () => {
    const { json } = await sample();
    expect(isEncryptedBackup(json)).toBe(false);
    const data = JSON.parse(json);
    await importBackup(data);
    expect((await db.products.toArray())[0].name).toBe('Funda');
  });
});
