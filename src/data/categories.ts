import type { ProductCategory } from '../types';

export const DEFAULT_CATEGORIES: ProductCategory[] = [
  { id: 'phones', name: 'inventory.cat_phones', icon: '📱', color: 'blue', isDefault: true },
  { id: 'accessories', name: 'inventory.cat_accessories', icon: '🎧', color: 'purple', isDefault: true },
  { id: 'parts', name: 'inventory.cat_parts', icon: '🔧', color: 'amber', isDefault: true },
  { id: 'other', name: 'inventory.cat_other', icon: '📦', color: 'slate', isDefault: true },
];

export const CATEGORY_COLORS: Record<string, string> = {
  blue: 'bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30',
  purple: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30',
  amber: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30',
  slate: 'bg-slate-500/15 text-slate-700 dark:text-slate-300 border-slate-500/30',
  green: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30',
  red: 'bg-red-500/15 text-red-700 dark:text-red-300 border-red-500/30',
  pink: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30',
  cyan: 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 border-cyan-500/30',
  orange: 'bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30',
};
export const CATEGORY_COLOR_HEX: Record<string, string> = {
  blue: '#3b82f6', purple: '#a855f7', amber: '#f59e0b', slate: '#64748b', green: '#10b981',
  red: '#ef4444', pink: '#ec4899', cyan: '#06b6d4', orange: '#f97316',
};
export const CATEGORY_ICON_CHOICES = ['📱', '🎧', '🔧', '📦', '⌚', '💻', '🔋', '🔌', '🖥️', '📷', '🎮', '🛡️', '💾', '🧰', '🎁', '⭐'];

export function categoryLabel(c: ProductCategory | undefined, t: (k: string) => string): string {
  if (!c) return '—';
  return c.isDefault ? t(c.name) : c.name;
}