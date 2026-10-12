/**
 * VERI*FACTU — tipos del módulo fiscal (Spain).
 *
 * Fuente normativa:
 *  - RD 1007/2023 (Reglamento de Sistemas Informáticos de Facturación, SIF)
 *  - Orden HAC/1177/2024, art. 7, 10–13, 20–21 y anexo
 *  - Resolución AEAT 18/12/2024 y especificaciones técnicas de la SEDE
 *
 * Los nombres de tipo internos de este módulo (estados de cola, etc.) NO son
 * códigos de la AEAT: donde la AEAT define un valor, se replica su literal.
 */

/** Modo de conformidad de la factura con Veri*factu (texto reglamentario). */
export type VerifactuModality = 'verifactu' | 'no_verifactu';

/** Ambiente de la remisión: pruebas (preproducción) o producción. */
export type AeatEnvironment = 'test' | 'production';

/**
 * Regímenes de IVA de los desgloses del RegistroAlta.
 * `ClaveRegimen` usa los códigos del anexo de la Orden (Lista L5 …);
 * solo se codifican los usados por el ERP. Pueden ampliarse.
 */
export const CLAVE_REGIMEN: Record<string, string> = {
  general: '01',        // Régimen general
  rebu: '14',           // Bienes usados (REBU, art. 137 LIVA)
  agrario: '02',        // Régimen especial agricultura
  agencias: '03',       // Régimen especial bienes de inversión
  servicios: '07',      // Reglas específicas de servicios
  agencia_vi: '09',     // Agencias de viajes
  octubre_2006: '12',   // Recargo de equivalencia
  seguras: '17',        // Operaciones aseguramiento
};

/**
 * `CalificacionOperacion` del desglose (S1 = sujeta~/no exenta, etc.).
 * Solo los valores más comunes del diseño de registro.
 */
export const CALIFICACION_OPERACION = {
  sujeta: 'S1',                 // Sujeta y no exenta
  exenta: 'E1',                 // Sujeta y exenta (sin derecho a deducción)
  exportacion: 'E2',            // Exenta por exportación
  intracomunitaria: 'E5',       // Exenta por entrega intracomunitaria
  inversion_sujeto: 'I1',       // Inversión del sujeto pasivo
  no_sujeta: 'O1',              // No sujeta
  no_sujeto_fp: 'O2',           // No sujeta por criterio caja (regla general)
} as const;
export type CalificacionOperacion = keyof typeof CALIFICACION_OPERACION;

/**
 * `TipoFactura` conforme a la AEAT (códigos del diseño de registro):
 * F1 factura completa, F2 simplificada, F3 sustitutiva, F4 asiento resumen
 * R1–R5 rectificativas, D/P/…: emitidas bajo otros regímenes.
 */
export type AeatTipoFactura =
  | 'F1' | 'F2' | 'F3' | 'F4'
  | 'R1' | 'R2' | 'R3' | 'R4' | 'R5'
  | 'D' | 'P' | 'B' | 'OT';

/** Tipo de rectificativa (solo en R1–R5): S = por sustitución, I = por_incremento. */
export type TipoRectificativa = 'S' | 'I';

/** Códigos oficiales de huella (Lista L12 del anexo de la Orden). */
export const TIPO_HUELLA_SHA256 = '01';

/** Algoritmo de huella permitido: SHA-256 (Lista L12 del anexo de la Orden). */
export type HuellaAlgoritmo = typeof TIPO_HUELLA_SHA256;

/**
 * Estados internos de un registro en la cola de remisión.
 * (Estados de la aplicación — no códigos oficiales de la AEAT).
 */
export type RegistroEstado =
  | 'PERSISTED'              // Guardado en BD pero aún no encolado
  | 'QUEUED'                 // En cola, pendiente de remisión
  | 'SENDING'                // Remisión en curso
  | 'ACCEPTED'               // Aceptado por la AEAT (`Correcto`)
  | 'ACCEPTED_WITH_ERRORS'   // Aceptado con errores (`AceptadoConErrores`)
  | 'REJECTED'               // Rechazado (`Incorrecto`)
  | 'RETRY_PENDING';         // Esperando siguiente reintento

export const REGISTRO_ESTADOS: RegistroEstado[] = [
  'PERSISTED', 'QUEUED', 'SENDING', 'ACCEPTED', 'ACCEPTED_WITH_ERRORS', 'REJECTED', 'RETRY_PENDING',
];

