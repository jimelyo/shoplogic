import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { KeyRound, LogOut } from 'lucide-react';
import { db } from '../db/database';
import { verifyPassword } from '../lib/hash';
import { logAction } from '../lib/audit';
import { toast, useStore } from '../store/store';
import { Button, Input } from './shared/Forms';

/** Full-screen overlay shown while the session is locked. */
export function LockScreen() {
  const { t } = useTranslation();
  const user = useStore((s) => s.currentUser);
  const setLocked = useStore((s) => s.setLocked);
  const logout = useStore((s) => s.logout);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setBusy(true);
    try {
      const record = await db.users.get(user.id);
      const check = await verifyPassword(record?.password ?? '', password);
      if (!check.ok) { setError(t('auth.wrongPassword')); return; }
      setPassword('');
      setLocked(false);
      await logAction('login', 'auth', `${user.email} · ${t('auth.unlocked')}`);
      toast.success(`🔓 ${t('auth.unlocked')}`);
    } finally {
      setBusy(false);
    }
  };

  if (!user) return null;

  return (
    <div role="dialog" aria-modal="true" aria-label={t('auth.sessionLocked')}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-sl-bg/95 p-4 backdrop-blur-sm">
      <form onSubmit={submit} noValidate className="w-full max-w-sm space-y-4 rounded-2xl border border-sl-border bg-sl-card p-6 shadow-2xl animate-scale-in">
        <div className="text-center">
          <div className="mx-auto mb-3 flex size-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-fuchsia-500 text-2xl text-white shadow-xl shadow-primary/30">
            <KeyRound className="size-7" />
          </div>
          <h2 className="text-lg font-extrabold text-sl-text">{t('auth.sessionLocked')}</h2>
          <p className="mt-1 text-sm text-sl-muted">{t('auth.sessionLockedHint')}</p>
        </div>

        <div className="flex items-center gap-3 rounded-xl bg-sl-hover p-3">
          <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primary font-bold text-white">
            {user.name.charAt(0).toUpperCase()}
          </span>
          <span className="min-w-0 flex-1 truncate text-sm font-semibold text-sl-text">{user.name}</span>
        </div>

        <Input label={t('auth.password')} type="password" autoFocus autoComplete="current-password"
          value={password} onChange={(e) => setPassword(e.target.value)} error={error} />

        <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!password}>
          🔓 {t('auth.unlock')}
        </Button>
        <button type="button" onClick={() => { setLocked(false); logout(); }}
          className="flex w-full items-center justify-center gap-1.5 text-xs font-semibold text-sl-muted hover:text-red-500">
          <LogOut className="size-3.5 rtl-flip" /> {t('auth.logout')}
        </button>
      </form>
    </div>
  );
}
