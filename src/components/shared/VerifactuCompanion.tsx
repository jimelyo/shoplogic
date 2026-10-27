/**
 * VERI*FACTU Companion — asistente guiado (complemento del módulo fiscal).
 *
 * Cuatro pasos, cada uno reutilizando el módulo validado de `src/verifactu/`:
 *
 *  1. 🪪 CERTIFICADO  (.p12): selección del fichero + validación de la
 *     contraseña y escritura segura de `signer.json`. Todo ocurre en el
 *     proceso MAIN de Electron por IPC; el renderer nunca ve la contraseña
 *     ni la clave privada.
 *  2. 🩺 DIAGNÓSTICO: conteo de la cola por estado, auditoría de la cadena
 *     de huellas y prueba de conexión real contra el endpoint del entorno.
 *  3. ⚠️ INCIDENCIAS: rechazados / aceptados con errores, visor del XML de
 *     respuesta SOAP de la AEAT y reintentos individual/masivo. Los registros
 *     remitidos NUNCA se editan: la cadena local es inmutable.
 *  4. 📜 DECLARACIÓN RESPONSABLE: datos del fabricante del SIF
 *     (settings.verifactuConfig.system) + documento exportable.
 */

import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../store/store';
import { logAction } from '../../lib/audit';
import { downloadFile } from '../../lib/backup';
import { IS_DESKTOP } from '../../lib/update';
import { Badge, Card, SectionTitle } from './UI';
import { Button, Input, Select } from './Forms';
import { Modal } from './Modal';
import {
  CERT_EXPIRING_WARNING_DAYS,
  companionBridge,
  certValidity,
  declaracionFilename,
  declaracionIssues,
  declaracionResponsableHtml,
  daysLeftTo,
  queueStats,
} from '../../verifactu/companion';
import type { ConnectionTestResult, Pkcs12PublicInfo, SignerDetail } from '../../verifactu/companion';
import {
  discardEntry,
  getQueueTable,
  MAX_QUEUE_ATTEMPTS,
  requeueRejected,
  retryEntryNow,
} from '../../verifactu/queue';
import type { QueueEntry } from '../../verifactu/queue';
import { verifyChain } from '../../verifactu/audit';
import { SOAP_ENDPOINTS, WSDL } from '../../verifactu/aeat-soap';
import { DEFAULT_FISCAL_CONFIG } from '../../verifactu/service';
import { ESTADO_ICON } from './fiscalIcons';
import type { AeatEnvironment, RegistroEstado, SistemaInformaticoSpec } from '../../verifactu/fiscal-types';
import type { Settings as TSettings } from '../../types';

type Step = 'cert' | 'diagnostic' | 'incidents' | 'declaracion';

const STEPS: { id: Step; icon: string; label: string }[] = [
  { id: 'cert', icon: '🪪', label: 'Certificado' },
  { id: 'diagnostic', icon: '🩺', label: 'Diagnóstico' },
  { id: 'incidents', icon: '⚠️', label: 'Incidencias' },
  { id: 'declaracion', icon: '📜', label: 'Declaración responsable' },
];

const STATE_COLOR: Record<RegistroEstado, 'green' | 'amber' | 'red' | 'slate' | 'blue'> = {
  PERSISTED: 'slate', QUEUED: 'blue', SENDING: 'amber', ACCEPTED: 'green',
  ACCEPTED_WITH_ERRORS: 'amber', REJECTED: 'red', RETRY_PENDING: 'amber',
};

