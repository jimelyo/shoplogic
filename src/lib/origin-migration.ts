/**
 * Migración de origen (Electron desktop, #10 app://).
 *
 * IndexedDB está aislada por origen: al pasar el renderer de `file://`
 * (versiones 1.0–1.3.x) a `app://shoplogic` la base de datos parece vacía.
 * El main abre una vez una ventana oculta sobre el origen viejo que
 * llama `dumpOldOrigin()` (abajo) y guarda el volcado en
 * `userData/origin-migration.json`; la ventana nueva con `app://` lo importa
 * con `restoreOldOriginData()` en su primer arranque y deja el marker local.
 *
 * Ambos pasos son idempotentes: el import va en una transacción Dexie (éxito
 * total o nada) y el marker localStorage evita repeticiones en el origen nuevo.
 */

import { db, TABLE_NAMES } from '../db/database';

/** Volcado de TODAS las tablas (incluye users y settings; nada enmascarado). */
async function dumpAllTables(): Promise<{ tables: Record<string, unknown[]>; total: number }> {
  const tables: Record<string, unknown[]> = {};
  let total = 0;
  for (const name of TABLE_NAMES) {
    const rows = await db.table(name).toArray();
    tables[name] = rows;
    total += rows.length;
  }
  return { tables, total };
}

/**
 * Solo la ventana oculta (`app://…/#__sl-migrate-origin` → realmente file://)
 * llama a esto: serializa la base del origen viejo y se la pasa al main por
 * IPC. Si la base está vacía (instalación nueva), el dump también se envía
 * `{ empty: true }` para que el migración quede decidido de una vez.
 */
export async function dumpOldOrigin(): Promise<void> {
  const bridge = typeof window !== 'undefined' ? window.shoplogicDesktop : undefined;
  if (!bridge?.sendOriginDump) return;
  try {
    const { tables, total } = await dumpAllTables();
    bridge.sendOriginDump(JSON.stringify(total > 0 ? { tables, total } : { empty: true }));
  } catch {
    bridge.sendOriginDump(JSON.stringify({ empty: true }));
  }
}

/** Resuelve la base vieja al origen nuevo. Devuelve true si importó datos. */
export async function restoreOldOriginData(): Promise<boolean> {
  const bridge = typeof window !== 'undefined' ? window.shoplogicDesktop : undefined;
  if (!bridge?.getOriginMigration) return false;
  if (location.protocol !== 'app:') return false; // nunca toca el origen viejo
  if (localStorage.getItem('sl_origin_migrated')) return false;
  const raw = await bridge.getOriginMigration();
  if (!raw) return false; // sin dump pendiente (o migración ya decidida)

  let data: { tables?: Record<string, unknown[]>; total?: number; empty?: boolean };
  try {
    data = JSON.parse(raw);
  } catch {
    return false; // fichero corrupto: no importa nada (queda pendiente)
  }
  if (data.empty) {
    localStorage.setItem('sl_origin_migrated', '1');
    await bridge.finishOriginMigration?.();
    return false;
  }

  const tables = data.tables ?? {};
  const names = TABLE_NAMES.filter((n) => Array.isArray(tables[n]) && tables[n].length > 0);
  if (!names.length) {
    localStorage.setItem('sl_origin_migrated', '1');
    await bridge.finishOriginMigration?.();
    return false; // dump sin filas: nada que importar
  }
  // users y settings con put() (conservan id y no duplican), el resto clear+add.
  const protectedTables: string[] = ['users', 'settings'];
  const clearables = names.filter((n) => !protectedTables.includes(n));
  await db.transaction('rw', [...new Set([...names, ...clearables])].map((n) => db.table(n)), async () => {
    for (const n of clearables) {
      await db.table(n).clear();
      const rows = tables[n] as unknown[];
      if (rows.length) await db.table(n).bulkAdd(rows);
    }
    for (const n of protectedTables) {
      const rows = tables[n] as unknown[];
      if (rows.length) await db.table(n).bulkPut(rows);
    }
  });
  localStorage.setItem('sl_origin_migrated', '1');
  await bridge.finishOriginMigration?.();
  return true;
}
