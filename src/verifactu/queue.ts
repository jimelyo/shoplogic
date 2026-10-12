/**
 * AeatSubmissionQueue — cola persistente de remisión voluntaria.
 *
 * Contexto de la SHAPE del módulo: ShopLogic Pro es una aplicación 100% local
 * (IndexedDB/Dexie, sin backend). Aquí la cola sobre Dexie persiste los
 * registros remitidos a la AEAT, con estados de la cola, intentos, last
 * fetched response, etc. Requiere conexión; no se auto-instala un servidor
 * fiscal ni se exponen endpoints: la remisión la hace el navegador con el
 * certificado/constancia que el usuario instale.
 *
 * Estados: PERSISTED -> QUEUED -> SENDING -> ACCEPTED | ACCEPTED_WITH_ERRORS
 *           (o REJECTED / RETRY_PENDING), con trazabilidad de cada envío.
 */

import type { Table } from 'dexie';
import { db } from '../db/database';
import type { AeatSubmissionResponse, AeatResponseResult } from './aeat-soap';
import type { RegistroEstado } from './fiscal-types';

/** Límite de reintentos automáticos antes de marcar la entrada como descartada. */
export const MAX_QUEUE_ATTEMPTS = 8;

/** Fila de la cola, un registro de facturación pendiente o ya remitido. */
export interface QueueEntry {
  id?: number;
  /** Número de factura (NumSerieFactura). */
  NumSerieFactura: string;
  /** Fecha de expedición de la factura en `dd-mm-aaaa`. */
  FechaExpedicionFactura: string;
  /** Tipo de registro de que se trata. */
  kind: 'alta' | 'anulacion';
  /** Identificador de la factura local (invoice.id), si hay. */
  invoiceId?: number;
  /** NIF del emisor remitido. */
  IDEmisorFactura: string;
  /** Huella calculada del registro (la informada en el XML). */
  Huella: string;
  /** Huella anterior encadenada; indefinida para el primer registro del SIF. */
  HuellaAnterior?: string;
  /** XML remitido o a remitir (sin firma). */
  xml: string;
  /** Estado de la cola. */
  status: RegistroEstado;
  /** Número de intentos de envío. */
  attempts: number;
  /** Fecha/hora ISO de creación. */
  createdAt: string;
  /** Fecha/hora ISO de la última actualización. */
  updatedAt: string;
  /** Fecha/hora del próximo reintento programado, si lo hay. */
  nextRetryAt?: string;
  /** Estado global informado por la AEAT en la última respuesta. */
  lastEstadoEnvio?: 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';
  /** Resultado individual informado por la AEAT, si hay. */
  lastResponse?: AeatResponseResult;
  /** CSV devuelto, si hay. */
  CSV?: string;
  /** XML crudo de la última respuesta (para trazabilidad/auditoría). */
  lastRawResponse?: string;
  /** Último error de la cola (transporte / SOAP Fault / parsing). */
  lastError?: string;
}

/** Tabla nueva en Dexie, añadida en la versión 10 del esquema. */
export const QUEUE_TABLE_NAME = 'verifactuQueue';

export function getQueueTable(): Table<QueueEntry, number> {
  return (db as unknown as { verifactuQueue: Table<QueueEntry, number> }).verifactuQueue;
}

/** Cap por lote: máximo que la AEAT acepta por remisión. */
export const AEAT_BATCH_LIMIT = 1000;

/** Política de reintentos: backoff 15 s · 1 min · 10 min · 1 h, cap a 1 h. */
const RETRY_DELAYS_MS = [15_000, 60_000, 600_000, 3_600_000];

export function retryDelayMs(attempts: number): number {
  return RETRY_DELAYS_MS[Math.min(Math.max(attempts - 1, 0), RETRY_DELAYS_MS.length - 1)];
}

