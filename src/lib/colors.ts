import type { InvoiceStatus, PurchaseOrderStatus, RepairStatus } from '../types';

export type BadgeColor = 'slate' | 'blue' | 'green' | 'red' | 'amber' | 'purple' | 'orange' | 'cyan' | 'pink' | 'indigo' | 'gray';

export const BADGE_CLASSES: Record<BadgeColor, string> = {
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-200 ring-slate-500/25',
  gray: 'bg-gray-500/15 text-gray-600 dark:text-gray-300 ring-gray-500/25',
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 ring-blue-500/25',
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 ring-emerald-500/25',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300 ring-red-500/25',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 ring-amber-500/25',
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 ring-purple-500/25',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 ring-orange-500/25',
  cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 ring-cyan-500/25',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 ring-pink-500/25',
  indigo: 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 ring-indigo-500/25',
};

export const REPAIR_STATUS_COLORS: Record<RepairStatus, BadgeColor> = {
  received: 'slate', diagnosis: 'cyan', in_progress: 'blue', waiting_parts: 'amber', completed: 'green', delivered: 'purple', cancelled: 'red',
};
export const REPAIR_STATUS_HEX: Record<RepairStatus, string> = {
  received: '#64748b', diagnosis: '#06b6d4', in_progress: '#3b82f6', waiting_parts: '#f59e0b', completed: '#10b981', delivered: '#a855f7', cancelled: '#ef4444',
};
export const INVOICE_STATUS_COLORS: Record<InvoiceStatus, BadgeColor> = {
  draft: 'slate', sent: 'blue', paid: 'green', partial: 'amber', overdue: 'red', cancelled: 'gray',
};
export const PURCHASE_STATUS_COLORS: Record<PurchaseOrderStatus, BadgeColor> = {
  draft: 'slate', sent: 'blue', partial: 'amber', received: 'green', cancelled: 'gray',
};

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.trim().replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const n = parseInt(full.slice(0, 6), 16);
  if (Number.isNaN(n)) return [79, 70, 229];
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function cssVar(name: string, fallback = ''): string {
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}