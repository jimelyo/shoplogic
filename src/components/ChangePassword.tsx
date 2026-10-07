import { useState, type FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '../db/database';
import { hashPassword, verifyPassword } from '../lib/hash';
import { logAction } from '../lib/audit';
import { toast, useStore } from '../store/store';
import { Button, Input } from './shared/Forms';
import { Modal } from './shared/Modal';

const MIN_LENGTH = 6;

/** Lets the signed-in user change their own password (admins keep the full editor in Users). */
export function ChangePassword({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  const user = useStore((s) => s.currentUser);
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reset = () => { setCurrent(''); setNext(''); setRepeat(''); setError(''); };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setError('');
    setBusy(true);
    try {
      const record = await db.users.get(user.id);
      const check = await verifyPassword(record?.password ?? '', current);
      if (!check.ok) { setError(t('auth.wrongPassword')); return; }
      if (next.length < MIN_LENGTH) { setError(t('validation.min6')); return; }
      if (next !== repeat) { setError(t('auth.passwordMismatch')); return; }
      if (next === current) { setError(t('auth.passwordSame')); return; }

      await db.users.update(user.id, { password: await hashPassword(next) });
      await logAction('password_change', 'users', user.email);
      toast.success(`🔑 ${t('auth.passwordChanged')}`);
      reset();
      onClose();
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={() => { reset(); onClose(); }} size="sm" title={`🔑 ${t('auth.changePassword')}`}
      subtitle={user?.email}>
      <form onSubmit={submit} noValidate className="space-y-3">
        <Input label={t('auth.currentPassword')} type="password" autoComplete="current-password" autoFocus
          value={current} onChange={(e) => setCurrent(e.target.value)} />
        <Input label={t('auth.newPassword')} type="password" autoComplete="new-password" hint={t('auth.passwordMin')}
          value={next} onChange={(e) => setNext(e.target.value)} />
        <Input label={t('auth.repeatPassword')} type="password" autoComplete="new-password"
          value={repeat} onChange={(e) => setRepeat(e.target.value)} />
        {error && <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-300">❌ {error}</div>}
        <div className="flex justify-end gap-2 pt-1">
          <Button type="button" variant="secondary" onClick={() => { reset(); onClose(); }}>{t('common.cancel')}</Button>
          <Button type="submit" loading={busy} disabled={!current || !next || !repeat}>{t('common.save')}</Button>
        </div>
      </form>
    </Modal>
  );
}
