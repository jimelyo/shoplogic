import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { toast } from '../../store/store';
import { logAction } from '../../lib/audit';
import { Badge, Card, SectionTitle } from './UI';
import { Button } from './Forms';
import { getQueueTable, retryEntryNow, requeueRejected, discardEntry, MAX_QUEUE_ATTEMPTS } from '../../verifactu/queue';
import type { QueueEntry } from '../../verifactu/queue';
import { ESTADO_ICON } from './fiscalIcons';

const REJECTED_STATES = new Set(['REJECTED', 'ACCEPTED_WITH_ERRORS']);

/**
 * Pantalla de incidencias VERI*FACTU: registros rechazados por la AEAT o
 * bloqueados por errores de transporte, con el detalle del último error y las
 * acciones de reintento (individual), reencolado y descarte.
 */
export function VerifactuIncidents() {
  const { t } = useTranslation();
  const [entries, setEntries] = useState<QueueEntry[]>([]);
  const [allCounts, setAllCounts] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState<number | null>(null);
  const [showAll, setShowAll] = useState(false);

  const refresh = async () => {
    const table = getQueueTable();
    const list = await table.orderBy('id').reverse().toArray();
    setEntries(list);
    const counts: Record<string, number> = {};
    for (const e of list) counts[e.status] = (counts[e.status] ?? 0) + 1;
    setAllCounts(counts);
  };

  useEffect(() => {
    let alive = true;
    void (async () => {
      await new Promise((r) => setTimeout(r, 0));
      if (!alive) return;
      await refresh().catch((e) => console.error(e));
    })();
    return () => { alive = false; };
  }, []);

  const incidents = entries.filter((e) => REJECTED_STATES.has(e.status) || showAll);

  const retry = async (id: number) => {
    setBusy(id);
    try {
      const r = await retryEntryNow(id);
      if (r.sent) toast.success(t('vf.retryOk', 'Registro reenviado. Estado actualizado.'));
      else toast.warning(t('vf.retryFail', 'Reenvío fallido: {{e}}', { e: r.error ?? '' }).replace('{{e}}', r.error ?? ''));
      await refresh();
      await logAction('retry', 'verifactu', `retry entry ${id}`);
    } finally { setBusy(null); }
  };

  const requeue = async (id: number) => {
    setBusy(id);
    try {
      const ok = await requeueRejected(id);
      if (ok) toast.success(t('vf.requeued', 'Registro reencolado sin modificar su XML ni su huella.'));
      await refresh();
      await logAction('requeue', 'verifactu', `requeue entry ${id}`);
    } finally { setBusy(null); }
  };

  const discard = async (id: number) => {
    setBusy(id);
    try {
      const ok = await discardEntry(id);
      if (ok) toast.info(t('vf.discarded', 'Registro descartado de la cola (queda trazado en el log).'));
      await refresh();
      await logAction('requeue', 'verifactu', `discard entry ${id}`);
    } finally { setBusy(null); }
  };

  const retryAllVencidos = async () => {
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
      <SectionTitle
        right={
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] text-sl-muted">
              {Object.entries(allCounts).map(([k, v]) => `${ESTADO_ICON[k] ?? '·'} ${v}`).join(' · ') || '—'}
            </span>
            <Button size="sm" variant="ghost" onClick={() => setShowAll(!showAll)}>
              {showAll ? t('vf.showIncidents', 'Solo incidencias') : t('vf.showAll', 'Ver todo')}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => { void retryAllVencidos(); }}>🔁 {t('vf.retryAllBtn', 'Reintentar pendientes')}</Button>
            <Button size="sm" variant="outline" onClick={() => { void refresh(); }}>↺</Button>
          </div>
        }
      >
        ⚠️ {t('vf.incidentsTitle', 'Incidencias VERI*FACTU')}
      </SectionTitle>
      <p className="mb-3 text-sm text-sl-muted">
        {t('vf.incidentsHint', 'Registros rechazados por la AEAT o con error de envío. El XML y la huella nunca se modifican: corregir implica rectificar la factura, no editar el registro.')}
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
                  <p className="mt-1 break-all rounded bg-red-500/10 px-2 py-1 font-mono text-[10px] text-red-600 dark:text-red-300">
                    {e.lastError}
                  </p>
                )}
                {errors.length > 0 && (
                  <ul className="mt-1 space-y-0.5">
                    {errors.map((er, i) => (
                      <li key={i} className="text-[10px] text-amber-700 dark:text-amber-300">
                        <b>{er.CodigoError}</b> — {er.DescripcionError}
                      </li>
                    ))}
                  </ul>
                )}
                <p className="mt-1 truncate font-mono text-[10px] text-sl-muted" title={e.Huella}>huella: {e.Huella.slice(0, 24)}…</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" loading={busy === e.id}
                    disabled={maxed && e.status === 'RETRY_PENDING'}
                    onClick={() => { void retry(e.id!); }}>🔁 {t('vf.retry', 'Reintentar ahora')}</Button>
                  {e.status === 'REJECTED' && (
                    <Button size="sm" variant="outline" loading={busy === e.id}
                      onClick={() => { void requeue(e.id!); }}>↩ {t('vf.requeue', 'Reencolar')}</Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => {
                    if (e.lastRawResponse) {
                      void navigator.clipboard?.writeText(e.lastRawResponse)
                        .then(() => toast.success(t('vf.copied', 'Respuesta XML copiada al portapapeles.')))
                        .catch(() => toast.error(t('vf.copyFail', 'No se pudo copiar.')));
                    } else toast.info(t('vf.noResponse', 'Sin respuesta XML almacenada.'));
                  }}>📋 {t('vf.copyResponse', 'Copiar respuesta AEAT')}</Button>
                  <Button size="sm" variant="ghost" onClick={() => { void discard(e.id!); }}>🗑 {t('vf.discard', 'Descartar')}</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="mt-2 text-[11px] text-sl-muted">
        🔒 {t('vf.immutability', 'Los registros remitidos a la AEAT no se editan nunca desde esta pantalla; el encadenamiento local solo admite altura o anulación, no modificaciones.')}
      </p>
    </Card>
  );
}
