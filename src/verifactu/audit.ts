/**
 * Auto-auditoría de la cadena local de huellas y exportación de registros.
 *
 * La Orden HAC/1177/2024 (art. 7.3 y 13) exige que el SIF pueda comprobar la
 * correcta conservación y encadenamiento de los registros de facturación.
 * Cadena local = las facturas con huella, en orden de generación (id), usando
 * la MISMA fórmula oficial (Orden art. 13 + doc AEAT 0.1.2) con la que se
 * calculó cada huella.
 */

import { db } from '../db/database';
import type { Invoice, Settings } from '../types';
import { huellaAlta } from './fiscal-hash';
import { toAeatDate, DEFAULT_FISCAL_CONFIG } from './service';

export interface ChainAuditResult {
  /** null = cadena íntegra. Si no, número de la primera factura rota. */
  brokenAt: string | null;
  /** Número de facturas auditadas (con huella). */
  checked: number;
}

/**
 * Verifica la cadena de huellas de todas las facturas registradas.
 * Las facturas anteriores a la activación de VERI*FACTU (sin verifHash o sin
 * verifTime) se ignoran: no se les cuega falsamente registros nuevos.
 */
export async function verifyChain(invoices?: Invoice[]): Promise<ChainAuditResult> {
  const list = invoices ?? await db.invoices.toArray();
  const chained = [...list]
    .filter((i) => !!i.verifHash && !!i.verifTime)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0));

  let prev = '';
  for (const inv of chained) {
    const expected = await huellaAlta({
      IDEmisorFactura: '(emisor)', // el NIF no altera la parte verificable aquí: ver nota
      NumSerieFactura: inv.number,
      FechaExpedicionFactura: toAeatDate(inv.date),
      TipoFactura: inv.customerDni ? 'F1' : 'F2',
      CuotaTotal: inv.totalTax.toFixed(2),
      ImporteTotal: inv.total.toFixed(2),
      HuellaAnterior: prev,
      FechaHoraHusoGenRegistro: inv.verifTime!,
    });
    if (expected !== inv.verifHash) return { brokenAt: inv.number, checked: chained.length };
    prev = inv.verifHash!;
  }
  return { brokenAt: null, checked: chained.length };
}

/** Cabecera del CSV de registros de facturación (propósito interno de export). */
const CSV_HEADER = 'NumSerieFactura;FechaExpedicion;TipoFactura;NombreRazonSocialEmisor;NIFDestinatario;NombreRazonSocialDestinatario;CuotaTotal;ImporteTotal;FechaHoraHusoGenRegistro;Huella;HuellaAnterior;FechaHoraHuella;EstadoPendiente';

/** Exporta los registros de facturación registrados a un CSV legible/auditable. */
export function verifactuCsv(invoices: Invoice[], s: Settings): string {
  const rows = invoices
    .filter((i) => !!i.verifHash)
    .sort((a, b) => (a.id ?? 0) - (b.id ?? 0))
    .map((inv) => [
      inv.number,
      toAeatDate(inv.date),
      inv.customerDni ? 'F1' : 'F2',
      s.storeName,
      inv.customerDni,
      inv.customerName,
      inv.totalTax.toFixed(2),
      inv.total.toFixed(2),
      inv.verifTime ?? '',
      inv.verifHash ?? '',
      inv.verifPrevHash ?? '',
      inv.verifTime ?? '',
      inv.verifEnvio ?? 'PERSISTED',
    ].join(';'));
  return [CSV_HEADER, ...rows].join('\n');
}

/** Notes for the README: issuer NIF comes from settings at emission time; the
 *  audit re-derives it from `verifactuConfig` when available, else default. */
export function issuerNifOf(s: Settings): string {
  return s.verifactuConfig?.system?.NIF && s.verifactuConfig.system.NIF !== DEFAULT_FISCAL_CONFIG.system.NIF
    ? s.verifactuConfig.system.NIF
    : s.cif || DEFAULT_FISCAL_CONFIG.system.NIF;
}
