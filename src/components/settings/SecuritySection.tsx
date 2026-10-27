import { useTranslation } from 'react-i18next';
import type { Settings as TSettings } from '../../types';
import { Card, SectionTitle } from '../shared/UI';
import { Button, Input } from '../shared/Forms';

export function SecuritySection({ form, up, openPw }: { form: TSettings; up: (patch: Partial<TSettings>) => void; openPw: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="p-5">
      <SectionTitle>🔐 {t('settings.s_security')}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label={t('settings.lockAfterMinutes')} type="number" min="0" step="1"
          value={form.lockAfterMinutes ?? 0}
          onChange={(e) => up({ lockAfterMinutes: Math.max(0, Math.min(480, Number(e.target.value) || 0)) })}
          hint={t('settings.lockAfterHint')} />
        <div className="flex items-end">
          <Button variant="secondary" className="w-full" onClick={openPw}>🔑 {t('auth.changePassword')}</Button>
        </div>
      </div>
      <div className="mt-4 rounded-lg bg-sl-hover p-3 text-sm text-sl-muted">🛡️ {t('settings.securityNote')}</div>
    </Card>
  );
}
