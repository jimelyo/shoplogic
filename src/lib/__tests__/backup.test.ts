import { beforeEach, describe, expect, it } from 'vitest';
import { db, TABLE_NAMES } from '../../db/database';
import { backupCounts, exportAll, importBackup, parseBackup, resetTables, tableCounts, validateBackupRows, applyCredentialMask } from '../backup';

const clearAll = async () => {
  await db.transaction('rw', db.tables, async () => {
    for (const t of db.tables) await t.clear();
  });
};

beforeEach(clearAll);

describe('exportAll', () => {
  it('serialises every table plus metadata', async () => {
    await db.products.add({ name: 'Funda', category: 'accessories', barcode: '1', cost: 1, price: 2, stock: 3, minStock: 1, createdAt: '' });
    const { json, filename, size } = await exportAll('_test');
    const data = JSON.parse(json);

    expect(filename).toContain('_test');
    expect(size).toBeGreaterThan(0);
    expect(data._meta).toMatchObject({ app: 'ShopLogic Pro' });
    for (const name of TABLE_NAMES) expect(data[name]).toBeDefined();
    expect(data.products).toHaveLength(1);
  });
});

describe('parseBackup', () => {
  it('accepts a payload holding at least one known table', () => {
    expect(parseBackup('{"products":[]}')).toHaveProperty('products', []);
  });

  it('rejects arrays, null and unknown payloads', () => {
    expect(() => parseBackup('[]')).toThrow('invalid');
    expect(() => parseBackup('null')).toThrow('invalid');
    expect(() => parseBackup('"texto"')).toThrow('invalid');
    expect(() => parseBackup('{"desconocida":[]}')).toThrow('invalid');
  });

  it('is not fooled by unrelated tables mixed in', () => {
    expect(backupCounts(parseBackup('{"products":[1,2],"noise":[1]}'))).toEqual({ products: 2 });
  });
});

describe('importBackup', () => {
  it('restores the tables but never touches users', async () => {
    await db.users.add({
      name: 'Admin', email: 'admin@x.com', password: 'hash', role: 'admin',
      permissions: ['dashboard'], isActive: true, createdAt: '',
    });
    await db.products.add({ name: 'Cable', category: 'accessories', barcode: '2', cost: 1, price: 2, stock: 9, minStock: 1, createdAt: '' });
    const backup = parseBackup((await exportAll()).json);

    await db.products.clear();
    expect(await db.products.count()).toBe(0);

    await importBackup({ ...backup, products: [] });
    expect(await db.products.count()).toBe(0);
    expect(await db.users.count()).toBe(1);

    await importBackup(backup);
    expect(await db.products.count()).toBe(1);
    expect(await db.users.count()).toBe(1);
    expect((await db.products.toArray())[0].name).toBe('Cable');
  });

  it('guarantees a settings row even when the backup has none', async () => {
    await importBackup({ products: [] });
    expect(await db.settings.count()).toBe(1);
  });
});

describe('validateBackupRows / credential masking', () => {
  const row = (extra: Record<string, unknown> = {}) => ({ name: 'x', price: 1, createdAt: '', ...extra });

  it('accepts rows with the mandatory fields', () => {
    expect(validateBackupRows({ products: [row()] }).ok).toBe(true);
  });

  it('rejects rows missing mandatory fields', () => {
    const r = validateBackupRows({ products: [{ price: 1 }] });
    expect(r.ok).toBe(false);
    expect(r.errors.join(' ')).toContain('products[0].name');
  });

  it('masks channel credentials in snapshots', () => {
    const data = { settings: [{ id: 1, channels: { whatsapp: { token: 'SECRET' }, email: { password: 'PW' } } }] };
    const masked = JSON.parse(JSON.stringify(applyCredentialMask(data as never)));
    expect(JSON.stringify(masked)).not.toContain('SECRET');
    expect(JSON.stringify(masked)).toContain('•masked•');
  });

  it('rejects a corrupted row instead of importing garbage', async () => {
    let failed = false;
    try { await importBackup({ products: [{ price: 1 }] as never }); }
    catch { failed = true; }
    expect(failed).toBe(true);
  });
});

describe('resetTables / tableCounts', () => {
  it('counts rows for every table', async () => {
    await db.products.add({ name: 'a', category: 'x', barcode: '1', cost: 0, price: 1, stock: 1, minStock: 0, createdAt: '' });
    await db.products.add({ name: 'b', category: 'x', barcode: '2', cost: 0, price: 1, stock: 1, minStock: 0, createdAt: '' });
    const counts = await tableCounts();
    expect(counts.products).toBe(2);
    for (const name of TABLE_NAMES) expect(counts[name]).toBeDefined();
  });

  it('clears only the requested tables', async () => {
    await db.products.add({ name: 'a', category: 'x', barcode: '1', cost: 0, price: 1, stock: 1, minStock: 0, createdAt: '' });
    await db.users.add({ name: 'u', email: 'u@x.com', password: 'p', role: 'admin', permissions: [], isActive: true, createdAt: '' });

    await resetTables(['products', 'settings', 'users']);

    expect(await db.products.count()).toBe(0);
    expect(await db.users.count()).toBe(1);
    expect(await db.settings.count()).toBe(1); // settings are recreated with defaults
  });
});
