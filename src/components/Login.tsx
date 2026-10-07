import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { useLiveQuery } from 'dexie-react-hooks';
import { Lock, Mail } from 'lucide-react';
import { db } from '../db/database';
import { useStore } from '../store/store';
import { loginSchema, validateForm, type FormErrors } from '../schemas';
import { hashPassword, verifyPassword } from '../lib/hash';
import { logAction } from '../lib/audit';
import { Button, Input } from './shared/Forms';
import { LanguageSelector } from './shared/LanguageSelector';
import { ThemeMenu } from './Layout';
import { firstAccessible } from '../lib/permissions';
import { appNameOf, BrandMark } from './shared/Brand';

export function Login() {
  const { t } = useTranslation();
  const settings = useLiveQuery(() => db.settings.toCollection().first(), []);
  const setCurrentUser = useStore((s) => s.setCurrentUser);
  const setActiveModule = useStore((s) => s.setActiveModule);
  const [form, setForm] = useState({ email: '', password: '' });
  const [errors, setErrors] = useState<FormErrors>({});
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    const r = validateForm(loginSchema, form);
    setErrors(r.errors);
    if (!r.success) return;
    setLoading(true);
    try {
      const user = await db.users.where('email').equalsIgnoreCase(r.data.email).first();
      if (!user) { setError(t('auth.invalid')); return; }
      const check = await verifyPassword(user.password, r.data.password);
      if (!check.ok) { setError(t('auth.invalid')); return; }
      if (!user.isActive) { setError(t('auth.inactive')); return; }
      const lastLogin = new Date().toISOString();
      // Upgrade hashes written by older versions once the password is known to be right.
      const patch = check.needsRehash ? { lastLogin, password: await hashPassword(r.data.password) } : { lastLogin };
      await db.users.update(user.id!, patch);
      const session = { id: user.id!, name: user.name, email: user.email, role: user.role, permissions: user.permissions };
      setCurrentUser(session);
      const first = firstAccessible(session);
      if (first) setActiveModule(first === 'dashboard' || !session.permissions.includes(useStore.getState().activeModule) ? first : useStore.getState().activeModule);
      await logAction('login', 'auth', user.email);
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
          <div>
            <h2 className="text-lg font-bold text-sl-text">{t('auth.title')}</h2>
            <p className="text-sm text-sl-muted">{t('auth.subtitle')}</p>
          </div>
          <Input label={t('auth.email')} type="email" autoComplete="username" icon={<Mail />} placeholder="admin@shoplogic.com"
            value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} error={errors.email} />
          <Input label={t('auth.password')} type="password" autoComplete="current-password" icon={<Lock />} placeholder="••••••••"
            value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} error={errors.password} />
          {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">❌ {error}</div>}
          <Button type="submit" size="lg" className="w-full" loading={loading}>{t('auth.login')}</Button>
          <p className="rounded-lg bg-sl-hover px-3 py-2 text-center text-[11px] text-sl-muted">{t('auth.demoHint')}</p>
        </form>
        <div className="mt-5 flex items-center justify-center gap-3 text-xs text-sl-muted">
          <span>🌍 {t('auth.language')}</span>
          <LanguageSelector direction="up" />
        </div>
      </div>
    </div>
  );
}