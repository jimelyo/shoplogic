/**
 * Guardia de bloqueo del login: tras N intentos fallidos consecutivos la
 * cuenta queda bloqueada un tiempo exponencial escalable (30 s · 2^n, tope 1 h).
 * El estado se persiste en la ficha del usuario (`failedLogins`, `lockUntil`)
 * para que sobreviva a cierres de pestaña/webview — sin guardar nada sensible.
 */
export const FAILED_ATTEMPTS_BEFORE_LOCK = 3;
const BASE_WAIT_MS = 30_000;
const MAX_WAIT_MS = 3_600_000;

import type { UpdateSpec } from 'dexie';
import type { User } from '../types';

/** Campos de guardia tal y como viven en la ficha del usuario. */
export interface LoginGuardRecord {
  failedLogins?: number;
  /** ISO instant hasta el que la cuenta queda bloqueada. */
  lockUntil?: string;
}

/** Ese mismo record como patch válido para `db.users.update()`. Dexie 4 exige
 *  UpdateSpec estricto: la intersección aporta los índices `actions.${number}`. */
export type LoginGuardFields = LoginGuardRecord & UpdateSpec<User>;

/** Milisegundos restantes de bloqueo (0 = desbloqueada). */
export function lockedRemainingMs(u: LoginGuardRecord | null | undefined, now = Date.now()): number {
  const until = u?.lockUntil ? Date.parse(u.lockUntil) : NaN;
  if (!Number.isFinite(until)) return 0;
  return Math.max(0, until - now);
}

/** Parche (Patch de User) tras un intento fallido: nada sensible almacenado. */
export function failedAttemptFields(u: LoginGuardRecord): LoginGuardFields {
  const attempts = (u.failedLogins ?? 0) + 1;
  if (attempts < FAILED_ATTEMPTS_BEFORE_LOCK) return { failedLogins: attempts };
  const step = Math.min(attempts - FAILED_ATTEMPTS_BEFORE_LOCK, 7);
  const wait = Math.min(BASE_WAIT_MS * 2 ** step, MAX_WAIT_MS);
  return { failedLogins: attempts, lockUntil: new Date(Date.now() + wait).toISOString() };
}

export const loginSuccessFields = (): LoginGuardFields => ({ failedLogins: 0, lockUntil: undefined });

/** Mensaje legible de tiempo restante, p. ej. «1 min 5 s». */
export function fmtLockRemaining(ms: number): string {
  const s = Math.ceil(ms / 1000);
  if (s < 60) return `${s} s`;
  const min = Math.floor(s / 60);
  return s % 60 === 0 ? `${min} min` : `${min} min ${s % 60} s`;
}
