import { useCallback, useRef, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Banknote, Bell, Boxes, ChartColumn, ClipboardList, FileText, KeyRound, LayoutDashboard, Lock as LockIcon, LogOut, Menu, Moon, Package, Settings, ShoppingCart, Sun, Truck, UserCog, Users, Wallet, Wrench, X, Zap, Check,
} from 'lucide-react';
import type { Accent, NavSection } from '../types';
import { ACCENTS, ALL_MODULES } from '../types';
import { db } from '../db/database';
import { useStore } from '../store/store';
import { canAccess } from '../lib/permissions';
import { useClickOutside } from '../lib/hooks';
import { appNameOf, BrandMark } from './shared/Brand';
import { logAction } from '../lib/audit';
import { LanguageSelector } from './shared/LanguageSelector';
import { RoleBadge } from './shared/RolePermissions';
import { ChangePassword } from './ChangePassword';

const NAV_ICONS: Record<NavSection, typeof Bell> = {
  dashboard: LayoutDashboard, pos: ShoppingCart, cash: Banknote, inventory: Package, stock: Boxes, repairs: Wrench, clients: Users, providers: Truck,
  purchases: ClipboardList, expenses: Wallet, billing: FileText, reports: ChartColumn, users: UserCog, notifications: Bell, automations: Zap, settings: Settings,
};
const NAV_GROUPS: { key: string; items: NavSection[] }[] = [
  { key: 'nav.groupMain', items: ['dashboard', 'pos', 'cash', 'inventory', 'stock', 'repairs'] },
  { key: 'nav.groupManagement', items: ['clients', 'providers', 'purchases', 'expenses', 'billing', 'reports'] },
  { key: 'nav.groupSystem', items: ['users', 'notifications', 'automations', 'settings'] },
];

export const ACCENT_META: Record<Accent, { icon: string; hex: string }> = {
  default: { icon: '🎨', hex: '#6366f1' }, green: { icon: '🌿', hex: '#22c55e' }, red: { icon: '🔴', hex: '#ef4444' },
  blue: { icon: '🔵', hex: '#3b82f6' }, purple: { icon: '🟣', hex: '#a855f7' }, orange: { icon: '🟠', hex: '#f97316' },
};