/** Desglose tributario de un item de invoice para el RegistroAlta. */
export interface DesgloseDetalle {
  /** Código del régimen de este desglose (Lista L5 del anexo de la Orden). */
  ClaveRegimen: string;
  /** Calificación de la operación (sujeta/exenta/no sujeta/inversión, etc.).
   *  Omite el campo cuando la factura es simplificada (TipoFactura = F2). */
  CalificacionOperacion?: string;
  /** Tipo impositivo en %; a 0 cuando es exenta / no sujeta. */
  TipoImpositivo?: number;
  /** Base imponible o importe no sujeto (en formato decimal punto como separador). */
  BaseImponibleOimporteNoSujeto: number;
  /** Cuota repercutida calculada. Opcional para exentas/no sujetas. */
  CuotaRepercutida?: number;
  /** Recargo de equivalencia en %. */
  TipoRecargoEquivalencia?: number;
  /** Cuota del recargo de equivalencia. */
  CuotaRecargoEquivalencia?: number;
}

/**
 * Un registro de facturación construido (alta o anulación) antes de su envío.
 * Los valores de importe se representan como string con 2 decimales y punto,
 * `dd-mm-aaaa` para fechas e ISO-8601 con huso para `FechaHoraHusoGenRegistro`.
 */
export interface BaseFiscalRecord {
  /** Identificador interno de la factura que produjo el registro. */
  invoiceId?: number;
  /** Número de serie y número de factura (NumSerieFactura). */
  NumSerieFactura: string;
  /** Fecha de expedición en formato `dd-mm-aaaa`. */
  FechaExpedicionFactura: string;
  /** Fecha/hora de generación del registro en ISO-8601 con huso horario. */
  FechaHoraHusoGenRegistro: string;
}

/** Registro de facturación de alta (RegistroAlta del diseño). */
export interface RegistroAlta extends BaseFiscalRecord {
  TipoFactura: AeatTipoFactura;
  /** NIF del emisor (IDEmisorFactura). */
  IDEmisorFactura: string;
  /** Nombre/razón social del emisor. */
  NombreRazonSocialEmisor: string;
  /** Nombre/razón social del destinatario (destinatarios del registro). */
  NombreRazonSocialDestinatario?: string;
  /** NIF del destinatario. */
  NIFDestinatario?: string;
  /** Descripción de la operación. */
  DescripcionOperacion: string;
  /** Desgloses de IVA del registro. */
  Desglose: DesgloseDetalle[];
  /** Suma de cuotas del desglose (formato 0.00). */
  CuotaTotal: string;
  /** Importe total de la factura (formato 0.00). */
  ImporteTotal: string;
  /** Huella del registro anterior (vacío en el primer registro). */
  HuellaAnterior?: string;
  /** Indica si es el primer registro del SIF (no hay registro anterior). */
  PrimerRegistro: boolean;
  /** Tipo de rectificativa (solo para R1–R5). */
  TipoRectificativa?: TipoRectificativa;
  /** Facturas rectificadas (número de serie y fecha de expedición). */
  FacturasRectificadas?: { NumSerieFactura: string; FechaExpedicionFactura: string }[];
}

/** Registro de facturación de anulación (RegistroAnulacion del diseño). */
export interface RegistroAnulacion extends BaseFiscalRecord {
  /** NIF del emisor de la factura anulada. */
  IDEmisorFacturaAnulada: string;
  /** Número de serie de la factura anulada. */
  NumSerieFacturaAnulada: string;
  /** Fecha de expedición de la factura anulada. */
  FechaExpedicionFacturaAnulada: string;
  /** Huella del registro anterior (vacía en el primer registro). */
  HuellaAnterior?: string;
  /** Indica si es el primer registro del SIF. */
  PrimerRegistro: boolean;
}

/** Identificación a la AEAT de la instancia de ShopLogic Pro (art. 10.d). */
export interface SistemaInformaticoSpec {
  NombreRazonSocial: string;   // Productor del SIF
  NIF: string;
  NombreSistemaInformatico: string;
  IdSistemaInformatico: string;
  Version: string;
  /** Número de instalación, asignado por el obligado (entre 1 y 100.000). */
  NumeroInstalacion: string;
  TipoUsoPosibleSoloVerifactu: 'S' | 'N';
  TipoUsoPosibleMultiOT: 'S' | 'N';
  IndicadorMultiplesOT: 'S' | 'N';
}

/** Configuración fiscal persistida en settings.verifactu. */
export interface FiscalConfiguration {
  /** Modalidad: VERI*FACTU o NO VERI*FACTU. */
  modality: VerifactuModality;
  /** Ambiente de las remisiones (nunca dejar `production` sin certificado). */
  environment: AeatEnvironment;
  /** Identificación del Sistema Informático de Facturación ante la AEAT. */
  system: SistemaInformaticoSpec;
  /** Claves de regimen y calificación que el ERP aplica a los desgloses. */
  defaults?: {
    ClaveRegimen?: string;
    CalificacionOperacion?: string;
  };
}
