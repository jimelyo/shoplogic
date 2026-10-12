/**
 * VerifactuService — fachada del módulo fiscal.
 *
 * Punto único de entrada para:
 *  - construir el registro de ALTA de una factura del ERP (con desglose de IVA)
 *    y calcular su huella encadenada,
 *  - encolar la remisión SOAP a la AEAT,
 *  - generar el QR reglamentario de la factura,
 *  - emitir registros de ANULACIÓN cuando se anula una factura.
 *
 * No altera el flujo de facturación existente: se invoca desde
 * src/lib/invoices.ts tras crear la factura (patrón outbox: la factura se
 * guarda primero; la remisión es una operación persistida aparte).
 */

import { db } from '../db/database';
import type { Invoice, Settings } from '../types';
import { chainAlta, chainAnulacion, officialMoney } from './fiscal-chain';
import { altaSoap, anulacionSoap } from './aeat-xml';
import type { DesgloseDetalle, RegistroAlta, RegistroAnulacion, SistemaInformaticoSpec, AeatTipoFactura } from './fiscal-types';
import { CLAVE_REGIMEN, CALIFICACION_OPERACION } from './fiscal-types';
import { enqueue, getQueueTable, recoverQueue } from './queue';
import { qrUrl } from './fiscal-qr';

/** SistemaInformatico por defecto del productor (art. 10.d de la Orden). */
export const DEFAULT_SISTEMA_INFORMATICO: SistemaInformaticoSpec = {
  NombreRazonSocial: 'ShopLogic Pro',
  NIF: 'PENDING-SETUP',   // Lo completan en Settings: NIF del productor.
  NombreSistemaInformatico: 'ShopLogic Pro',
  IdSistemaInformatico: 'SHOPLOGIC-ERP-01',
  Version: '1.3.0',
  NumeroInstalacion: '', // Lo genera el obligado (1..100000); se guarda en settings.
  TipoUsoPosibleSoloVerifactu: 'N',
  TipoUsoPosibleMultiOT: 'S',
  IndicadorMultiplesOT: 'S',
};

/** Configuración fiscal por defecto (envío pendiente de certificado). */
export const DEFAULT_FISCAL_CONFIG = {
  modality: 'verifactu' as const,
  environment: 'test' as const,
  system: DEFAULT_SISTEMA_INFORMATICO,
};

/** `dd-mm-aaaa` (formato oficial de FechaExpedicionFactura). */
export function toAeatDate(isoDate: string): string {
  // isoDate llega 'yyyy-MM-dd' del ERP (src/lib/calc.ts isoDate()).
  const [y, m, d] = isoDate.split('-');
  if (y?.length === 4 && m && d) return `${d}-${m}-${y}`;
  return isoDate;
}

/** ISO-8601 con huso horario local (formato FechaHoraHusoGenRegistro). */
export function nowWithOffset(): string {
  const d = new Date();
  const pad = (n: number, w = 2) => String(n).padStart(w, '0');
  const offMin = -d.getTimezoneOffset();
  const sign = offMin >= 0 ? '+' : '-';
  const abs = Math.abs(offMin);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T`
    + `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
    + `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`;
}

/** Deduce el TipoFactura (solo casos que el ERP genera hoy: F1/F2). */
export function tipoFacturaDe(inv: Invoice): AeatTipoFactura {
  // Factura simplificada (F2) cuando no hay NIF del destinatario y es venta al
  // bulto (adulto físico); caso estándar del POS. Else: factura completa (F1).
  return inv.customerDni ? 'F1' : 'F2';
}

