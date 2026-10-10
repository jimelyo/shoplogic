import { db, TABLE_NAMES, type TableName } from '../db/database';
import { downloadFile } from './backup';

/** CSV serialisation used by merchants to open day-to-day data in Excel. */

const esc = (v: unknown): string => {
  const s = v === undefined || v === null ? '' : String(v);
  return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** `;` is the default Excel separator on European locales: it opens directly. */
const SEP = ';';

/** Flattens nested values (items arrays, objects) into readable strings. */
const flat = (v: unknown): string => {
  if (v === undefined || v === null) return '';
  if (Array.isArray(v)) return v.map((x) => (x && typeof x === 'object' ? objectSummary(x) : String(x))).join(' | ');
  if (typeof v === 'object') return objectSummary(v as Record<string, unknown>);
  return String(v);
};

function objectSummary(o: Record<string, unknown>): string {
  if (typeof o.name === 'string' && 'quantity' in o) return `${String(o.quantity)}× ${o.name}`;
  if (typeof o.name === 'string') return o.name;
  return JSON.stringify(o);
}

/**
 * Exports a table as a UTF-8 CSV (BOM included so Excel detects the encoding).
 * Column set = union of the first 50 rows' keys, skipping internal ones.
 */
const SKIP = new Set(['password', 'logo']);
export async function exportTableCsv(name: TableName, dateLabel = ''): Promise<number> {
  const rows: Record<string, unknown>[] = await db.table(name).toArray();
  const cols = new Set<string>();
  for (const r of rows.slice(0, 50)) Object.keys(r).forEach((k) => { if (!SKIP.has(k)) cols.add(k); });
  const header = [...cols];
  const lines = [header.map(esc).join(SEP)];
  for (const r of rows) lines.push(header.map((k) => esc(flat(r[k]))).join(SEP));
  const csv = '\uFEFF' + lines.join('\n');
  const label = dateLabel ? `${name}_${dateLabel}` : name;
  downloadFile(csv, `shoplogic_${label}.csv`, 'text/csv;charset=utf-8');
  return rows.length;
}