export function ThemeMenu() {
  const { t } = useTranslation();
  const { mode, accent, setMode, setAccent } = useStore();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  useClickOutside(ref, close, open);
  return (
    <div ref={ref} className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="theme"
        className="flex h-9 items-center gap-1.5 rounded-lg border border-sl-border bg-sl-card px-2.5 text-sm shadow-sm hover:bg-sl-hover">
        <span>{ACCENT_META[accent].icon}</span>
        {mode === 'dark' ? <Moon className="size-4 text-sl-muted" /> : <Sun className="size-4 text-amber-500" />}
      </button>
      {open && (
        <div className="absolute end-0 top-full z-50 mt-2 w-64 rounded-xl border border-sl-border bg-sl-card p-3 shadow-xl animate-scale-in">
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-sl-muted">{t('theme.mode')}</div>
          <div className="mb-3 grid grid-cols-2 gap-1 rounded-lg bg-sl-hover p-1">
            {(['light', 'dark'] as const).map((m) => (
              <button key={m} type="button" onClick={() => setMode(m)}
                className={`rounded-md py-1.5 text-xs font-semibold ${mode === m ? 'bg-sl-card text-sl-text shadow' : 'text-sl-muted'}`}>
                {m === 'light' ? '☀️' : '🌙'} {t(`theme.${m}`)}
              </button>
            ))}
          </div>
          <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-sl-muted">{t('theme.accent')}</div>
          <div className="grid grid-cols-3 gap-2">
            {ACCENTS.map((a) => (
              <button key={a} type="button" onClick={() => setAccent(a)}
                className={`relative flex flex-col items-center gap-1 rounded-lg border p-2 text-[11px] font-medium ${accent === a ? 'border-primary ring-2 ring-primary/30' : 'border-sl-border hover:border-primary/40'}`}>
                <span className="flex h-6 w-full overflow-hidden rounded-md border border-sl-border">
                  <span className="w-1/2" style={{ background: mode === 'dark' ? (a === 'default' ? '#0f172a' : { green: '#064e3b', red: '#7f1d1d', blue: '#1e3a5f', purple: '#3b0764', orange: '#7c2d12' }[a]) : '#f8fafc' }} />
                  <span className="w-1/2" style={{ background: ACCENT_META[a].hex }} />
                </span>
                <span className="truncate text-sl-text">{ACCENT_META[a].icon} {t(`theme.accent_${a}`)}</span>
                {accent === a && <Check className="absolute end-1 top-1 size-3 text-primary" />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export function Layout({ children }: { children: ReactNode }) {
  const { t } = useTranslation();
  const user = useStore((s) => s.currentUser)!;
  const active = useStore((s) => s.activeModule);
  const setActive = useStore((s) => s.setActiveModule);
  const sidebarOpen = useStore((s) => s.sidebarOpen);
  const setSidebarOpen = useStore((s) => s.setSidebarOpen);
  const logout = useStore((s) => s.logout);
  const setLocked = useStore((s) => s.setLocked);
  const [pwOpen, setPwOpen] = useState(false);
  const unread = useLiveQuery(() => db.notifications.filter((n) => !n.read).count(), []) ?? 0;
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);

  const doLogout = async () => { await logAction('logout', 'auth', user.email); logout(); };
  const visible = ALL_MODULES.filter((m) => canAccess(user, m));

  const sidebar = (
    <aside className="flex h-full w-64 flex-col border-e border-sl-sidebar-border bg-sl-sidebar text-sl-sidebar-text">
      <div className="flex h-16 items-center gap-3 px-5">
        <BrandMark logo={settings?.logo} className="size-9 shrink-0 rounded-xl shadow-md" />
        <div className="min-w-0 flex-1">
          <div className="truncate font-extrabold tracking-tight">{appNameOf(settings?.appName)}</div>
          <div className="truncate text-[11px] text-sl-sidebar-muted">{settings?.storeName ?? 'ERP · POS'}</div>
        </div>
        <button type="button" className="rounded-lg p-1 text-sl-sidebar-muted hover:bg-sl-sidebar-hover lg:hidden" onClick={() => setSidebarOpen(false)}><X className="size-5" /></button>
      </div>
      <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-2">
        {NAV_GROUPS.map((g) => {
          const items = g.items.filter((m) => visible.includes(m));
          if (!items.length) return null;
          return (
            <div key={g.key}>
              <div className="mb-1 px-3 text-[10px] font-bold uppercase tracking-wider text-sl-sidebar-muted">{t(g.key)}</div>
              {items.map((m) => {
                const Icon = NAV_ICONS[m];
                const on = active === m;
                return (
                  <button key={m} type="button" onClick={() => setActive(m)}
                    className={`mb-0.5 flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${on ? 'bg-primary text-white shadow-md shadow-primary/25' : 'text-sl-sidebar-text/85 hover:bg-sl-sidebar-hover'}`}>
                    <Icon className="size-[18px] shrink-0" />
                    <span className="flex-1 truncate text-start">{t(`nav.${m}`)}</span>
                    {m === 'notifications' && unread > 0 && (
                      <span className={`min-w-5 rounded-full px-1.5 text-center text-[10px] font-bold leading-5 ${on ? 'bg-white text-primary' : 'bg-red-500 text-white'}`}>{unread > 99 ? '99+' : unread}</span>
                    )}
                  </button>
                );
              })}
            </div>
          );
        })}
      </nav>
      <div className="border-t border-sl-sidebar-border p-3">
        <div className="flex items-center gap-3 rounded-xl bg-sl-sidebar-hover p-2.5">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-sky-500 font-bold text-white">{user.name.charAt(0).toUpperCase()}</div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{user.name}</div>
            <RoleBadge role={user.role} />
          </div>
          <div className="flex gap-0.5">
            <button type="button" onClick={() => setPwOpen(true)} title={t('auth.changePassword')} aria-label={t('auth.changePassword')}
              className="rounded-lg p-1.5 text-sl-sidebar-muted hover:bg-sl-sidebar-hover hover:text-sl-sidebar-text">
              <KeyRound className="size-4" />
            </button>
            <button type="button" onClick={() => setLocked(true)} title={t('auth.lockNow')} aria-label={t('auth.lockNow')}
              className="rounded-lg p-1.5 text-sl-sidebar-muted hover:bg-sl-sidebar-hover hover:text-sl-sidebar-text">
              <LockIcon className="size-4" />
            </button>
            <button type="button" onClick={doLogout} title={t('auth.logout')} className="rounded-lg p-1.5 text-sl-sidebar-muted hover:bg-red-500/15 hover:text-red-500"><LogOut className="size-4 rtl-flip" /></button>
          </div>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-dvh bg-sl-bg">
      <div className="sticky top-0 hidden h-dvh shrink-0 lg:block">{sidebar}</div>
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div className="absolute inset-0 bg-slate-950/50 animate-fade-in" onClick={() => setSidebarOpen(false)} />
          <div className="absolute inset-y-0 start-0 shadow-2xl animate-slide-up">{sidebar}</div>
        </div>
      )}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b border-sl-border bg-sl-bg/85 px-3 backdrop-blur-md sm:px-6">
          <button type="button" className="rounded-lg p-2 text-sl-text hover:bg-sl-hover lg:hidden" onClick={() => setSidebarOpen(true)} aria-label="menu"><Menu className="size-5" /></button>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-bold text-sl-text">{t(`nav.${active}`)}</div>
            <div className="hidden truncate text-[11px] text-sl-muted sm:block">{t('header.hello', { name: user.name.split(' ')[0] })}</div>
          </div>
          {canAccess(user, 'notifications') && (
            <button type="button" onClick={() => setActive('notifications')} className="relative flex size-9 items-center justify-center rounded-lg border border-sl-border bg-sl-card shadow-sm hover:bg-sl-hover" aria-label="notifications">
              <Bell className="size-4 text-sl-text" />
              {unread > 0 && <span className="absolute -end-1 -top-1 min-w-4 rounded-full bg-red-500 px-1 text-[9px] font-bold leading-4 text-white">{unread}</span>}
            </button>
          )}
          <LanguageSelector />
          <ThemeMenu />
        </header>
        <main className="min-w-0 flex-1 p-3 sm:p-6">{children}</main>
      </div>
      <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </div>
  );
}