/** Desglose de IVA a partir de las líneas de la factura del ERP. */
export function desgloseDe(inv: Invoice, s: Settings, fiscal: { ClaveRegimen?: string; CalificacionOperacion?: string } = {}): DesgloseDetalle[] {
  const byRate = new Map<number, { base: number; cuota: number }>();
  for (const item of inv.items) {
    const rate = item.taxRate;
    const total = item.total;
    const base = rate > 0 ? total / (1 + rate / 100) : total;
    const cuota = total - base;
    const cur = byRate.get(rate) ?? { base: 0, cuota: 0 };
    cur.base += base;
    cur.cuota += cuota;
    byRate.set(rate, cur);
  }
  const clave = fiscal.ClaveRegimen ?? CLAVE_REGIMEN.general;
  const calif = fiscal.CalificacionOperacion ?? CALIFICACION_OPERACION.sujeta;
  return [...byRate.entries()].map(([rate, v]) => ({
    ClaveRegimen: clave,
    ...(rate > 0
      ? { CalificacionOperacion: calif, TipoImpositivo: rate }
      : { CalificacionOperacion: CALIFICACION_OPERACION.exenta }),
    BaseImponibleOimporteNoSujeto: round2(v.base),
    ...(rate > 0 ? { CuotaRepercutida: round2(v.cuota) } : {}),
  }));
}

const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export interface AltaEmissionResult {
  huella: string;
  huellaAnterior: string;
  primerRegistro: boolean;
  fechaHoraGen: string;
  numeroRegistro: string;
}

/**
 * Emite el registro de ALTA de una factura: calcula la huella encadenada,
 * construye el XML SOAP y lo encola. La factura NO se considera remitida:
 * queda PENDIENTE hasta que AEAT responda Correcto (ver queue.ts).
 *
 * @param inv     factura ya persistida (inv.id definido)
 * @param s       configuración global del ERP
 */
export async function emitAlta(inv: Invoice, s: Settings): Promise<AltaEmissionResult> {
  const fiscal = { ...DEFAULT_FISCAL_CONFIG, ...(s.verifactuConfig ?? {}) };
  const system: SistemaInformaticoSpec = {
    ...fiscal.system,
    NumeroInstalacion: s.verifactuConfig?.system?.NumeroInstalacion || String(s.id ?? ''),
  };
  const fechaHoraGen = nowWithOffset();
  const fechaExp = toAeatDate(inv.date);

  // Última huella remitible o persistida de la cadena: cualquier registro con
  // huella, por orden de generación (id), sin contar los rechazados que
  // continúan la cadena local (la cadena local es inalterable).
  const last = (await db.invoices.toArray())
    .filter((i) => !!i.verifHash)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((i) => i.verifHash!).pop() ?? '';

  const TipoFactura = tipoFacturaDe(inv);
  const CuotaTotal = officialMoney(inv.totalTax);
  const ImporteTotal = officialMoney(inv.total);

  const chain = await chainAlta({
    IDEmisorFactura: s.cif,
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: fechaExp,
    TipoFactura,
    CuotaTotal,
    ImporteTotal,
    prevHash: last,
    FechaHoraHusoGenRegistro: fechaHoraGen,
  });

  const alta: RegistroAlta = {
    invoiceId: inv.id,
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: fechaExp,
    FechaHoraHusoGenRegistro: fechaHoraGen,
    TipoFactura,
    IDEmisorFactura: s.cif,
    NombreRazonSocialEmisor: s.storeName,
    ...(inv.customerDni || inv.customerName
      ? { NIFDestinatario: inv.customerDni || undefined, NombreRazonSocialDestinatario: inv.customerName || undefined }
      : {}),
    DescripcionOperacion: inv.items.map((i) => i.description).join(' | ').slice(0, 500),
    Desglose: desgloseDe(inv, s),
    CuotaTotal,
    ImporteTotal,
    HuellaAnterior: chain.huellaAnterior || undefined,
    PrimerRegistro: chain.primerRegistro,
  };

  const xml = altaSoap({
    obligado: { NombreRazon: s.storeName, NIF: s.cif },
    alta,
    chain,
    sistema: system,
  });
  await enqueue({
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: fechaExp,
    kind: 'alta',
    invoiceId: inv.id,
    IDEmisorFactura: s.cif,
    Huella: chain.huella,
    HuellaAnterior: chain.huellaAnterior || undefined,
    xml,
  });

  return { huella: chain.huella, huellaAnterior: chain.huellaAnterior, primerRegistro: chain.primerRegistro, fechaHoraGen, numeroRegistro: inv.number };
}

