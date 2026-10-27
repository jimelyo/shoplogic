import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Download, RotateCcw, Upload } from 'lucide-react';
import { db, TABLE_NAMES, type TableName } from '../../db/database';
import type { Settings as TSettings } from '../../types';
import { confirmDialog, toast } from '../../store/store';
import { logAction } from '../../lib/audit';
import { backupCounts, copyToExternal, downloadBackup, downloadFile, exportAll, externalBackupSupported, formatBytes, importBackup, inspectBackup, isBackupIntact, pickExternalDir, resetTables, tableCounts, type BackupData } from '../../lib/backup';
import { decryptBackup, encryptBackup, isEncryptedBackup } from '../../lib/backup-crypto';
import { exportTableCsv } from '../../lib/csv';
import { useStore } from '../../store/store';
import { canDo } from '../../lib/permissions';
import { Modal } from '../shared/Modal';
import { Card, SectionTitle } from '../shared/UI';
import { Button, Input, Toggle } from '../shared/Forms';

export function DataSection({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const [counts, setCounts] = useState<Record<TableName, number> | null>(null);
  const [lastExport, setLastExport] = useState<{ name: string; size: number } | null>(null);
  const [importData, setImportData] = useState<BackupData | null>(null);
  const [importName, setImportName] = useState('');
  const [resetSel, setResetSel] = useState<TableName[]>([]);
  const [busy, setBusy] = useState(false);
  // Cifrado opcional de backups (AES-GCM): contraseña al exportar / importar.
  const [encPassword, setEncPassword] = useState('');
  const [pendingEncrypted, setPendingEncrypted] = useState<{ name: string; text: string } | null>(null);
  const [digestValid, setDigestValid] = useState<boolean | null>(null);
  const me = useStore((s) => s.currentUser);
  const canExport = canDo(me, 'data.export');
  const canImport = canDo(me, 'data.import');
  const ext = form.externalBackup ?? { enabled: false };
  const supported = externalBackupSupported();
  const fileRef = useRef<HTMLInputElement>(null);
  const refresh = () => tableCounts().then(setCounts);
  useEffect(() => { refresh(); }, []);
  const resettable = TABLE_NAMES.filter((n) => n !== 'users');

  const doExport = async () => {
    if (!canExport) { toast.error(t('users.actionDenied')); return; }
    const b = await downloadBackup();
    let finalName = b.filename;
    let finalText = b.json;
    let size = b.size;
    if (encPassword.trim()) {
      const enc = await encryptBackup(b.json, encPassword);
      finalName = b.filename.replace(/\.json$/, '.encrypted.slcrypt');
      finalText = enc;
      size = new Blob([enc]).size;
      downloadFile(enc, finalName, 'text/plain');
      toast.success(`${t('settings.exportedEncrypted')} · ${formatBytes(size)}`);
    } else {
      toast.success(`${t('settings.exported')} · ${formatBytes(size)}`);
    }
    setLastExport({ name: finalName, size });
    await logAction('export', 'settings', `${finalName} (${formatBytes(size)})`);
    setEncPassword('');
  };
  const onFile = async (file?: File) => {
    if (!file) return;
    try {
      const text = await file.text();
      if (isEncryptedBackup(text)) {
        // Cifrado: pedir contraseña antes de descifrar e importar.
        setPendingEncrypted({ name: file.name, text });
        setImportData(null);
      } else {
        const info = await inspectBackup(text);
        setImportData(info.data); setImportName(file.name); setDigestValid(info.digestValid);
      }
    } catch { toast.error(t('settings.invalidFile')); }
    if (fileRef.current) fileRef.current.value = '';
  };
  const doImport = async () => {
    if (!importData) return;
    if (!canImport) { toast.error(t('users.actionDenied')); return; }
    if (digestValid === false) { toast.error(t('settings.backupDigestBad')); return; }
    if (!(await confirmDialog(t('settings.importConfirm1'), { danger: true, confirmLabel: t('common.continue') }))) return;
    if (!(await confirmDialog(t('settings.importConfirm2'), { danger: true, confirmLabel: t('settings.importNow') }))) return;
    setBusy(true);
    try {
      await importBackup(importData);
      await logAction('import', 'settings', importName);
      toast.success(t('settings.imported'));
      setImportData(null);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  const doReset = async () => {
    if (!resetSel.length) return;
    if (!canImport) { toast.error(t('users.actionDenied')); return; }
    if (!(await confirmDialog(t('settings.resetConfirm', { tables: resetSel.map((n) => t(`tables.${n}`)).join(', ') }), { danger: true, confirmLabel: t('settings.resetNow') }))) return;
    setBusy(true);
    try {
      const b = await downloadBackup('_auto_pre_reset');
      toast.info(`${t('settings.autoBackup')} · ${formatBytes(b.size)}`);
      await resetTables(resetSel);
      await logAction('reset', 'settings', resetSel.join(', '));
      toast.success(t('settings.resetDone'));
      setResetSel([]);
      refresh();
    } catch (e) { toast.error((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {renderExportCard()}
      {renderExtCard()}
      {renderImportCard()}
      {renderResetCard()}
      {renderCountsCard()}
      {renderModal()}
    </div>
  );

  function renderExportCard() {
    return (
      <Card className="p-5">
        <SectionTitle>📤 {t('settings.export')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.exportHint')}</p>
        <p className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">🔐 {t('settings.channelsWarn')}</p>
        <div className="mb-3 rounded-lg border border-sl-border bg-sl-card2 p-3">
          <div className="flex items-center gap-2 text-sm font-semibold text-sl-text">🔒 {t('settings.encBackupTitle')}</div>
          <Input label={t('settings.encBackupPassword')} type="password" value={encPassword} onChange={(e) => setEncPassword(e.target.value)} placeholder={t('settings.encBackupPlaceholder')} className="mt-2" hint={t('settings.encBackupHint')} autoComplete="new-password" />
        </div>
        <div className="flex flex-wrap gap-2">
          <Button icon={<Download />} onClick={doExport} disabled={!canExport}>{t('settings.exportJson')}</Button>
          {TABLE_NAMES.map((n) => (
            <Button key={n} size="sm" variant="ghost" disabled={!canExport} title={t('settings.exportCsvHint', { table: t(`tables.${n}`) })} onClick={async () => {
              const c = await exportTableCsv(n);
              await logAction('export', 'settings', `csv ${n} (${c})`);
              toast.success(`${t('settings.exportCsv')} · ${t(`tables.${n}`)} (${c})`);
            }}>{t('settings.exportCsv')} · {t(`tables.${n}`)}</Button>
          ))}
        </div>
        {lastExport && <p className="mt-2 text-xs text-sl-muted">✅ {lastExport.name} · <b>{formatBytes(lastExport.size)}</b></p>}
      </Card>
    );
  }

  function renderExtCard() {
    return (
      <Card className="p-5 lg:col-span-2">
        <SectionTitle right={<Toggle checked={ext.enabled} onChange={(v) => up({ externalBackup: { ...(form.externalBackup ?? {}), enabled: v } })} disabled={!supported} />}>☁️ {t('settings.extBackup')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{supported ? t('settings.extBackupHint') : t('settings.extBackupUnsupported')}</p>
        <div className={`grid gap-3 md:grid-cols-3 ${ext.enabled && supported ? '' : 'pointer-events-none opacity-50'}`}>
          <div className="rounded-lg border border-sl-border bg-sl-card2 px-3 py-2 text-sm">
            <div className="text-[10px] font-bold uppercase text-sl-muted">{t('settings.extBackupDir')}</div>
            <div className="truncate font-semibold text-sl-text">{ext.dir || '—'}</div>
          </div>
          <div className="rounded-lg border border-sl-border bg-sl-card2 px-3 py-2 text-sm">
            <div className="text-[10px] font-bold uppercase text-sl-muted">{t('settings.extBackupLast')}</div>
            <div className="font-semibold text-sl-text">{ext.lastAt ? new Date(ext.lastAt).toLocaleString() : '—'}</div>
          </div>
          <div className="flex items-end gap-2">
            <Button variant="outline" onClick={async () => {
              const r = await pickExternalDir();
              if (r) toast.success(`${t('settings.extBackupReady')} ${r.name}`);
            }}>📁 {t('settings.extBackupPick')}</Button>
            <Button variant="ghost" disabled={!canExport} onClick={async () => {
              const b = await exportAll('_external', { maskCredentials: true });
              try {
                let dir = ext.dir;
                if (!dir) { const picked = await pickExternalDir(); dir = picked?.name; }
                if (!dir) throw new Error('no-dir');
                const written = await copyToExternal(dir, { date: new Date().toISOString().slice(0, 10), json: b.json, size: b.size });
                up({ externalBackup: { ...(form.externalBackup ?? {}), enabled: true, dir, lastAt: new Date().toISOString(), lastSize: written } });
                toast.success(`${t('settings.extBackupDone')} · ${formatBytes(written)}`);
              } catch (e) { toast.error(String((e as Error).message)); }
            }}>{t('settings.extBackupNow')}</Button>
          </div>
        </div>
      </Card>
    );
  }

  function renderImportCard() {
    return (
      <Card className="p-5">
        <SectionTitle>📥 {t('settings.import')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.importHint')}</p>
        <input ref={fileRef} type="file" accept="application/json,.json,.slcrypt,text/plain" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
        <Button variant="outline" icon={<Upload />} disabled={!canImport} onClick={() => fileRef.current?.click()}>{t('settings.selectFile')}</Button>
        {pendingEncrypted && (
          <div className="mt-3 rounded-lg border border-primary/40 bg-primary/5 p-3">
            <p className="text-xs font-semibold text-primary">🔐 {t('settings.encryptedDetected', { name: pendingEncrypted.name })}</p>
            <Input label={t('settings.encBackupPassword')} type="password" autoFocus value={encPassword} onChange={(e) => setEncPassword(e.target.value)} className="mt-2" placeholder="••••••••" />
            <div className="mt-2 flex gap-2">
              <Button size="sm" loading={busy} onClick={async () => {
                setBusy(true);
                try {
                  const d = await decryptBackup(pendingEncrypted.text, encPassword);
                  setImportData(d); setImportName(pendingEncrypted.name); setDigestValid(await isBackupIntact(d));
                  setPendingEncrypted(null); setEncPassword('');
                } catch (e) {
                  toast.error(String((e as Error).message) === 'wrongpassword' ? t('settings.wrongPassword') : t('settings.invalidFile'));
                } finally { setBusy(false); }
              }}>{t('settings.unlockAndImport')}</Button>
              <Button size="sm" variant="ghost" onClick={() => { setPendingEncrypted(null); setEncPassword(''); }}>{t('common.cancel')}</Button>
            </div>
          </div>
        )}
        {importName && importData && <p className="mt-2 text-xs text-sl-muted">✅ {importName}</p>}
      </Card>
    );
  }

  function renderResetCard() {
    return (
      <Card className="p-5">
        <SectionTitle right={<div className="flex gap-1"><Button size="sm" variant="ghost" onClick={() => setResetSel([...resettable])}>{t('settings.selectAll')}</Button><Button size="sm" variant="ghost" onClick={() => setResetSel([])}>{t('settings.deselectAll')}</Button></div>}>🗑️ {t('settings.reset')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">{t('settings.resetHint')}</p>
        <div className="grid grid-cols-2 gap-2">
          {TABLE_NAMES.map((n) => {
            const locked = n === 'users';
            const on = resetSel.includes(n);
            return (
              <button key={n} type="button" disabled={locked} onClick={() => setResetSel(on ? resetSel.filter((x) => x !== n) : [...resetSel, n])}
                className={`flex items-center justify-between rounded-lg border px-3 py-2 text-start text-xs font-semibold ${locked ? 'cursor-not-allowed border-sl-border opacity-50' : on ? 'border-red-500/60 bg-red-500/10 text-red-600 dark:text-red-300' : 'border-sl-border text-sl-text hover:border-red-500/40'}`}>
                <span>{locked ? '🔒' : on ? '☑️' : '⬜'} {t(`tables.${n}`)}</span>
                <span className="text-sl-muted">{counts?.[n] ?? '…'}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 text-[11px] text-sl-muted">🔒 {t('settings.usersProtected')}</p>
        <Button className="mt-3" variant="danger" icon={<RotateCcw />} disabled={!resetSel.length} loading={busy} onClick={doReset}>{t('settings.resetNow')} ({resetSel.length})</Button>
      </Card>
    );
  }

  function renderCountsCard() {
    return (
      <Card className="p-5">
        <SectionTitle right={<Button size="sm" variant="ghost" onClick={refresh} aria-label={t('common.refresh')}>↻</Button>}>📊 {t('settings.currentState')}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {TABLE_NAMES.map((n) => (
            <div key={n} className="rounded-lg border border-sl-border bg-sl-card2 p-2.5">
              <div className="text-[10px] font-bold uppercase text-sl-muted">{t(`tables.${n}`)}</div>
              <div className="text-lg font-bold text-sl-text">{counts?.[n] ?? '…'}</div>
            </div>
          ))}
        </div>
        <p className="mt-2 text-xs text-sl-muted">{t('settings.totalRecords')}: <b>{counts ? Object.values(counts).reduce((a, b) => a + b, 0) : '…'}</b> · IndexedDB (100% local)</p>
      </Card>
    );
  }

  function renderModal() {
    return (
      <Modal open={!!importData} onClose={() => setImportData(null)} title={`📥 ${t('settings.importPreview')}`} subtitle={importName}
        footer={<><Button variant="secondary" onClick={() => setImportData(null)}>{t('common.cancel')}</Button><Button variant="danger" loading={busy} disabled={digestValid === false || !canImport} onClick={doImport}>{t('settings.importNow')}</Button></>}>
        {importData && (
          <div className="space-y-3">
            {importData._meta && <p className="text-xs text-sl-muted">📅 {importData._meta.exportedAt}{importData._meta.tables ? ` · ${importData._meta.tables} ${t('settings.backupTables')}` : ''}</p>}
            <p className={`rounded-lg border px-3 py-2 text-xs font-semibold ${digestValid === false ? 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-300' : digestValid ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300' : 'border-sl-border bg-sl-card2 text-sl-muted'}`}>
              {digestValid === false ? `❌ ${t('settings.backupDigestBad')}` : digestValid ? `✅ ${t('settings.backupDigestOk')}` : `ℹ️ ${t('settings.backupDigestNone')}`}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {Object.entries(backupCounts(importData)).map(([k, v]) => (
                <div key={k} className={`flex justify-between rounded-lg border px-3 py-2 text-sm ${k === 'users' ? 'border-sl-border opacity-50' : 'border-sl-border'}`}>
                  <span>{k === 'users' ? '🔒 ' : ''}{t(`tables.${k}`)}</span><b>{v}</b>
                </div>
              ))}
            </div>
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">⚠️ {t('settings.importWarning')}</div>
          </div>
        )}
      </Modal>
    );
  }
}
