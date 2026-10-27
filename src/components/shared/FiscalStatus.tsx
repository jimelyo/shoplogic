import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from './Forms';
import { getQueueTable } from '../../verifactu/queue';
import { verifyChain } from '../../verifactu/audit';
import { SOAP_ENDPOINTS } from '../../verifactu/aeat-soap';
import { ESTADO_ICON } from './fiscalIcons';
import type { AeatEnvironment, VerifactuModality } from '../../verifactu/fiscal-types';

export function FiscalStatus() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<{ id: number; NumSerieFactura: string; status: string; attempts: number; lastError?: string; lastEstadoEnvio?: string; Huella: string }[]>([]);
  const [broken, setBroken] = useState<string | null>(null);
  const [audited, setAudited] = useState(0);

  const refresh = async () => {
    const list = await getQueueTable().orderBy('id').reverse().limit(12).toArray();
    setEntries(list.map((e) => ({ id: e.id!, NumSerieFactura: e.NumSerieFactura, status: e.status, attempts: e.attempts, lastError: e.lastError, lastEstadoEnvio: e.lastEstadoEnvio, Huella: e.Huella })));
    const audit = await verifyChain();
    setBroken(audit.brokenAt);
    setAudited(audit.checked);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      await new Promise((r) => setTimeout(r, 0));
      if (!alive) return;
      await refresh().catch(() => undefined);
    })();
    return () => { alive = false; };
  }, []);

  return (
    <div className="mt-4 border-t border-sl-border pt-4">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-sm font-semibold">🇪🇸 {t('settings.vfStatus') || 'Estado de la remisión a AEAT'}</span>
        <Button size="sm" variant="outline" aria-label={t('common.refresh')} onClick={() => refresh().catch(() => undefined)}>↺</Button>
      </div>
      {broken && (
        <div className="mb-2 rounded bg-red-500/10 px-3 py-2 text-xs text-red-600">
          ⚠️ {t('settings.vfBroken', { number: broken })}
        </div>
      )}
      {!broken && audited > 0 && (
        <div className="mb-2 text-xs text-sl-muted">🔗 {t('settings.vfChainOk', { n: audited })}</div>
      )}
      {entries.length === 0 ? (
        <p className="text-xs text-sl-muted">{t('settings.vfQueueEmpty')}</p>
      ) : (
        <div className="space-y-1">
          {entries.map((e) => (
            <div key={e.id} className="flex items-center gap-2 rounded bg-sl-hover px-2 py-1 text-xs">
              <span>{ESTADO_ICON[e.status] ?? '·'}</span>
              <span className="font-mono">{e.NumSerieFactura}</span>
              <span className="ms-auto text-sl-muted">{e.status}{e.lastEstadoEnvio ? ` · ${e.lastEstadoEnvio}` : ''} · {e.attempts}×</span>
              {e.lastError && <span className="text-red-500" title={e.lastError}>⚠</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function FiscalConfigFields({ value, onChange }: {
  value: { modality: VerifactuModality; environment: AeatEnvironment };
  onChange: (v: { modality: VerifactuModality; environment: AeatEnvironment }) => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="grid gap-3 md:grid-cols-2">
      <label className="block text-xs">
        <span className="mb-1 block text-sl-muted">{t('settings.vfMode') || 'Modalidad'}</span>
        <select
          className="w-full rounded border border-sl-border bg-sl-hover px-2 py-1.5"
          value={value.modality}
          onChange={(e) => onChange({ ...value, modality: e.target.value as VerifactuModality })}
        >
          <option value="verifactu">VERI*FACTU</option>
          <option value="no_verifactu">NO VERI*FACTU</option>
        </select>
      </label>
      <label className="block text-xs">
        <span className="mb-1 block text-sl-muted">{t('settings.vfEnv') || 'Entorno'}</span>
        <select
          className="w-full rounded border border-sl-border bg-sl-hover px-2 py-1.5"
          value={value.environment}
          onChange={(e) => onChange({ ...value, environment: e.target.value as AeatEnvironment })}
        >
          <option value="test">Pruebas (preproducción)</option>
          <option value="production">Producción</option>
        </select>
      </label>
      <div className="md:col-span-2 rounded bg-sl-hover px-3 py-2 font-mono text-[11px] text-sl-muted break-all">
        {value.environment === 'test' ? 'WSDL: ' : 'WSDL: '}
        {value.environment === 'test'
          ? 'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl'
          : 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl'}
        <br />
        SOAP: {SOAP_ENDPOINTS[value.environment]}
      </div>
    </div>
  );
}