export interface AnulacionEmissionResult {
  huella: string;
  huellaAnterior: string;
  numeroRegistro: string;
}

/**
 * Emite el registro de ANULACIÓN de una factura previamente emitida.
 * Llamarlo SOLO cuando la factura ya tiene huella (verifactuHash definido);
 * la factura local NO se borra: se marca `status: cancelled`.
 */
export async function emitAnulacion(inv: Invoice, s: Settings): Promise<AnulacionEmissionResult> {
  const fiscal = { ...DEFAULT_FISCAL_CONFIG, ...(s.verifactuConfig ?? {}) };
  const system: SistemaInformaticoSpec = {
    ...fiscal.system,
    NumeroInstalacion: s.verifactuConfig?.system?.NumeroInstalacion || String(s.id ?? ''),
  };
  const fechaHoraGen = nowWithOffset();
  const fechaExp = toAeatDate(inv.date);

  const last = (await db.invoices.toArray())
    .filter((i) => !!i.verifHash && (i.id ?? 0) < (inv.id ?? 0))
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((i) => i.verifHash!).pop() ?? '';

  const chain = await chainAnulacion({
    IDEmisorFacturaAnulada: s.cif,
    NumSerieFacturaAnulada: inv.number,
    FechaExpedicionFacturaAnulada: fechaExp,
    prevHash: last,
    FechaHoraHusoGenRegistro: fechaHoraGen,
  });

  const anul: RegistroAnulacion = {
    invoiceId: inv.id,
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: fechaExp,
    FechaHoraHusoGenRegistro: fechaHoraGen,
    IDEmisorFacturaAnulada: s.cif,
    NumSerieFacturaAnulada: inv.number,
    FechaExpedicionFacturaAnulada: fechaExp,
    HuellaAnterior: chain.huellaAnterior || undefined,
    PrimerRegistro: chain.primerRegistro,
  };

  const xml = anulacionSoap({
    obligado: { NombreRazon: s.storeName, NIF: s.cif },
    anulacion: anul,
    chain,
    sistema: system,
  });
  await enqueue({
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: fechaExp,
    kind: 'anulacion',
    invoiceId: inv.id,
    IDEmisorFactura: s.cif,
    Huella: chain.huella,
    HuellaAnterior: chain.huellaAnterior || undefined,
    xml,
  });

  return { huella: chain.huella, huellaAnterior: chain.huellaAnterior, numeroRegistro: inv.number };
}

/** URL que va DENTRO del QR de la factura (firma ajena al resultado del envío). */
export function invoiceQrUrl(inv: Invoice, s: Settings): string {
  const fiscal = { ...DEFAULT_FISCAL_CONFIG, ...(s.verifactuConfig ?? {}) };
  return qrUrl(
    { nif: s.cif, numserie: inv.number, fecha: toAeatDate(inv.date), importe: officialMoney(inv.total) },
    fiscal.modality,
    fiscal.environment,
  );
}

/** Estado legible de la remisión de una factura (para Billing/POS). */
export type VerifactuStatus = 'none' | 'queued' | 'sending' | 'accepted_for_errors' | 'accepted' | 'rejected' | 'retry';

export function estadoRemisionDe(inv: Invoice, qStatus?: string): VerifactuStatus {
  if (!inv.verifHash) return 'none';
  switch (qStatus) {
    case 'ACCEPTED': return 'accepted';
    case 'ACCEPTED_WITH_ERRORS': return 'accepted_for_errors';
    case 'REJECTED': return 'rejected';
    case 'SENDING': return 'sending';
    case 'RETRY_PENDING': return 'retry';
    default: return 'queued';
  }
}

/** Consulta la cola para el estado de una factura (por id de invoice). */
export async function queueStatusOfInvoice(invoiceId: number): Promise<{ status?: string; attempts?: number } | null> {
  const t = getQueueTable();
  const e = await t.where('invoiceId').equals(invoiceId).last();
  return e ? { status: e.status, attempts: e.attempts } : null;
}

/** Reconstruye la cola tras reinicio (equivalente al arranque del app). */
export async function onChainStartup() {
  await recoverQueue();
}
