import { useTranslation } from 'react-i18next';
import type { ChangeEvent } from 'react';
import type { Settings as TSettings } from '../../types';
import { toast } from '../../store/store';
import { Button, Input } from '../shared/Forms';
import { Card, SectionTitle } from '../shared/UI';
import { BrandMark } from '../shared/Brand';
import { fileToLogoDataUrl } from '../../lib/image';
import { Upload } from 'lucide-react';
import { useRef } from 'react';

export function StoreSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const logoRef = useRef<HTMLInputElement>(null);
  /** Reads the picked image, downscales it to a 256 px PNG and stages it in the form. */
  const onLogoFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error(t('settings.logoInvalid')); return; }
    try { up({ logo: await fileToLogoDataUrl(file) }); }
    catch { toast.error(t('settings.logoInvalid')); }
  };
  return (
    <Card className="p-5">
      <SectionTitle>🏪 {t('settings.s_store')}</SectionTitle>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input label={t('settings.storeName')} requiredMark value={form.storeName} onChange={(e) => up({ storeName: e.target.value })} />
        <Input label={t('settings.cif')} value={form.cif} onChange={(e) => up({ cif: e.target.value })} />
        <div className="md:col-span-2"><Input label={t('common.address')} value={form.address} onChange={(e) => up({ address: e.target.value })} /></div>
        <Input label={t('common.phone')} value={form.phone} onChange={(e) => up({ phone: e.target.value })} />
        <Input label={t('common.email')} type="email" value={form.email} onChange={(e) => up({ email: e.target.value })} />
        <Input label={t('settings.appName')} value={form.appName ?? ''} onChange={(e) => up({ appName: e.target.value })} hint={t('settings.appNameHint')} />
      </div>
      <div className="mt-3 flex items-center gap-3 rounded-lg border border-sl-border p-3">
        <BrandMark logo={form.logo} className="size-16 shrink-0 rounded-xl border border-sl-border bg-sl-card" emojiClass="text-2xl" />
        <div className="min-w-0 flex-1">
          <div className="text-xs font-semibold text-sl-muted">{t('settings.logo')}</div>
          <div className="mt-1.5 flex flex-wrap gap-2">
            <Button size="sm" variant="secondary" icon={<Upload />} onClick={() => logoRef.current?.click()}>{t('settings.uploadLogo')}</Button>
            {form.logo && <Button size="sm" variant="ghost" onClick={() => up({ logo: undefined })}>{t('settings.removeLogo')}</Button>}
          </div>
          <p className="mt-1 text-[11px] text-sl-muted">{t('settings.logoHint')}</p>
        </div>
        <input ref={logoRef} type="file" accept="image/*" className="hidden" onChange={(e) => { void onLogoFile(e); }} />
      </div>
    </Card>
  );
}