export function VerifactuCompanion({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>('cert');
  const [detail, setDetail] = useState<SignerDetail | null>(null);
  const bridge = companionBridge();
  const env: AeatEnvironment = form.verifactuConfig?.environment ?? 'test';

  const refreshDetail = async () => {
    if (!bridge?.verifactuSignerDetail) return;
    try { setDetail(await bridge.verifactuSignerDetail()); } catch { /* main no disponible */ }
  };

  useEffect(() => {
    void refreshDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <SectionTitle right={<Badge color={env === 'production' ? 'red' : 'blue'}>{env === 'production' ? '🟢 producción' : '🧪 pruebas'}</Badge>}>
          🧙 {t('vfComp.title', 'VERI*FACTU Companion')}
        </SectionTitle>
        <p className="text-sm text-sl-muted">
          {t('vfComp.subtitle', 'Asistente de instalación del certificado, diagnóstico de la cola de remisión y resolución de incidencias fiscales (RD 1007/2023 · Orden HAC/1177/2024).')}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {STEPS.map((s) => (
            <button key={s.id} type="button" onClick={() => setStep(s.id)}
              className={`inline-flex items-center gap-2 rounded-xl border px-3.5 py-2 text-sm font-semibold ${step === s.id ? 'border-primary bg-primary text-white shadow shadow-primary/30' : 'border-sl-border bg-sl-card text-sl-text hover:border-primary/40'}`}>
              <span>{s.icon}</span>{s.label}
            </button>
          ))}
        </div>
      </Card>

      {step === 'cert' && <CertificateStep detail={detail} onRefresh={refreshDetail} />}
      {step === 'diagnostic' && <DiagnosticStep env={env} />}
      {step === 'incidents' && <IncidentsStep />}
      {step === 'declaracion' && <DeclaracionStep form={form} up={up} />}

      <p className="text-center text-[11px] text-sl-muted">
        🔒 {t('vfComp.securityNote', 'La contraseña del certificado viaja solo por IPC al proceso main de Electron y nunca se guarda en la interfaz, en IndexedDB ni en el almacenamiento del navegador.')}
      </p>
    </div>
  );
}

// --- 1. Certificado -----------------------------------------------------------

function CertificateStep({ detail, onRefresh }: { detail: SignerDetail | null; onRefresh: () => void }) {
  const { t } = useTranslation();
  const [password, setPassword] = useState('');
  const [cert, setCert] = useState<Pkcs12PublicInfo | null>(null);
  const [busy, setBusy] = useState<'' | 'pick' | 'validate' | 'install'>('');
  const bridge = companionBridge();
  const desktopReady = Boolean(bridge?.verifactuPickP12 && bridge?.verifactuValidateP12 && bridge?.verifactuInstallP12);
  const validity = detail ? certValidity(detail) : 'unknown';
  const days = detail?.notAfter ? daysLeftTo(detail.notAfter) : null;

  const pick = async () => {
    if (!bridge?.verifactuPickP12) return;
    setBusy('pick');
    try {
      const r = await bridge.verifactuPickP12();
      if (r.canceled) return;
      setCert(null);
      setPassword('');
      toast.success(t('vfComp.certCopied', 'Certificado copiado al almacén local de la app.'));
      onRefresh();
      await logAction('update', 'verifactu', `p12 importado (${r.originalName ?? 'cert.p12'})`);
    } finally { setBusy(''); }
  };

  const validate = async () => {
    if (!bridge?.verifactuValidateP12) return;
    setBusy('validate');
    try {
      const info = await bridge.verifactuValidateP12(password);
      setCert(info);
      if (info.ok) toast.success(t('vfComp.certOk', 'Contraseña correcta: certificado válido.'));
      else toast.error(t('vfComp.certBad', info.error ?? 'No se pudo validar el certificado.'));
    } finally { setBusy(''); }
  };

  const install = async () => {
    if (!bridge?.verifactuInstallP12) return;
    setBusy('install');
    try {
      const r = await bridge.verifactuInstallP12(password);
      if (r.ok) {
        toast.success(t('vfComp.installed', 'Firmador instalado. Los envíos de la cola ya pueden firmarse con XAdES.'));
        setPassword('');
        setCert(null);
        onRefresh();
        await logAction('update', 'verifactu', 'signer.json configurado desde el asistente');
      } else toast.error(r.error ?? t('vfComp.installFail', 'No se pudo instalar el firmador.'));
    } finally { setBusy(''); }
  };

  const validateOk = cert?.ok === true;
  const sched = detail?.configured && validity !== 'unknown';

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle>🪪 {t('vfComp.certTitle', 'Certificado del obligado (.p12)')}</SectionTitle>
        {!desktopReady ? (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {t('vfComp.desktopOnly', 'La gestión guiada del certificado requiere la app de escritorio (ShopLogic Pro para Windows). En un navegador puedes copiar el .p12 manualmente a userData/verifactu/ y crear signer.json con { p12Path, p12Password }.')}
          </div>
        ) : (
          <div className="grid gap-3">
            <p className="text-sm text-sl-muted">
              {t('vfComp.certHint', 'Selecciona el fichero .p12/.pfx del certificado electrónico cualificado del obligado. La app copia el fichero a su almacén local y valida la contraseña en el proceso main (nunca en la interfaz).')}
            </p>
            <Button variant="secondary" loading={busy === 'pick'} onClick={() => { void pick(); }}>📁 {t('vfComp.certPick', 'Seleccionar certificado')}</Button>
            <Input
              label={t('vfComp.certPassword', 'Contraseña del certificado')}
              type="password"
              value={password}
              autoComplete="off"
              onChange={(e) => { setPassword(e.target.value); setCert(null); }}
              hint={t('vfComp.certPasswordHint', 'Se envía por IPC al main y se descarta tras validar/instalar.')}
              className="max-w-xs"
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" disabled={!password || busy !== ''} loading={busy === 'validate'} onClick={() => { void validate(); }}>🔍 {t('vfComp.certValidate', 'Validar contraseña')}</Button>
              <Button variant="success" disabled={!validateOk || busy !== ''} loading={busy === 'install'} onClick={() => { void install(); }}>💾 {t('vfComp.certInstall', 'Instalar firmador')}</Button>
            </div>
            {cert?.ok && (
              <dl className="grid gap-1 rounded-lg border border-sl-border bg-sl-hover/60 p-3 text-xs">
                <dt className="font-bold uppercase text-sl-muted">{t('vfComp.certData', 'Datos públicos del certificado (la clave privada no sale del main)')}</dt>
                <Row k="CN" v={cert.subjectCN} />
                <Row k={t('vfComp.issuer', 'Emisor')} v={cert.issuerCN} />
                <Row k={t('vfComp.org', 'Organización')} v={cert.organization || cert.organizationIdentifier || cert.serialNumber} />
                <Row k={t('vfComp.validFrom', 'Válido desde')} v={cert.notBefore ? new Date(cert.notBefore).toLocaleDateString() : '—'} />
                <Row k={t('vfComp.validTo', 'Válido hasta')} v={cert.notAfter ? new Date(cert.notAfter).toLocaleDateString() : '—'} />
              </dl>
            )}
          </div>
        )}
      </Card>

      <Card className="p-5">
        <SectionTitle right={sched && (
          <Badge color={validity === 'valid' ? 'green' : validity === 'expiring' ? 'amber' : validity === 'expired' ? 'red' : 'slate'}>
            {validity === 'valid' ? `✅ ${t('vfComp.certValid', 'válido')}` : validity === 'expiring' ? `⚠️ ${t('vfComp.certExpiring', 'caduca en {{n}} días', { n: days ?? '—' })}` : validity === 'expired' ? `⛔ ${t('vfComp.certExpired', 'caducado')}` : `❔ ${t('vfComp.certUnknown', 'sin fecha')}`}
          </Badge>
        )}>
          🧰 {t('vfComp.signerState', 'Estado del firmador')}
        </SectionTitle>
        {!detail ? (
          <p className="text-xs text-sl-muted">{t('vfComp.signerUnknown', 'No se pudo leer el estado del firmador (¿no es la app de escritorio?).')}</p>
        ) : !detail.configured ? (
          <div className="space-y-2 text-sm text-sl-muted">
            <p>❌ {t('vfComp.signerNotConfigured', 'El firmador no está configurado todavía: sigue el paso anterior y los envíos de la cola quedan encolados sin firmar.')}</p>
            {detail.certCopied && <p className="text-[11px]">✅ {t('vfComp.certAlreadyCopied', 'Ya hay un .p12 copiado; falta validar la contraseña e instalar.')}</p>}
            <p className="break-all font-mono text-[10px]">{detail.configPath}</p>
          </div>
        ) : (
          <dl className="grid gap-1 text-xs">
            <Row k={t('vfComp.status', 'Estado')} v={detail.error ? `⚠️ ${detail.error}` : '✅ configurado'} />
            <Row k="CN" v={detail.subjectCN} />
            <Row k={t('vfComp.issuer', 'Emisor')} v={detail.issuerCN} />
            <Row k={t('vfComp.validTo', 'Caduca')} v={detail.notAfter ? `${new Date(detail.notAfter).toLocaleDateString()}${days !== null ? ` (${days} d)` : ''}` : '—'} />
            <Row k="p12" v={detail.p12Path ?? detail.certPath} />
            <Row k={t('vfComp.passwordSet', 'Contraseña registrada')} v={detail.p12PasswordSet ? '✅' : '❌'} />
            {detail.notAfter && days !== null && days <= CERT_EXPIRING_WARNING_DAYS && (
              <dt className="rounded border border-amber-500/40 bg-amber-500/10 px-2 py-1 text-amber-700 dark:text-amber-300">
                ⚠️ {t('vfComp.expiryWarning', 'El certificado caduca pronto: renuévalo con tu emisor e instala el nuevo antes de vencer. La cola sigue enviando mientras sea válido.')}
              </dt>
            )}
          </dl>
        )}
        <p className="mt-3 text-[11px] text-sl-muted">
          {t('vfComp.signerPathNote', 'Fichero de configuración: %APPDATA%/ShopLogic Pro/verifactu/signer.json (modo 0600) escrito por el proceso principal.')}
        </p>
      </Card>
    </div>
  );
}

function Row({ k, v }: { k: string; v?: string | boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span className="w-40 shrink-0 font-semibold text-sl-muted">{k}</span>
      <span className="min-w-0 flex-1 break-all text-sl-text">{typeof v === 'boolean' ? (v ? '✅' : '❌') : v || '—'}</span>
    </div>
  );
}

// --- 2. Diagnóstico ------------------------------------------------------------

function DiagnosticStep({ env }: { env: AeatEnvironment }) {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ReturnType<typeof queueStats> | null>(null);
  const [broken, setBroken] = useState<string | null>(null);
  const [audited, setAudited] = useState(0);
  const [envToTest, setEnvToTest] = useState<AeatEnvironment>(env);
  const [testResult, setTestResult] = useState<ConnectionTestResult | null>(null);
  const [testing, setTesting] = useState(false);
  const bridge = companionBridge();

  const refresh = async () => {
    const list = await getQueueTable().toArray();
    setStats(queueStats(list));
    const audit = await verifyChain();
    setBroken(audit.brokenAt);
    setAudited(audit.checked);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      await new Promise((r) => setTimeout(r, 0));
      if (alive) await refresh().catch((e) => console.error(e));
    })();
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [env]);

  const runTest = async () => {
    if (!bridge?.verifactuTestConnection) return;
    setTesting(true);
    setTestResult(null);
    try {
      const r = await bridge.verifactuTestConnection(envToTest);
      setTestResult(r);
      await logAction('test', 'verifactu', `conexión ${envToTest}: ${r.ok ? `HTTP ${r.status} · ${r.ms} ms` : r.error}`);
    } finally { setTesting(false); }
  };

  const states = stats ? (Object.entries(stats.counts) as [RegistroEstado, number][]) : [];

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-5">
        <SectionTitle right={<Button size="sm" variant="outline" aria-label={t('common.refresh')} onClick={() => { void refresh(); }}>↺</Button>}>
          🩺 {t('vfComp.queueTitle', 'Cola de remisión a la AEAT')}
        </SectionTitle>
        {!stats ? (
          <p className="text-xs text-sl-muted">…</p>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {states.map(([s, n]) => (
                <div key={s} className="flex items-center justify-between rounded-lg border border-sl-border bg-sl-hover/40 px-2.5 py-2 text-xs">
                  <span className="font-semibold text-sl-muted">{ESTADO_ICON[s] ?? '·'} {s}</span>
                  <Badge color={STATE_COLOR[s]}>{n}</Badge>
                </div>
              ))}
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Badge color="slate">{t('vfComp.total', 'Total')}: {stats.total}</Badge>
              <Badge color="blue">{t('vfComp.pending', 'Pendientes')}: {stats.pending}</Badge>
              <Badge color={stats.incidents ? 'red' : 'green'}>{t('vfComp.incidents', 'Incidencias')}: {stats.incidents}</Badge>
            </div>
            <p className="mt-3 text-[11px] text-sl-muted">
              ⏱️ {t('vfComp.backoff', 'Reintentos automáticos con backoff 15 s → 1 min → 10 min → 1 h; los registros colgados en SENDING se recuperan al arrancar recoverQueue(). El TPV nunca bloquea: la venta se completa aunque AEAT esté caída (patrón outbox).')}
            </p>
          </>
        )}
        <div className="mt-4 border-t border-sl-border pt-3">
          {broken ? (
            <p className="rounded bg-red-500/10 px-3 py-2 text-xs text-red-600 dark:text-red-300">⚠️ {t('settings.vfBroken', { number: broken })}</p>
          ) : (
            <p className="text-xs text-sl-muted">🔗 {t('settings.vfChainOk', { n: audited })}</p>
          )}
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>🌐 {t('vfComp.connTitle', 'Prueba de conexión')}</SectionTitle>
        <div className="grid gap-3">
          <Select label={t('vfComp.connEnv', 'Entorno de la prueba')} value={envToTest} onChange={(e) => { setEnvToTest(e.target.value as AeatEnvironment); setTestResult(null); }}>
            <option value="test">🧪 Pruebas — prewww1.aeat.es (preproducción)</option>
            <option value="production">🟢 Producción — www1.agenciatributaria.gob.es</option>
          </Select>
          <p className="break-all rounded bg-sl-hover px-2 py-1.5 font-mono text-[10px] text-sl-muted">
            WSDL: {WSDL[envToTest]}<br />SOAP: {SOAP_ENDPOINTS[envToTest]}
          </p>
          {bridge?.verifactuTestConnection ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button variant="outline" loading={testing} onClick={() => { void runTest(); }}>📡 {t('vfComp.connTest', 'Probar conexión')}</Button>
              {testResult && (
                <Badge color={testResult.ok && testResult.looksLikeWsdl !== false ? 'green' : 'red'}>
                  {testResult.ok
                    ? `✅ HTTP ${testResult.status ?? 200} · ${testResult.ms ?? '—'} ms${testResult.looksLikeWsdl ? ' · WSDL OK' : ''}`
                    : `❌ ${testResult.error ?? `HTTP ${testResult.status ?? '?'}`}`}
                </Badge>
              )}
            </div>
          ) : (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ {t('vfComp.connDesktop', 'La prueba de conexión se ejecuta en el proceso main de la app de escritorio (sin CORS). En un navegador usa los envíos reales de la cola como prueba.')}
            </p>
          )}
          {envToTest === 'production' && (
            <p className="rounded border border-red-500/40 bg-red-500/10 px-3 py-2 text-[11px] text-red-600 dark:text-red-300">
              🟢 {t('vfComp.connProdWarning', 'Producción remite facturas reales: valida primero TODO el asistente en el entorno de pruebas con una factura ficticia.')}
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

// --- 3. Incidencias ------------------------------------------------------------

const REJECTED_STATES = new Set<RegistroEstado>(['REJECTED', 'ACCEPTED_WITH_ERRORS']);

function IncidentsStep() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [busy, setBusy] = useState<number | null>(null);
  const [viewer, setViewer] = useState<QueueEntry | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = async () => {
    const list = await getQueueTable().orderBy('id').reverse().toArray();
    setEntries(list);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      await new Promise((r) => setTimeout(r, 0));
      if (alive) await refresh().catch((e) => console.error(e));
    })();
    return () => { alive = false; };
  }, []);

  const incidents = entries.filter((e) => REJECTED_STATES.has(e.status) || showAll);

  const retry = async (id: number) => {
    setBusy(id);
    try {
      const r = await retryEntryNow(id);
      if (r.sent) toast.success(t('vf.retryOk', 'Registro reenviado. Estado actualizado.'));
      else toast.warning(t('vf.retryFail', 'Reenvío fallido: {{e}}').replace('{{e}}', r.error ?? ''));
      await refresh();
      await logAction('retry', 'verifactu', `retry entry ${id}`);
    } finally { setBusy(null); }
  };

  const requeue = async (id: number) => {
    setBusy(id);
    try {
      await requeueRejected(id);
      toast.success(t('vf.requeued', 'Registro reencolado sin modificar su XML ni su huella.'));
      await refresh();
      await logAction('requeue', 'verifactu', `requeue entry ${id}`);
    } finally { setBusy(null); }
  };

  const discard = async (id: number) => {
    setBusy(id);
    try {
      await discardEntry(id);
      toast.info(t('vf.discarded', 'Registro descartado de la cola (queda trazado en el log).'));
      await refresh();
      await logAction('requeue', 'verifactu', `discard entry ${id}`);
    } finally { setBusy(null); }
  };

  const retryAll = async () => {
    const pend = entries.filter((e) => e.status === 'RETRY_PENDING');
    if (!pend.length) { toast.info(t('vf.nothingToRetry', 'No hay registros con reintento pendiente.')); return; }
    let ok = 0, fail = 0;
    for (const e of pend) {
      const r = await retryEntryNow(e.id!);
      if (r.sent) ok += 1; else fail += 1;
    }
    await refresh();
    await logAction('retry', 'verifactu', `retry all (${ok} ok / ${fail} fallidos)`);
    toast.success(t('vf.retryAll', 'Reenvío masivo: {{ok}} correctos, {{fail}} fallidos.')
      .replace('{{ok}}', String(ok)).replace('{{fail}}', String(fail)));
  };

  return (
    <Card className="p-5">
      <SectionTitle right={
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
            {showAll ? t('vf.showIncidents', 'Solo incidencias') : t('vf.showAll', 'Ver todo')}
          </Button>
          <Button size="sm" variant="secondary" onClick={() => { void retryAll(); }}>🔁 {t('vf.retryAllBtn', 'Reintentar pendientes')}</Button>
          <Button size="sm" variant="outline" aria-label={t('common.refresh')} onClick={() => { void refresh(); }}>↺</Button>
        </div>
      }>
        ⚠️ {t('vfComp.incidentsTitle', 'Centro de gestión de incidencias')}
      </SectionTitle>
      <p className="mb-3 text-sm text-sl-muted">
        {t('vfComp.incidentsHint', 'Consulta la respuesta XML SOAP de la AEAT y reintenta envíos. El XML y la huella nunca se modifican desde aquí: corregir implica rectificar la factura, no editar el registro.')}
      </p>
      {incidents.length === 0 ? (
        <p className="text-xs text-sl-muted">✅ {t('vf.noIncidents', 'Sin incidencias: no hay registros rechazados ni con errores.')}</p>
      ) : (
        <div className="space-y-2">
          {incidents.map((e) => {
            const errors = e.lastResponse?.Errores ?? [];
            const maxed = e.attempts >= MAX_QUEUE_ATTEMPTS;
            return (
              <div key={e.id} className="rounded-lg border border-sl-border bg-sl-hover/60 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge color={e.status === 'REJECTED' ? 'red' : e.status === 'ACCEPTED_WITH_ERRORS' ? 'amber' : 'slate'}>
                    {ESTADO_ICON[e.status] ?? '·'} {e.status}{e.lastEstadoEnvio ? ` · ${e.lastEstadoEnvio}` : ''}
                  </Badge>
                  <span className="font-mono font-bold text-sl-text">{e.NumSerieFactura}</span>
                  <span className="text-sl-muted">{e.kind === 'alta' ? '↑ alta' : '↓ anulación'} · {e.FechaExpedicionFactura}</span>
                  <span className="ms-auto text-sl-muted">{t('vf.attempts', 'Intentos')}: {e.attempts}{maxed ? ` · ${t('vf.maxed', 'máx. alcanzado')}` : ''}</span>
                </div>
                {e.lastError && (
                  <p className="mt-1 break-all rounded bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-600 dark:text-red-300">{e.lastError}</p>
                )}
                {errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {errors.map((er, i) => (
                      <li key={i} className="text-[10px] text-amber-700 dark:text-amber-300"><b>{er.CodigoError}</b> — {er.DescripcionError}</li>
                    ))}
                  </ul>
                )}
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={busy === e.id}
                    disabled={maxed && e.status === 'RETRY_PENDING'}
                    onClick={() => { void retry(e.id!); }}>🔁 {t('vf.retry', 'Reintentar ahora')}</Button>
                  {e.status === 'REJECTED' && (
                    <Button size="sm" variant="outline" loading={busy === e.id} onClick={() => { void requeue(e.id!); }}>↩ {t('vf.requeue', 'Reencolar')}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setViewer(e)}>
                    📄 {e.lastRawResponse ? t('vfComp.viewXml', 'Ver respuesta XML') : t('vf.noResponse', 'Sin respuesta XML almacenada')}
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => { void discard(e.id!); }}>🗑 {t('vf.discard', 'Descartar')}</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-sl-muted">
        🔒 {t('vf.immutability', 'Los registros remitidos a la AEAT no se editan nunca desde esta pantalla: el encadenamiento local solo admite alta o anulación.')}
      </p>

      <Modal open={!!viewer} onClose={() => setViewer(null)}
        title={`📄 ${viewer?.NumSerieFactura ?? ''} · ${viewer?.lastEstadoEnvio ?? ''}`}
        subtitle={t('vfComp.xmlSubtitle', 'Última respuesta SOAP de la AEAT (registro inmutable, solo lectura)')}
        size="xl"
        footer={<Button variant="secondary" onClick={() => setViewer(null)}>{t('common.close', 'Cerrar')}</Button>}>
        <pre className="max-h-[60dvh] overflow-auto whitespace-pre-wrap break-all rounded-lg bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-100">
          {viewer?.lastRawResponse ?? t('vf.noResponse', 'Sin respuesta XML almacenada.')}
        </pre>
      </Modal>
    </Card>
  );
}

// --- 4. Declaración responsable -------------------------------------------------

function DeclaracionStep({ form, up }: { form: TSettings; up: (patch: Partial<TSettings>) => void }) {
  const { t } = useTranslation();
  const system: SistemaInformaticoSpec = form.verifactuConfig?.system ?? DEFAULT_FISCAL_CONFIG.system;
  const setSystem = (patch: Partial<SistemaInformaticoSpec>) => {
    up({
      verifactuConfig: {
        modality: form.verifactuConfig?.modality ?? 'verifactu',
        environment: form.verifactuConfig?.environment ?? 'test',
        system: { ...system, ...patch },
      },
    });
  };
  const issues = declaracionIssues(system, form.cif);

  const exportDoc = async () => {
    const html = declaracionResponsableHtml(system, { storeName: form.storeName, obligadoNif: form.cif });
    downloadFile(html, declaracionFilename(system.IdSistemaInformatico), 'text/html');
    await logAction('export', 'verifactu', `declaración responsable ${system.IdSistemaInformatico}`);
    toast.success(t('vfComp.docExported', 'Documento exportado: imprímelo, fírmalo y consérvalo a disposición de la AEAT.'));
  };

  const snOf = (k: keyof SistemaInformaticoSpec) => (
    <Select
      label=""
      value={String(system[k]) === 'S' ? 'S' : 'N'}
      onChange={(e) => setSystem({ [k]: e.target.value } as unknown as Partial<SistemaInformaticoSpec>)}
    >
      <option value="S">S</option>
      <option value="N">N</option>
    </Select>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
      <Card className="p-5">
        <SectionTitle>📜 {t('vfComp.docTitle', 'Datos del fabricante del SIF')}</SectionTitle>
        <p className="mb-3 text-sm text-sl-muted">
          {t('vfComp.docHint', 'El productor del sistema informático de facturación declara el cumplimiento del RD 1007/2023 (art. 10.d de la Orden HAC/1177/2024). Los cambios se guardan con el botón «Guardar» de Ajustes.')}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          <Input label={t('vfComp.razonSocial', 'Denominación / razón social del productor')} value={system.NombreRazonSocial} onChange={(e) => setSystem({ NombreRazonSocial: e.target.value })} />
          <Input label="NIF" value={system.NIF} onChange={(e) => setSystem({ NIF: e.target.value })} hint={system.NIF === DEFAULT_FISCAL_CONFIG.system.NIF ? t('vfComp.nifPending', '⚠️ Aún es un marcador de posición: escribe el NIF real del productor.') : undefined} />
          <Input label={t('vfComp.systemName', 'Nombre del sistema informático')} value={system.NombreSistemaInformatico} onChange={(e) => setSystem({ NombreSistemaInformatico: e.target.value })} />
          <Input label="IdSistemaInformatico" value={system.IdSistemaInformatico} onChange={(e) => setSystem({ IdSistemaInformatico: e.target.value })} />
          <Input label={t('vfComp.version', 'Versión')} value={system.Version} onChange={(e) => setSystem({ Version: e.target.value })} />
          <Input label={t('vfComp.instNum', 'Número de instalación (1–100.000)')} type="number" min={1} max={100000} value={system.NumeroInstalacion} onChange={(e) => setSystem({ NumeroInstalacion: e.target.value })} />
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-sl-muted">{t('vfComp.soloVerifactu', 'Solo posible si VERI*FACTU')}</span>
            {snOf('TipoUsoPosibleSoloVerifactu')}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-sl-muted">{t('vfComp.multiOT', 'Múltiples obligados (MultiOT)')}</span>
            {snOf('TipoUsoPosibleMultiOT')}
          </label>
          <label className="block text-xs">
            <span className="mb-1 block font-semibold text-sl-muted">{t('vfComp.indMultiOT', 'Indicador de múltiples obligados')}</span>
            {snOf('IndicadorMultiplesOT')}
          </label>
        </div>
      </Card>

      <Card className="p-5">
        <SectionTitle>✅ {t('vfComp.docValidation', 'Validación y exportación')}</SectionTitle>
        {issues.length === 0 ? (
          <p className="mb-3 rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs text-emerald-700 dark:text-emerald-300">
            ✅ {t('vfComp.docOk', 'Los datos cumplen los requisitos: puedes exportar el documento.')}
          </p>
        ) : (
          <ul className="mb-3 space-y-1 rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-700 dark:text-amber-300">
            {issues.map((i) => <li key={i}>⚠️ {i}</li>)}
          </ul>
        )}
        <Button variant="outline" disabled={issues.length > 0} onClick={() => { void exportDoc(); }}>📥 {t('vfComp.docExport', 'Exportar declaración responsable')}</Button>
        <p className="mt-3 text-[11px] text-sl-muted">
          {t('vfComp.docNote', 'Se genera un HTML imprimible. La AEAT no homologa software: este documento lo firma el productor y se conserva como acreditación del art. 10.d.')}
        </p>
      </Card>
    </div>
  );
}
