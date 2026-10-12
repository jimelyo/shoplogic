/**
 * FiscalHashService — cálculo de la huella o "hash" SHA-256 conforme a la
 * especificación oficial de la AEAT:
 *
 *   «Detalle de las especificaciones técnicas para generación de la huella o
 *    hash de los registros de facturación», versión 0.1.2 (27/08/2024),
 *    publicado en la SEDE de la AEAT; desarrolla el art. 13 de la Orden
 *    HAC/1177/2024.
 *
 * Reglas clave implementadas (extraídas del documento oficial):
 *  1. La información se toma de 8 campos del RegistroAlta / 3 del RegistroAnulación,
 *     EN el orden enunciado (alta: IDEmisorFactura, NumSerieFactura,
 *     FechaExpedicionFactura, TipoFactura, CuotaTotal, ImporteTotal, Huella,
 *     FechaHoraHusoGenRegistro).
 *  2. Se concatena como `nombreCampo=valorCampo&nombreCampoN=valorCampoN`.
 *  3. Los espacios al inicio y al final de cada valor se eliminan.
 *  4. En campos numéricos se validan indistintamente formatos con 1 o 2 decimales
 *     sin que los ceros a la derecha alteren el cálculo.
 *  5. Si un campo no aparece (o no tiene valor): `nombreCampo=` (con "=").
 *  6. Solo se utilizan `CuotaTotal` e `ImporteTotal` del fichero XML.
 *  7. La cadena se codifica en UTF-8 antes de calcular la huella.
 *  8. El formato de salida es: hexadecimal, mayúsculas, 64 caracteres.
 *  9. Se calcula SIEMPRE el hash del registro, incluso en el primer registro
 *     (campo Huella vacío en la cadena).
 */

const te = new TextEncoder();

const toHexUpper = (bytes: Uint8Array): string =>
  Array.from(bytes, (b) => b.toString(16).padStart(2, '0').toUpperCase()).join('');

/** Normaliza un valor a cadena: trim de espacios contiguos exterior (párrafo 3 del doc). */
function normalizeValue(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  return String(v).trim();
}

/** Suma una parte de la cadena con el formato oficial `nombre=valor`. */
function appendField(parts: string[], name: string, value: string): void {
  parts.push(`${name}=${value}`);
}

/** Serializa la cadena completa con el formato oficial `a=1&b=2&...`. */
export function buildHashString(parts: string[]): string {
  return parts.join('&');
}

/**
 * Convierte un importe a texto canónico en notación decimal con punto,
 * conservando hasta 2 decimales pero eliminando ceros redundantes a la
 * derecha tras la coma (`123.10` -> `123.1`; `123.00` -> `123.00` se
 * representa igual — ver regla 4 del doc. oficial).
 */
export function money(n: number): string {
  const v = Number.isFinite(n) ? n : 0;
  const fixed = Math.abs(v).toFixed(2);
  const sign = v < 0 ? '-' : '';
  // 123.00 -> "123.00"; 123.10 -> "123.10": ambos formatos son válidos para
  // el hash (regla 4). No se recortan ceros a la derecha deliberadamente: se
  // mantiene la representación 0.00 para consistencia interna.
  return sign + fixed;
}

/**
 * Campos del Registro de facturación de AlTA, en el orden oficial del punto 3.a
 * del documento de la AEAT.
 */
export interface AltaHashInput {
  IDEmisorFactura: string;
  NumSerieFactura: string;
  /** `dd-mm-aaaa` */
  FechaExpedicionFactura: string;
  TipoFactura: string;
  /** Importes ya en formato oficial (string con punto). */
  CuotaTotal: string | number;
  ImporteTotal: string | number;
  /** Huella del registro anterior; vacía para el primer registro. */
  HuellaAnterior?: string;
  /** ISO-8601 con huso horario. */
  FechaHoraHusoGenRegistro: string;
}

