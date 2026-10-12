/**
 * FiscalChainService — encadenamiento de registros de facturación.
 *
 * Orden HAC/1177/2024, art. 7–8: los RF conforman una cadena en la que chaque
 * registro contiene la huella del inmediatamente anterior (por orden cronológico
 * de generación en el SIF), garantizando trazabilidad e inalterabilidad.
 *
 * El primer registro del SIF se marca con `PrimerRegistro=S` y NO lleva
 * huella anterior (la cadena se calcula con Huella= vacía en ese caso).
 */

import { huellaAlta, huellaAnulacion, money } from './fiscal-hash';

export interface ChainAltaInput {
  /** NIF del emisor de la factura. */
  IDEmisorFactura: string;
  NumSerieFactura: string;
  /** `dd-mm-aaaa` */
  FechaExpedicionFactura: string;
  TipoFactura: string;
  CuotaTotal: string | number;
  ImporteTotal: string | number;
  /** ISO-8601 con huso horario. */
  FechaHoraHusoGenRegistro: string;
  /** Huella del `registroAnterior` (inexistente si es el primer registro del SIF). */
  prevHash?: string;
}

export interface ChainAnulacionInput {
  IDEmisorFacturaAnulada: string;
  NumSerieFacturaAnulada: string;
  FechaExpedicionFacturaAnulada: string;
  FechaHoraHusoGenRegistro: string;
  prevHash?: string;
}

export interface ChainResult {
  /** Huella del NUEVO registro (hex MAYÚSCULAS). */
  huella: string;
  /** Huella que se informará como "Huella del registro anterior". */
  huellaAnterior: string;
  /** true = primer registro del SIF (sin huella anterior). */
  primerRegistro: boolean;
}

/** Genera la huella del registro de ALTA especificado encadenándolo con su predecesor. */
export async function chainAlta(input: ChainAltaInput): Promise<ChainResult> {
  const prev = input.prevHash?.trim() ? input.prevHash.toUpperCase() : '';
  const huella = await huellaAlta({
    IDEmisorFactura: input.IDEmisorFactura,
    NumSerieFactura: input.NumSerieFactura,
    FechaExpedicionFactura: input.FechaExpedicionFactura,
    TipoFactura: input.TipoFactura,
    CuotaTotal: input.CuotaTotal,
    ImporteTotal: input.ImporteTotal,
    HuellaAnterior: prev,
    FechaHoraHusoGenRegistro: input.FechaHoraHusoGenRegistro,
  });
  return { huella, huellaAnterior: prev, primerRegistro: !prev };
}

/** Genera la huella del registro de ANULACIÓN especificado encadenándolo con su predecesor. */
export async function chainAnulacion(input: ChainAnulacionInput): Promise<ChainResult> {
  const prev = input.prevHash?.trim() ? input.prevHash.toUpperCase() : '';
  const huella = await huellaAnulacion({
    IDEmisorFacturaAnulada: input.IDEmisorFacturaAnulada,
    NumSerieFacturaAnulada: input.NumSerieFacturaAnulada,
    FechaExpedicionFacturaAnulada: input.FechaExpedicionFacturaAnulada,
    HuellaAnterior: prev,
    FechaHoraHusoGenRegistro: input.FechaHoraHusoGenRegistro,
  });
  return { huella, huellaAnterior: prev, primerRegistro: !prev };
}

/**
 * Utilidad para importes oficiales: formatea un número con separador decimal
 * punto y 2 decimales (con excepciones cuando el doc. oficial admite 1 decimal).
 */
export const officialMoney = money;
