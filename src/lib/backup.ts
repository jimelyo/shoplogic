import { format } from 'date-fns';
import { db, DEFAULT_SETTINGS, TABLE_NAMES, getSettings, type TableName } from '../db/database';

export type BackupData = Partial<Record<TableName, unknown[]>> & { _meta?: { app: string; version: number; exportedAt: string } };

export function downloadFile(content: string | Blob, filename: string, mime = 'application/json') {
  const blob = content instanceof Blob ? content : new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export async function exportAll(suffix = ''): Promise<{ json: string; size: number; filename: string }> {
  const data: BackupData = { _meta: { app: 'ShopLogic Pro', version: 1, exportedAt: new Date().toISOString() } };
  for (const name of TABLE_NAMES) data[name] = await db.table(name).toArray();
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
  const known = TABLE_NAMES.filter((n) => Array.isArray(d[n]));
  if (!known.length) throw new Error('invalid');
  return d as BackupData;
}

export function backupCounts(d: BackupData): Record<string, number> {
  const out: Record<string, number> = {};
  for (const n of TABLE_NAMES) if (Array.isArray(d[n])) out[n] = d[n]!.length;
  return out;
}

/** Restores everything except users (users are always protected). */
export async function importBackup(d: BackupData) {
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

  const { json, size } = await exportAll('_auto');
  const created = { date: today, json, size, createdAt: new Date().toISOString() };
  await db.snapshots.add(created);
  // Keep the newest MAX_SNAPSHOTS only.
  const all = await db.snapshots.orderBy('date').reverse().primaryKeys();
  const stale = all.slice(MAX_SNAPSHOTS);
  if (stale.length) await db.snapshots.bulkDelete(stale);
  return { date: today, size };
}