/** Campos del Registro de facturación de ANULACIÓN, en el orden oficial (punto 3.b). */
export interface AnulacionHashInput {
  IDEmisorFacturaAnulada: string;
  NumSerieFacturaAnulada: string;
  FechaExpedicionFacturaAnulada: string;
  HuellaAnterior?: string;
  FechaHoraHusoGenRegistro: string;
}

/** Cadena oficial de hash para un RegistroAlta (con Huella= vacía si no hay anterior). */
export function hashStringAlta(input: AltaHashInput): string {
  const parts: string[] = [];
  appendField(parts, 'IDEmisorFactura', normalizeValue(input.IDEmisorFactura));
  appendField(parts, 'NumSerieFactura', normalizeValue(input.NumSerieFactura));
  appendField(parts, 'FechaExpedicionFactura', normalizeValue(input.FechaExpedicionFactura));
  appendField(parts, 'TipoFactura', normalizeValue(input.TipoFactura));
  appendField(parts, 'CuotaTotal', normalizeValue(input.CuotaTotal));
  appendField(parts, 'ImporteTotal', normalizeValue(input.ImporteTotal));
  appendField(parts, 'Huella', normalizeValue(input.HuellaAnterior));
  appendField(parts, 'FechaHoraHusoGenRegistro', normalizeValue(input.FechaHoraHusoGenRegistro));
  return buildHashString(parts);
}

/** Cadena oficial de hash para un RegistroAnulacion. */
export function hashStringAnulacion(input: AnulacionHashInput): string {
  const parts: string[] = [];
  appendField(parts, 'IDEmisorFacturaAnulada', normalizeValue(input.IDEmisorFacturaAnulada));
  appendField(parts, 'NumSerieFacturaAnulada', normalizeValue(input.NumSerieFacturaAnulada));
  appendField(parts, 'FechaExpedicionFacturaAnulada', normalizeValue(input.FechaExpedicionFacturaAnulada));
  appendField(parts, 'Huella', normalizeValue(input.HuellaAnterior));
  appendField(parts, 'FechaHoraHusoGenRegistro', normalizeValue(input.FechaHoraHusoGenRegistro));
  return buildHashString(parts);
}

/** SHA-256, UTF-8, hexadecimal en MAYÚSCULAS (formato oficial de salida). */
export async function sha256Upper(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) throw new Error('WebCrypto.subtle no disponible');
  const buf = await crypto.subtle.digest('SHA-256', te.encode(input) as BufferSource);
  return toHexUpper(new Uint8Array(buf));
}

/** Huella oficial para un Registro de Alta. */
export async function huellaAlta(input: AltaHashInput): Promise<string> {
  return sha256Upper(hashStringAlta(input));
}

/** Huella oficial para un Registro de Anulación. */
export async function huellaAnulacion(input: AnulacionHashInput): Promise<string> {
  return sha256Upper(hashStringAnulacion(input));
}

export const AEAT_HUELLA_DOC = {
  /** Documento oficial del que se ha tomado el algoritmo. */
  doc: 'Veri-Factu_especificaciones_huella_hash_registros.pdf',
  version: '0.1.2',
  fecha: '27/08/2024',
  fuente: 'https://www.agenciatributaria.es/static_files/AEAT_Desarrolladores/EEDD/IVA/VERI-FACTU/Veri-Factu_especificaciones_huella_hash_registros.pdf',
} as const;

export const AEAT_HUELLA_VECTORES = {
  alta1: {
    hashString:
      'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00',
    huella: '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F3' + '8F12F60',
  },
  alta2: {
    hashString:
      'IDEmisorFactura=89890001K&NumSerieFactura=12345679/G34&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F3' + '8F12F60' + '&FechaHoraHusoGenRegistro=2024-01-01T19:20:35+01:00',
    huella: 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802' + 'A2B97',
  },
  anulacion: {
    hashString:
      'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802' + 'A2B97' + '&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00',
    huella: '177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388' + 'F90C68',
  },
} as const;
