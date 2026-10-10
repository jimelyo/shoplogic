import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock } from 'lucide-react';
import { db } from '../db/database';
import { useStore } from '../store/store';
import type { User } from '../types';
import { hashPassword, verifyPassword } from '../lib/hash';
import { logAction } from '../lib/audit';
import { Button, Input } from './shared/Forms';
import { LanguageSelector } from './shared/LanguageSelector';
import { ThemeMenu } from './Layout';
import { firstAccessible } from '../lib/permissions';
import { appNameOf, BrandMark } from './shared/Brand';
import { ROLE_ICONS } from '../types';
import { useFormat } from '../lib/format';

export function Login() {
  const { t } = useTranslation();
  const f = useFormat();
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  /** Active users, sorted alphabetically — the picker's source of truth. */
  const users = useLiveQuery(() =>
    db.users.filter((u) => u.isActive).sortBy('name'), [],
  ) as User[] | undefined;
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const setActiveModule = useStore((s) => s.setActiveModule);
  /** Which user account is selected for sign-in (`null` until one is picked). */
  const [selected, setSelected] = useState<User | null>(null);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    setError('');
    if (!password) { setError(t('validation.required')); return; }
    setLoading(true);
    try {
      const check = await verifyPassword(selected.password, password);
      if (!check.ok) { setError(t('auth.invalid')); return; }
      const lastLogin = new Date().toISOString();
      // Upgrade hashes written by older versions once the password is known to be right.
      const patch = check.needsRehash ? { lastLogin, password: await hashPassword(password) } : { lastLogin };
      await db.users.update(selected.id!, patch);
      const session = { id: selected.id!, name: selected.name, email: selected.email, role: selected.role, permissions: selected.permissions };
      setCurrentUser(session);
      const first = firstAccessible(session);
      if (first) setActiveModule(first === 'dashboard' || !session.permissions.includes(useStore.getState().activeModule) ? first : useStore.getState().activeModule);
      await logAction('login', 'auth', selected.email);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-sl-bg p-4">
      <div className="pointer-events-none absolute -start-24 -top-24 size-96 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 -end-24 size-[28rem] rounded-full bg-fuchsia-500/15 blur-3xl" />
      <div className="absolute end-4 top-4"><ThemeMenu /></div>
      <div className="relative w-full max-w-md animate-scale-in">
        <div className="mb-6 text-center">
          <BrandMark logo={settings?.logo} className="mx-auto mb-3 size-16 rounded-2xl shadow-xl shadow-primary/30" emojiClass="text-3xl" />
          <h1 className="text-3xl font-extrabold tracking-tight text-sl-text">{appNameOf(settings?.appName)}</h1>
          <p className="mt-1 text-sm text-sl-muted">{t('auth.tagline')}</p>
        </div>
        <form onSubmit={submit} noValidate className="space-y-4 rounded-2xl border border-sl-border bg-sl-card p-6 shadow-xl">
          {!users ? null : selected ? (
            <>
              <div className="flex items-center gap-3">
                <button type="button" onClick={() => { setSelected(null); setPassword(''); setError(''); }}
                  title={t('common.close')}
                  className="rounded-lg p-2 text-sl-muted hover:bg-sl-hover hover:text-sl-text"> ←</button>
                <div className="flex size-12 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-lg font-bold text-white shadow-lg shadow-primary/25">
                  {selected.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-base font-bold text-sl-text">{selected.name}</div>
                  <div className="text-xs text-sl-muted">{ROLE_ICONS[selected.role]} {t(`roles.${selected.role}`)}</div>
                </div>
              </div>
              <Input label={t('auth.password')} type="password" autoComplete="current-password" autoFocus icon={<Lock />} placeholder="••••••••"
                value={password} onChange={(e) => setPassword(e.target.value)} error={error} />
              {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">❌ {error}</div>}
              <Button type="submit" size="lg" className="w-full" loading={loading}>{t('auth.login')}</Button>
            </>
          ) : (
            <>
              <div>
                <h2 className="text-lg font-bold text-sl-text">{t('auth.title')}</h2>
                <p className="text-sm text-sl-muted">{t('auth.subtitle')}</p>
              </div>
              <div className="grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3">
                {users.filter((u) => u.isActive).map((u) => (
                  <button key={u.id} type="button" onClick={() => { setSelected(u); setError(''); }}
                    className="flex flex-col items-center gap-1.5 rounded-xl border border-sl-border bg-sl-card2 p-3 text-center hover:border-primary/50 hover:bg-primary/5 active:scale-95">
                    <span className="flex size-11 items-center justify-center rounded-full bg-gradient-to-br from-primary to-fuchsia-500 text-base font-bold text-white shadow-md shadow-primary/20">
                      {u.name.charAt(0).toUpperCase()}
                    </span>
                    <span className="w-full truncate text-xs font-semibold text-sl-text">{u.name.split(' ')[0]}</span>
                    <span className="text-[10px] text-sl-muted">{ROLE_ICONS[u.role]} {t(`roles.${u.role}`)}</span>
                  </button>
                ))}
              </div>
            </>
          )}
        </form>
        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-sl-muted">
          <span>🌍 {t('auth.language')}</span>
          <LanguageSelector direction="up" />
        </div>
      </div>
    </div>
  );
}