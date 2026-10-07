import type { NavSection } from '../types';
import { ALL_MODULES, READ_ONLY_MODULES } from '../types';
import type { SessionUser } from '../store/store';

export const ADMIN_ONLY: NavSection[] = ['users', 'settings'];

export function canAccess(u: SessionUser | null, m: NavSection): boolean {
  if (!u) return false;
  if (ADMIN_ONLY.includes(m) && u.role !== 'admin') return false;
  return u.permissions.includes(m);
}
export function isReadOnly(u: SessionUser | null, m: NavSection): boolean {
  if (!u) return true;
  return !!READ_ONLY_MODULES[u.role]?.includes(m);
}
export function firstAccessible(u: SessionUser | null): NavSection | null {
  return ALL_MODULES.find((m) => canAccess(u, m)) ?? null;
}