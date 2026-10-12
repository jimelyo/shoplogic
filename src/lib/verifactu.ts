import type { Invoice, Settings } from '../types';

/**
 * Veri*factu (Spain, RD 1007/2023) — local fingerprint registry.
 *
 * This implements the *record-keeping* half of Veri*factu: every invoice gets a
 * SHA-256 fingerprint chained to the previous one, plus the instant and the tax
 * regime used, so the stored invoices form an unbroken, tamper-evident trail
 * (the "registros de facturación"). The signed upload to the AEAT web service
 * requires a certificate and is a separate step — this module provides the
 * fingerprint chain, the self-audit and the record/CSV export that such an
 * uploader (and a tax inspection) would consume.
 */

const FINGERPRINT_VERSION = '1.0';
const te = new TextEncoder();

const toHex = (bytes: Uint8Array) => Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');

/** SHA-256 of a string, hex-encoded. */
export async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto unavailable');
  const buf = await crypto.subtle.digest('SHA-256', te.encode(input) as BufferSource);
  return toHex(new Uint8Array(buf));
}

/** Canonical string hashed for each invoice: version|number|date|dni|total|prevHash|time. */
export function verifactuPayload(inv: Invoice, prevHash: string, time: string): string {
  return [
    FINGERPRINT_VERSION,
    inv.number,
    inv.date,
    inv.customerDni || '',
    inv.total.toFixed(2),
    prevHash,
    time,
  ].join('|');
}

/** Fingerprint of one invoice given its predecessor's hash. */
export async function nextFingerprint(inv: Invoice, prevHash: string, time: string): Promise<string> {
  return sha256Hex(verifactuPayload(inv, prevHash, time));
}

export type VerifRegime = 'general' | 'rebu' | 'special';

/** Build the registration fields for a new invoice (caller persists them). */
export async function registerInvoice(
  inv: Invoice,
  prevHash: string,
  regime: VerifRegime = 'general',
): Promise<Pick<Invoice, 'verifHash' | 'verifTime' | 'verifRegime' | 'verifPrevHash'>> {
  const time = new Date().toISOString();
  const hash = await nextFingerprint(inv, prevHash, time);
  return { verifHash: hash, verifTime: time, verifRegime: regime, verifPrevHash: prevHash || undefined };
}

/**
 * Verify the whole stored chain in document order; returns the number of the
 * first invoice whose stored fingerprint does not match, or `null` when the
 * trail is intact. Invoices registered before Veri*factu (no hash) are skipped.
 */
export async function verifyChain(invoices: Invoice[]): Promise<string | null> {
  let prev = '';
  const sorted = [...invoices].sort((a, b) => a.date.localeCompare(b.date) || (a.id ?? 0) - (b.id ?? 0));
  for (const inv of sorted) {
    if (!inv.verifHash || !inv.verifTime) continue;
    const expected = await nextFingerprint(inv, prev, inv.verifTime);
    if (expected !== inv.verifHash) return inv.number;
    prev = inv.verifHash;
  }
  return null;
}

/** Flatten the AEAT record fields for one registered invoice. */
export function verifactuRecord(inv: Invoice, s: Settings) {
  return {
    IDVersionFactura: FINGERPRINT_VERSION,
    IDEmisorFactura: s.cif,
    NumSerieFactura: inv.number,
    FechaExpedicionFactura: inv.date,
    NombreRazonSocialEmisor: s.storeName,
    NombreRazonSocialDestinatario: inv.customerName,
    NIFDestinatario: inv.customerDni,
    TipoFactura: 'F1',
    CuotaTotal: inv.totalTax.toFixed(2),
    ImporteTotal: inv.total.toFixed(2),
    FechaHoraHuella: inv.verifTime ?? '',
    Huella: inv.verifHash ?? '',
    HashAnterior: inv.verifPrevHash ?? '',
    Regimen: inv.verifRegime ?? 'general',
    Estado: inv.status,
  } as const;
}

const CSV_HEADER = 'IDVersionFactura;IDEmisorFactura;NumSerieFactura;FechaExpedicion;NombreEmisor;NombreDestinatario;NIFDestinatario;TipoFactura;CuotaTotal;ImporteTotal;FechaHoraHuella;Huella;HashAnterior;Regimen;Estado';

/** Export all registered invoices as the Veri*factu record line format (CSV). */
export function verifactuCsv(invoices: Invoice[], s: Settings): string {
  const rows = invoices
    .filter((i) => i.verifHash)
    .map((inv) => {
      const r = verifactuRecord(inv, s);
      return [r.IDVersionFactura, r.IDEmisorFactura, r.NumSerieFactura, r.FechaExpedicionFactura, r.NombreRazonSocialEmisor,
        r.NombreRazonSocialDestinatario, r.NIFDestinatario, r.TipoFactura, r.CuotaTotal, r.ImporteTotal,
        r.FechaHoraHuella, r.Huella, r.HashAnterior, r.Regimen, r.Estado].join(';');
    });
  return [CSV_HEADER, ...rows].join('\n');
}