/** Encola (o re-encola) un registro de facturación. Idempotente por huella. */
export async function enqueue(entry: Omit<QueueEntry, 'id' | 'status' | 'attempts' | 'createdAt' | 'updatedAt'> & { status?: RegistroEstado }): Promise<number> {
  const now = new Date().toISOString();
  const status = entry.status ?? 'QUEUED';
  const key = { Huella: entry.Huella };
  const existing = await getQueueTable().where('Huella').equals(key.Huella as never).first();
  if (existing?.id) {
    await getQueueTable().update(existing.id, { status, updatedAt: now, xml: entry.xml });
    return existing.id;
  }
  return getQueueTable().add({
    ...entry,
    status,
    attempts: 0,
    createdAt: now,
    updatedAt: now,
  } as QueueEntry);
}

interface SendEntryResult {
  sent: boolean;
  estado?: AeatSubmissionResponse['EstadoEnvio'];
  error?: string;
}

/**
 * Envía una entrada (o lote) por SOAP. No actualiza el estado si el envío
 * falla: la cola lo reintenta (backoff). Devuelve el estado de reenvío.
 */
export async function sendEntry(
  e: QueueEntry,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number },
): Promise<SendEntryResult> {
  const { sendSoap } = await import('./aeat-soap');
  const { SOAP_ENDPOINTS, isSoapFault, soapFaultMessage } = await import('./aeat-soap');
  const env = localStorage.getItem('sl_verifactu_env') as 'test' | 'production' | null;
  const now = new Date().toISOString();
  try {
    await getQueueTable().update(e.id!, { status: 'SENDING', updatedAt: now });
    // Firma XAdES-Enveloped (art. 14 de la Orden) justo antes del envío, vía
    // Electron IPC (proceso main + .p12 local). Si la app corre en un navegador
    // sin el shell de escritorio, se envía el XML sin firmar y el error queda
    // registrado — la AEAT no acepta mensajes sin firma.
    let xmlToSend = e.xml;
    let signError: string | undefined;
    try {
      const bridge = (window as unknown as { shoplogicDesktop?: {
        verifactuSign?: (xml: string) => Promise<{ ok: boolean; signed?: string; error?: string }>;
      } }).shoplogicDesktop;
      if (bridge?.verifactuSign) {
        const r = await bridge.verifactuSign(e.xml);
        if (r.ok && r.signed) xmlToSend = r.signed;
        else signError = r.error;
      } else {
        signError = 'Sin shell de escritorio: firma XAdES no disponible en este entorno.';
      }
    } catch (err) {
      signError = err instanceof Error ? err.message : String(err);
    }
    if (signError) {
      await getQueueTable().update(e.id!, {
        status: 'RETRY_PENDING',
        attempts: e.attempts + 1,
        updatedAt: new Date().toISOString(),
        nextRetryAt: new Date(Date.now() + retryDelayMs(e.attempts + 1)).toISOString(),
        lastError: signError,
      });
      return { sent: false, error: signError };
    }
    const res = await sendSoap({
      environment: env ?? 'test',
      xml: xmlToSend,
      timeoutMs: opts.timeoutMs,
      fetchImpl: opts.fetchImpl,
    });
    const perRecord = res.registros[0];
    const status: RegistroEstado = (() => {
      switch (res.EstadoEnvio) {
        case 'Correcto': return 'ACCEPTED';
        case 'AceptadoConErrores': return 'ACCEPTED_WITH_ERRORS';
        case 'Incorrecto': return 'REJECTED';
        default: return 'RETRY_PENDING';
      }
    })();
    await getQueueTable().update(e.id!, {
      status,
      attempts: e.attempts + 1,
      updatedAt: new Date().toISOString(),
      lastEstadoEnvio: res.EstadoEnvio,
      lastResponse: perRecord,
      CSV: res.CSV ?? perRecord?.CSV,
      lastRawResponse: res.raw,
      nextRetryAt: undefined,
      lastError: undefined,
    });
    return { sent: true, estado: res.EstadoEnvio };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const attempts = e.attempts + 1;
    const delay = retryDelayMs(attempts);
    await getQueueTable().update(e.id!, {
      status: 'RETRY_PENDING',
      attempts,
      updatedAt: new Date().toISOString(),
      nextRetryAt: new Date(Date.now() + delay).toISOString(),
      lastError: msg,
    });
    return { sent: false, error: isSoapFault(e.xml) ? soapFaultMessage(e.xml) ?? 'SOAP Fault' : msg };
  }
}

