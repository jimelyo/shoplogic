import { Suspense, lazy, useEffect, useState, type ComponentType } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, seedDatabase } from './db/database';
import { useStore } from './store/store';
import { canAccess, firstAccessible } from './lib/permissions';
import { generateNotifications } from './lib/notifications';
import { flushOutbox } from './lib/messaging';
import { ensureDailySnapshot } from './lib/backup';
import { initUpdateSystem } from './lib/update';
import type { NavSection } from './types';
import { ALL_MODULES } from './types';
import { Layout } from './components/Layout';
import { Login } from './components/Login';
import { LockScreen } from './components/LockScreen';
import { useIdleLock } from './lib/hooks';
import { ToastContainer } from './components/shared/Toast';
import { appNameOf } from './components/shared/Brand';
import { ConfirmDialog, EmptyState } from './components/shared/UI';
import { LoadingPage } from './components/shared/Skeleton';

// One chunk per module: the login screen no longer pays for Reports/Billing.
const Dashboard = lazy(() => import('./components/Dashboard').then((m) => ({ default: m.Dashboard })));
const POS = lazy(() => import('./components/POS').then((m) => ({ default: m.POS })));
const Cash = lazy(() => import('./components/Cash').then((m) => ({ default: m.Cash })));
const Inventory = lazy(() => import('./components/Inventory').then((m) => ({ default: m.Inventory })));
const StockMoves = lazy(() => import('./components/StockMoves').then((m) => ({ default: m.StockMoves })));
const Repairs = lazy(() => import('./components/Repairs').then((m) => ({ default: m.Repairs })));
const Clients = lazy(() => import('./components/Clients').then((m) => ({ default: m.Clients })));
const Providers = lazy(() => import('./components/Providers').then((m) => ({ default: m.Providers })));
const Purchases = lazy(() => import('./components/Purchases').then((m) => ({ default: m.Purchases })));
const Expenses = lazy(() => import('./components/Expenses').then((m) => ({ default: m.Expenses })));
const Billing = lazy(() => import('./components/Billing').then((m) => ({ default: m.Billing })));
const Reports = lazy(() => import('./components/Reports').then((m) => ({ default: m.Reports })));
const Users = lazy(() => import('./components/Users').then((m) => ({ default: m.Users })));
const Notifications = lazy(() => import('./components/Notifications').then((m) => ({ default: m.Notifications })));
const Automations = lazy(() => import('./components/Automations').then((m) => ({ default: m.Automations })));
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));

const MODULES: Record<NavSection, ComponentType> = {
  dashboard: Dashboard,
  pos: POS,
  cash: Cash,
  inventory: Inventory,
  stock: StockMoves,
  repairs: Repairs,
  clients: Clients,
  providers: Providers,
  purchases: Purchases,
  expenses: Expenses,
  billing: Billing,
  reports: Reports,
  users: Users,
  notifications: Notifications,
  automations: Automations,
  settings: Settings,
};

/** `#inventory` → 'inventory' when it names a real module, else null. */
function moduleFromHash(): NavSection | null {
  const raw = window.location.hash.replace(/^#\/?/, '');
  return raw && (ALL_MODULES as string[]).includes(raw) ? (raw as NavSection) : null;
}

export default function App() {
  const { t } = useTranslation();
  const [ready, setReady] = useState(false);
  const user = useStore((s) => s.currentUser);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const logout = useStore((s) => s.logout);
  const active = useStore((s) => s.activeModule);
  const setActive = useStore((s) => s.setActiveModule);
  const locked = useStore((s) => s.locked);
  // Auto-lock the screen after the configured idle time (0 keeps it off).
  useIdleLock(!!user);

  // The browser tab carries the configured application name.
  const brandSettings = useLiveQuery(() => db.settings.toCollection().first(), []);
  useEffect(() => { document.title = appNameOf(brandSettings?.appName); }, [brandSettings?.appName]);

  useEffect(() => {
    seedDatabase()
      .then(() => generateNotifications())
      .catch((e) => console.error('ShopLogic: no se pudo inicializar la base de datos', e))
      .finally(() => setReady(true));
    // Retry the messages the relay could not deliver on the previous session.
    flushOutbox().catch(() => undefined);
    // Watch the service worker for new app versions (auto-install per Settings).
    initUpdateSystem().catch(() => undefined);
    // `sys_daily_backup`: one full snapshot per day, kept for a week.
    ensureDailySnapshot().catch(() => undefined);
    const iv = setInterval(() => { generateNotifications().catch(() => undefined); }, 60_000);
    return () => clearInterval(iv);
  }, []);

  // Back/forward and manual URL edits navigate the app; permissions still win.
  useEffect(() => {
    const onHash = () => {
      const m = moduleFromHash();
      if (!m || m === useStore.getState().activeModule) return;
      const u = useStore.getState().currentUser;
      if (u && !canAccess(u, m)) return;
      setActive(m);
    };
    window.addEventListener('hashchange', onHash);
    onHash();
    return () => window.removeEventListener('hashchange', onHash);
  }, [setActive]);

  // Keep the session in sync with the users table (permissions / active state changes apply instantly)
  const dbUser = useLiveQuery(() => (user ? db.users.get(user.id) : undefined), [user?.id]);
  useEffect(() => {
    if (!ready || !user || dbUser === undefined) return;
    if (!dbUser || !dbUser.isActive) { logout(); return; }
    const changed = dbUser.name !== user.name || dbUser.role !== user.role || dbUser.email !== user.email || dbUser.permissions.join() !== user.permissions.join();
    if (changed) setCurrentUser({ id: dbUser.id!, name: dbUser.name, email: dbUser.email, role: dbUser.role, permissions: dbUser.permissions });
  }, [dbUser, ready]);

  useEffect(() => {
    if (!user) return;
    if (!canAccess(user, active)) {
      const f = firstAccessible(user);
      if (f && f !== active) setActive(f);
    }
  }, [user, active]);

  let content: React.ReactNode;
  if (!ready) {
    content = <div className="p-6"><LoadingPage /></div>;
  } else if (!user) {
    content = <Login />;
  } else {
    const Mod = MODULES[active];
    content = (
      <Layout>
        {canAccess(user, active)
          ? <Suspense fallback={<LoadingPage />} key={active}><Mod /></Suspense>
          : <EmptyState icon="🔒" title={t('common.noAccess')} hint={t('common.noAccessHint')} />}
      </Layout>
    );
  }
  return (
    <>
      {content}
      {locked && user && <LockScreen />}
      <ToastContainer />
      <ConfirmDialog />
    </>
  );
}
