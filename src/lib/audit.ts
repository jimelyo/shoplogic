import { db } from '../db/database';
import { useStore } from '../store/store';

export type AuditAction =
  | 'login' | 'logout' | 'create' | 'update' | 'delete' | 'sale' | 'status_change' | 'payment'
  | 'export' | 'import' | 'reset' | 'password_change' | 'toggle_on' | 'toggle_off' | 'activate' | 'deactivate' | 'print' | 'test' | 'send'
  | 'open' | 'close' | 'refund';

export async function logAction(action: AuditAction, module: string, details?: string): Promise<void> {
  const u = useStore.getState().currentUser;
  try {
    await db.logs.add({
      userId: u?.id ?? 0,
      userName: u?.name ?? 'Sistema',
      action,
      module,
      details,
      timestamp: new Date().toISOString(),
      ip: 'local',
    });
  } catch (e) {
    console.warn('audit log failed', e);
  }
}