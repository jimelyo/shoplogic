import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Select, Toggle } from '../shared/Forms';
import { INTERVAL_OPTIONS, IS_DESKTOP, onUpdate, requestUpdateCheck, updatePrefs, applyUpdate, type UpdateSnapshot } from '../../lib/update';

/** Live status + controls of the app self-updater (service worker based). */
export function UpdateCard() {
  const { t } = useTranslation();
  const [snap, setSnap] = useState<UpdateSnapshot | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => onUpdate(setSnap), []);
  const [appVersion, setAppVersion] = useState<string | null>(null);
  useEffect(() => { if (IS_DESKTOP) void window.shoplogicDesktop?.getVersion().then(setAppVersion); }, []);
  if (!snap) return null;
  const readyToInstall = snap.state === 'updateReady' || snap.state === 'downloaded';
  const check = () => { setBusy(true); requestUpdateCheck(); setTimeout(() => setBusy(false), 800); };
  return (
    <div className="rounded-xl border border-sl-border bg-sl-hover/40 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs font-bold uppercase tracking-wide text-sl-muted">🔄 {t('settings.updTitle')}</div>
        <div className="flex gap-2">
          {readyToInstall && !snap.autoInstall && <Button size="sm" onClick={() => applyUpdate()}>{t('settings.updApply')}</Button>}
          <Button size="sm" variant="secondary" loading={busy} onClick={check}>{t('settings.updCheck')}</Button>
        </div>
      </div>
      <p className="mt-2 text-sm text-sl-muted">
        {readyToInstall ? <b className="text-sl-text">✨ {t('settings.updReady')}</b> : t('settings.updDesc')}
      </p>
      <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
        <div className="flex items-end pb-1">
          <Toggle checked={snap.autoInstall} onChange={(v) => updatePrefs.setAuto(v)} label={t('settings.updAuto')} />
        </div>
        <Select label={t('settings.updInterval')} value={String(snap.intervalSeconds)} onChange={(e) => updatePrefs.setInterval(Number(e.target.value))}>
          {INTERVAL_OPTIONS.map((o) => <option key={o.seconds} value={o.seconds}>{t(o.label)}</option>)}
        </Select>
      </div>
      <p className="mt-3 text-[11px] text-sl-muted">
        {t('settings.updHint')} · {t(`settings.updState_${snap.supported ? snap.state : 'unsupported'}`)}{appVersion ? ` · v${appVersion}` : ''}
      </p>
    </div>
  );
}
