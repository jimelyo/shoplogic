/**
 * FiscalQrService — código QR reglamentario (Orden HAC/1177/2024, art. 20–21).
 *
 * El contenido del QR es la «URL del servicio de cotejo o remisión de
 * información por parte del receptor de la factura», con los datos de la
 * factura codificados en ella. URLs y parámetros según la especificación de
 * la SEDE de la AEAT:
 *
 *   VERI*FACTU     Producción: https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR
 *                  Pruebas:    https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR
 *   NO VERI*FACTU  Producción: https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu
 *                  Pruebas:    https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu
 *
 * Formato de los parámetros (verificado contra el endpoint real de producción,
 * que rechaza la petición sin `nif`, y contra ejemplos de la documentación):
 *   nif      = NIF del obligado a expedir la factura
 *   numserie = número de serie y número de la factura (URL-encoded)
 *   fecha    = dd-mm-aaaa
 *   importe  = importe total de la factura (punto decimal)
 */

import type { AeatEnvironment, VerifactuModality } from './fiscal-types';

const QR_URLS: Record<AeatEnvironment, Record<VerifactuModality, string>> = {
  production: {
    verifactu: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR',
    no_verifactu: 'https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
  },
  test: {
    verifactu: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR',
    no_verifactu: 'https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQRNoVerifactu',
  },
};

export interface QrInvoiceData {
  nif: string;
  numserie: string;
  /** `dd-mm-aaaa` */
  fecha: string;
  /** Importe total (punto decimal, 2 decimales). */
  importe: string | number;
}

/** Codifica un parámetro con `encodeURIComponent` (URL-safe). */
function enc(v: string): string {
  return encodeURIComponent(v);
}

/**
 * Devuelve la URL exacta que debe ir DENTRO del QR para la factura indicada.
 * Es la misma URL que se expone como campo independiente cuando la factura
 * es electrónica (art. 20.2 de la Orden).
 */
export function qrUrl(data: QrInvoiceData, modality: VerifactuModality = 'verifactu', env: AeatEnvironment = 'production'): string {
  const base = QR_URLS[env][modality];
  const importe = typeof data.importe === 'number' ? data.importe.toFixed(2) : data.importe;
  return `${base}?nif=${enc(data.nif)}&numserie=${enc(data.numserie)}&fecha=${enc(data.fecha)}&importe=${enc(importe)}`;
}

/** Tamaño reglamentario del QR en mm (art. 21.1: 30x30 a 40x40 mm). */
export const QR_SIZE_MM = { min: 30, max: 40, recommended: 35 } as const;

/** Nivel de corrección de errores exigido (art. 21.1): M (medio). */
export const QR_ERROR_CORRECTION = 'M' as const;

/**
 * Frase reglamentaria que debe acompañar al QR en facturas emitidas por
 * sistemas VERI*FACTU (art. 20.1.b de la Orden): «Factura verificable en la
 * sede electrónica de la AEAT» o «VERI*FACTU».
 */
export const VERIFACTU_LEYENDA = 'VERI*FACTU';
export const VERIFACTU_FRASE = 'Factura verificable en la sede electrónica de la AEAT';
