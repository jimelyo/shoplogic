import { format } from 'date-fns';
import Dexie from 'dexie';
import { db, DEFAULT_SETTINGS, TABLE_NAMES, getSettings, type TableName } from '../db/database';

export type BackupData = Partial<Record<TableName, unknown[]>> & { _meta?: { app: string; version: number; exportedAt: string } };

export interface SnapshotOptions {
  /** Exclude messaging credentials from an ON-DISK snapshot: they are masked instead. */
  maskCredentials?: boolean;
}

function maskChannels(channels: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!channels || typeof channels !== 'object') return channels;
  const c = channels as { whatsapp?: Record<string, unknown>; email?: Record<string, unknown> };
  const mask = (o: Record<string, unknown> | undefined): Record<string, unknown> | undefined =>
    o ? { ...o, token: o.token ? '•masked•' : '', password: o.password ? '•masked•' : '' } : o;
  return { ...c, whatsapp: mask(c.whatsapp), email: mask(c.email) };
}

/** Applies credential masking to a whole export payload. */
export function applyCredentialMask(data: BackupData): BackupData {
  const rows = data.settings;
  if (!Array.isArray(rows)) return data;
  return { ...data, settings: rows.map((r) => {
    if (!r || typeof r !== 'object') return r;
    const o = r as Record<string, unknown>;
    return { ...o, channels: maskChannels(o.channels as Record<string, unknown> | undefined) };
  }) };
}

/** True when this backup was produced with credential masking (import path checks this). */
export const hasMaskedCredentials = (d: BackupData): boolean => {
  const rows = d.settings;
  return Array.isArray(rows) && rows.some((r) => r && typeof r === 'object' && JSON.stringify((r as Record<string, unknown>).channels ?? {}).includes('•masked•'));
};

function dataTable(db: Dexie, name: TableName) { return db.table(name); }

export function downloadFile(content: string | Blob, filename: string, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportAll(suffix = '', opts: SnapshotOptions = {}): Promise<{ json: string; size: number; filename: string }> {
  let data: BackupData = { _meta: { app: 'ShopLogic Pro', version: 1, exportedAt: new Date().toISOString() } };
  for (const name of TABLE_NAMES) data[name] = await db.table(name).toArray();
  if (opts.maskCredentials) data = applyCredentialMask(data);
  const json = JSON.stringify(data, null, 2);
  const filename = `shoplogic_backup_${format(new Date(), 'yyyy-MM-dd')}${suffix}.json`;
  return { json, size: new Blob([json]).size, filename };
}

export async function downloadBackup(suffix = '') {
  const b = await exportAll(suffix);
  downloadFile(b.json, b.filename);
  return b;
}

export function parseBackup(text: string): BackupData {
  const d = JSON.parse(text);
  if (!d || typeof d !== 'object' || Array.isArray(d)) throw new Error('invalid');
  // A backup written by a newer app version may not have _meta.
  const known = TABLE_NAMES.filter((n) => Array.isArray(d[n]));
  if (!known.length) throw new Error('invalid');
  return d as BackupData;
}

/** Light per-table sanity checks so a malformed backup can't brick the app. */
const TABLE_MIN_FIELDS: Partial<Record<TableName, string[]>> = {
  products: ['name', 'price'],
  sales: ['date', 'items', 'total'],
  repairs: ['customerName', 'device'],
  customers: ['name'],
  providers: ['name'],
  expenses: ['date', 'amount'],
  invoices: ['number', 'items', 'total'],
  users: ['email'],
  logs: ['timestamp'],
  notifications: ['createdAt'],
  purchaseOrders: ['number', 'items'],
  stockMoves: ['productId', 'timestamp'],
  cashSessions: ['openedAt'],
  returns: ['ticketNumber', 'date', 'total'],
  outbox: ['to', 'body'],
};

/** Validates every row of the backup against its mandatory minimum fields. */
export function validateBackupRows(d: BackupData): { ok: boolean; errors: string[] } {
  const errors: string[] = [];
  for (const n of TABLE_NAMES) {
    const rows = d[n];
    if (!Array.isArray(rows)) continue;
    const required = TABLE_MIN_FIELDS[n] ?? [];
    rows.forEach((row, i) => {
      if (!row || typeof row !== 'object') { errors.push(`${n}[${i}]`); return; }
      for (const f of required) if (!(f in row)) errors.push(`${n}[${i}].${f}`);
    });
  }
  return { ok: errors.length === 0, errors: errors.slice(0, 8) };
}

export function backupCounts(d: BackupData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of TABLE_NAMES) if (Array.isArray(d[n])) out[n] = d[n]!.length;
  return out;
}

/** Restores everything except users (users are always protected). */
export async function importBackup(d: BackupData) {
  // Integrity gate: rows missing mandatory fields would crash the app at runtime.
  const { ok, errors } = validateBackupRows(d);
  if (!ok) throw new Error(`backup.corrupt: ${errors.join(', ')}`);
  // Masked credentials (from the daily snapshot) must not be imported as-is:
  // they would erase the real WhatsApp token / SMTP password on next save.
  if (hasMaskedCredentials(d)) {
    const live = (await getSettings()).channels;
    if (live) (d as BackupData).settings = [{ ...(d.settings?.[0] ?? {}), channels: live } as unknown as BackupData['settings']];
  }
  const tables = TABLE_NAMES.filter((n) => n !== 'users');
  await db.transaction('rw', tables.map((n) => db.table(n)), async () => {
    for (const n of tables) {
      await db.table(n).clear();
      const rows = d[n];
      if (Array.isArray(rows) && rows.length) await db.table(n).bulkAdd(rows);
    }
    if (!(await db.settings.count())) await db.settings.add({ ...DEFAULT_SETTINGS });
  });
}

export async function resetTables(tables: TableName[]) {
  const safe = tables.filter((n) => n !== 'users');
  await db.transaction('rw', safe.map((n) => db.table(n)), async () => {
    for (const n of safe) await db.table(n).clear();
    if (safe.includes('settings')) await db.settings.add({ ...DEFAULT_SETTINGS });
  });
}

export async function tableCounts(): Promise<Record<TableName, number>> {
  const out = {} as Record<TableName, number>;
  for (const n of TABLE_NAMES) out[n] = await db.table(n).count();
  return out;
}

export const formatBytes = (b: number) => (b < 1024 ? `${b} B` : b < 1048576 ? `${(b / 1024).toFixed(1)} KB` : `${(b / 1048576).toFixed(2)} MB`);

/** Snapshots kept by the `sys_daily_backup` automation (oldest are pruned). */
export const MAX_SNAPSHOTS = 7;

/**
 * `sys_daily_backup`: stores one full JSON snapshot per day inside IndexedDB.
 * Returns the created snapshot, or `null` when the automation is off or today's
 * snapshot already exists.
 */
export async function ensureDailySnapshot(): Promise<{ date: string; size: number } | null> {
  const settings = await getSettings();
  if (settings.automations?.sys_daily_backup === false) return null;
  const today = format(new Date(), 'yyyy-MM-dd');
  if (await db.snapshots.where('date').equals(today).count()) return null;

  // The daily snapshot lives on disk for a week: credentials are masked there.
  const { json, size } = await exportAll('_auto', { maskCredentials: true });
  const created = { date: today, json, size, createdAt: new Date().toISOString() };
  await db.snapshots.add(created);
  // Keep the newest MAX_SNAPSHOTS only.
  const all = await db.snapshots.orderBy('date').reverse().primaryKeys();
  const stale = all.slice(MAX_SNAPSHOTS);
  if (stale.length) await db.snapshots.bulkDelete(stale);
  return { date: today, size };
}