/**
 * Reintenta el envío de una entrada de forma inmediata (botón "Reintentar" de
 * la pantalla de incidencias), ignorando el backoff programado.
 */
export async function retryEntryNow(
  id: number,
  opts: { fetchImpl?: typeof fetch; timeoutMs?: number } = {},
): Promise<SendEntryResult> {
  const e = await getQueueTable().get(id);
  if (!e) return { sent: false, error: `Entrada ${id} no encontrada en la cola.` };
  return sendEntry({ ...e, nextRetryAt: undefined }, opts);
}

/**
 * Reenciola una entrada RECHAZADA sin modificar su XML ni su huella (solo
 * vuelve al estado QUEUED para un nuevo intento). No es una "corrección":
 * si el rechazo es de validación, el reintento devolverá el mismo error.
 */
export async function requeueRejected(id: number, note?: string): Promise<boolean> {
  const now = new Date().toISOString();
  const e = await getQueueTable().get(id);
  if (!e) return false;
  await getQueueTable().update(id, {
    status: 'QUEUED',
    updatedAt: now,
    nextRetryAt: undefined,
    ...(note ? { lastError: note } : {}),
  });
  return true;
}

/** Elimina de la cola una entrada descartada (histórico conservado en `logs`). */
export async function discardEntry(id: number): Promise<boolean> {
  const e = await getQueueTable().get(id);
  if (!e) return false;
  await getQueueTable().delete(id);
  await db.logs.add({
    userId: 0, userName: 'Sistema', action: 'discard', module: 'verifactu',
    details: `Descartado ${e.NumSerieFactura} (${e.status}, ${e.attempts} intentos)`,
    timestamp: new Date().toISOString(), ip: 'local',
  });
  return true;
}

/** Procesa la cola: remite todos los QUEUED/RETRY_PENDING vencidos, hasta un tope. */
export async function flushQueue(opts: {
  /** Envío implementado pero sin certificado instalado en el navegador -> no envía. */
  enabled?: boolean;
  fetchImpl?: typeof fetch;
  limit?: number;
} = {}): Promise<{ sent: number; failed: number; skipped: boolean }> {
  if (!opts.enabled) {
    // No fingir éxito: sin remisión real, que la UI avise y no cuestione aquí.
    return { sent: 0, failed: 0, skipped: true };
  }
  const table = getQueueTable();
  const now = new Date().toISOString();
  const due = await table
    .filter((e) => (e.status === 'QUEUED' || e.status === 'RETRY_PENDING')
      && (!e.nextRetryAt || e.nextRetryAt <= now))
    .limit(opts.limit ?? AEAT_BATCH_LIMIT)
    .toArray();
  let sent = 0;
  let failed = 0;
  for (const e of due) {
    const r = await sendEntry(e, { fetchImpl: opts.fetchImpl });
    if (r.sent) sent += 1; else failed += 1;
  }
  return { sent, failed, skipped: false };
}

/** Recupera los pendientes tras reinicio: marca SENDING colgados como RETRY_PENDING. */
export async function recoverQueue(): Promise<number> {
  const now = new Date().toISOString();
  const hung = await getQueueTable().where('status').equals('SENDING').toArray();
  for (const e of hung) {
    await getQueueTable().update(e.id!, {
      status: 'RETRY_PENDING',
      nextRetryAt: now,
      updatedAt: now,
      lastError: e.lastError ?? 'Recuperado tras reinicio (estado SENDING colgado).',
    });
  }
  return hung.length;
}
