import { useTranslation } from 'react-i18next';
import { Lock } from 'lucide-react';
import type { NavSection, Role } from '../../types';
import { ALL_MODULES, DEFAULT_ROLE_PERMISSIONS, READ_ONLY_MODULES, ROLE_ICONS, ROLES } from '../../types';
import { ADMIN_ONLY } from '../../lib/permissions';
import type { BadgeColor } from '../../lib/colors';
import { Badge } from './UI';
import { Button } from './Forms';

export const ROLE_COLORS: Record<Role, BadgeColor> = { admin: 'red', manager: 'blue', technician: 'amber', cashier: 'green' };
export const MODULE_ICONS: Record<NavSection, string> = {
  dashboard: '📊', pos: '🛒', cash: '💵', inventory: '📦', stock: '📜', repairs: '🔧', quotes: '📋', clients: '👥', providers: '🚚', purchases: '📥',
  expenses: '💸', billing: '📄', reports: '📈', users: '👤', notifications: '🔔', automations: '🤖', settings: '⚙️',
};

export function RoleBadge({ role }: { role: Role }) {
  const { t } = useTranslation();
  return <Badge color={ROLE_COLORS[role]}>{ROLE_ICONS[role]} {t(`roles.${role}`)}</Badge>;
}

export function PermissionGrid({ value, onChange, role }: { value: NavSection[]; onChange: (v: NavSection[]) => void; role: Role }) {
  const { t } = useTranslation();
  const locked = (m: NavSection) => ADMIN_ONLY.includes(m) && role !== 'admin';
  const toggle = (m: NavSection) => {
    if (locked(m)) return;
    onChange(value.includes(m) ? value.filter((x) => x !== m) : ALL_MODULES.filter((x) => x === m || value.includes(x)));
  };
  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-2">
        <Button size="sm" variant="success" onClick={() => onChange(ALL_MODULES.filter((m) => !locked(m)))}>✅ {t('users.enableAll')}</Button>
        <Button size="sm" variant="secondary" onClick={() => onChange([])}>⛔ {t('users.disableAll')}</Button>
        <Button size="sm" variant="outline" onClick={() => onChange([...DEFAULT_ROLE_PERMISSIONS[role]])}>↺ {t('users.resetRole')}</Button>
        <span className="ms-auto self-center text-xs text-sl-muted">{value.length}/{ALL_MODULES.length}</span>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {ALL_MODULES.map((m) => {
          const on = value.includes(m);
          const lock = locked(m);
          return (
            <button
              key={m}
              type="button"
              disabled={lock}
              onClick={() => toggle(m)}
              title={lock ? t('users.adminOnly') : undefined}
              className={`flex items-center gap-2 rounded-lg border px-2.5 py-2 text-start text-xs font-semibold ${lock ? 'cursor-not-allowed border-sl-border bg-sl-card2 text-sl-muted opacity-60' : on ? 'border-emerald-500/60 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-sl-border bg-sl-card text-sl-muted hover:border-primary/50'}`}
            >
              <span className="text-base">{MODULE_ICONS[m]}</span>
              <span className="flex-1 truncate">{t(`nav.${m}`)}</span>
              {lock ? <Lock className="size-3.5" /> : <span>{on ? '✓' : '○'}</span>}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function RolePermissionsMatrix() {
  const { t } = useTranslation();
  return (
    <div className="overflow-x-auto rounded-xl border border-sl-border bg-sl-card">
      <table className="w-full min-w-[560px] text-sm">
        <thead className="bg-sl-card2 text-xs text-sl-muted">
          <tr>
            <th className="px-3 py-2.5 text-start">{t('users.permission')}</th>
            {ROLES.map((r) => <th key={r} className="px-3 py-2.5 text-center">{ROLE_ICONS[r]} {t(`roles.${r}`)}</th>)}
          </tr>
        </thead>
        <tbody>
          {ALL_MODULES.map((m) => (
            <tr key={m} className="border-t border-sl-border">
              <td className="px-3 py-2">{MODULE_ICONS[m]} {t(`nav.${m}`)}</td>
              {ROLES.map((r) => {
                const has = DEFAULT_ROLE_PERMISSIONS[r].includes(m);
                const ro = READ_ONLY_MODULES[r]?.includes(m);
                return <td key={r} className="px-3 py-2 text-center">{has ? (ro ? <span title={t('common.readOnly')}>✅ <span className="text-[10px] text-sl-muted">({t('common.readOnly')})</span></span> : '✅') : '❌'}</td>;
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}