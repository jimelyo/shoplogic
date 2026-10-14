/**
 * VERI*FACTU Companion — facade del asistente (lado renderer).
 *
 * Contiene:
 *  - el tipado y acceso al bridge de Electron del asistente (la contraseña
 *    del .p12 se envía por IPC y muere en el proceso main: aquí no se guarda
 *    ni se re-lee nunca),
 *  - lógica PURA reutilizable desde UI y tests: estadísticas de la cola,
 *    evaluación de caducidad del certificado, validaciones y generador de la
 *    Declaración Responsable del productor del SIF (RD 1007/2023 · Orden
 *    HAC/1177/2024).
 *
 * Reutiliza los componentes validados del módulo (`queue.ts`, `aeat-soap.ts`,
 * `audit.ts`, `fiscal-types.ts`); no duplica huella, XML ni estados.
 */

import { WSDL } from './aeat-soap';
import type { AeatEnvironment, RegistroEstado, SistemaInformaticoSpec } from './fiscal-types';
import { DEFAULT_FISCAL_CONFIG } from './service';
import type { QueueEntry } from './queue';

// --- Bridge de escritorio (Electron) -----------------------------------------

/** Métodos del asistente expuestos por electron/preload.cjs. */
export interface VerifactuCompanionBridge {
  verifactuPickP12?: () => Promise<{ ok: boolean; canceled?: boolean; path?: string; originalName?: string; error?: string }>;
  /** Envía la contraseña al main; el main devuelve SOLO atributos públicos del cert. */
  verifactuValidateP12?: (password: string) => Promise<Pkcs12PublicInfo>;
  verifactuInstallP12?: (password: string) => Promise<{ ok: boolean; configPath?: string; subjectCN?: string; notAfter?: string; error?: string }>;
  verifactuSignerDetail?: () => Promise<SignerDetail>;
  verifactuTestConnection?: (environment: AeatEnvironment) => Promise<ConnectionTestResult>;
}

export function companionBridge(): VerifactuCompanionBridge | null {
  if (typeof window === 'undefined') return null;
  return (window as unknown as { shoplogicDesktop?: VerifactuCompanionBridge }).shoplogicDesktop ?? null;
}

// --- Tipos devueltos por el proceso main -------------------------------------

/** Información PÚBLICA del certificado (nunca clave privada ni contraseña). */
export interface Pkcs12PublicInfo {
  ok: boolean;
  error?: string;
  subjectCN?: string;
  organization?: string;
  serialNumber?: string;
  organizationIdentifier?: string;
  issuerCN?: string;
  notBefore?: string;
  notAfter?: string;
}

export interface SignerDetail {
  configured: boolean;
  configPath: string;
  certPath?: string;
  certCopied?: boolean;
  p12Path?: string;
  p12PasswordSet?: boolean;
  hint?: string;
  /** Atributos PÚBLICOS del certificado (clave privada nunca sale del main). */
  subjectCN?: string;
  organization?: string;
  serialNumber?: string;
  organizationIdentifier?: string;
  issuerCN?: string;
  notBefore?: string;
  notAfter?: string;
  daysLeft?: number | null;
  error?: string;
}

export interface ConnectionTestResult {
  ok: boolean;
  url: string;
  status?: number;
  ms?: number;
  looksLikeWsdl?: boolean;
  error?: string;
}

// --- Estadísticas de la cola (Dashboard de diagnóstico) ----------------------

export interface QueueStats {
  counts: Record<RegistroEstado, number>;
  total: number;
  /** Registros que exigen atención: rechazados o aceptados con errores. */
  incidents: number;
  /** Pendientes de envío o reintento (la cadena local sigue intacta). */
  pending: number;
}

const ALL_STATES: RegistroEstado[] = [
  'PERSISTED', 'QUEUED', 'SENDING', 'ACCEPTED', 'ACCEPTED_WITH_ERRORS', 'REJECTED', 'RETRY_PENDING',
];

export function emptyQueueStats(): QueueStats {
  const counts = Object.fromEntries(ALL_STATES.map((s) => [s, 0])) as Record<RegistroEstado, number>;
  return { counts, total: 0, incidents: 0, pending: 0 };
}

/** Agrega entradas de la cola en estadísticas del dashboard de diagnóstico. */
export function queueStats(entries: Pick<QueueEntry, 'status'>[]): QueueStats {
  const stats = emptyQueueStats();
  for (const e of entries) {
    if (ALL_STATES.includes(e.status)) stats.counts[e.status] += 1;
    else stats.counts.QUEUED += 1; // estado desconocido: no se pierde el conteo
    stats.total += 1;
  }
  stats.incidents = stats.counts.REJECTED + stats.counts.ACCEPTED_WITH_ERRORS;
  stats.pending = stats.counts.QUEUED + stats.counts.RETRY_PENDING + stats.counts.SENDING + stats.counts.PERSISTED;
  return stats;
}

// --- Caducidad del certificado ----------------------------------------------

export type CertValidity = 'unknown' | 'valid' | 'expiring' | 'expired';

/** Umbral de aviso (días) para «el certificado caduca pronto». */
export const CERT_EXPIRING_WARNING_DAYS = 45;

export function certValidity(signer: SignerDetail, now = new Date()): CertValidity {
  if (!signer.notAfter) return 'unknown';
  const notAfter = new Date(signer.notAfter).getTime();
  if (Number.isNaN(notAfter)) return 'unknown';
  if (notAfter <= now.getTime()) return 'expired';
  return daysLeftTo(signer.notAfter, now) !== null && daysLeftTo(signer.notAfter, now)! <= CERT_EXPIRING_WARNING_DAYS
    ? 'expiring'
    : 'valid';
}

/** Días restantes hasta `notAfter` (entero, redondeo hacia abajo); null si imposible. */
export function daysLeftTo(isoDate: string | undefined, now = new Date()): number | null {
  if (!isoDate) return null;
  const t = new Date(isoDate).getTime();
  if (Number.isNaN(t)) return null;
  return Math.floor((t - now.getTime()) / 86_400_000);
}

// --- Validaciones de la Declaración Responsable ------------------------------

const NIF_PENDING = DEFAULT_FISCAL_CONFIG.system.NIF; // 'PENDING-SETUP'

/** Cuestiones que impiden exportar una declaración responsable coherente. */
export function declaracionIssues(system: SistemaInformaticoSpec | undefined, obligadoNif?: string): string[] {
  const issues: string[] = [];
  if (!system) return ['Falta la configuración del sistema informático (settings.verifactuConfig.system).'];
  if (!system.NombreRazonSocial?.trim()) issues.push('Indica el nombre / razón social del productor del SIF.');
  if (!system.NIF?.trim() || system.NIF === NIF_PENDING) issues.push('Indica el NIF real del productor del SIF (ahora es un marcador de posición).');
  if (obligadoNif && system.NIF && system.NIF !== obligadoNif) {
    // No es un incumplimiento (productor ≠ obligado), pero la AEAT cruza la
    // remisión firmada con el certificado del obligado: avisamos.
    issues.push('El NIF del productor difiere del NIF del obligado (tienda): verifica que procede.');
  }
  if (!system.NombreSistemaInformatico?.trim()) issues.push('Indica el nombre del sistema informático.');
  if (!system.IdSistemaInformatico?.trim()) issues.push('Indica el Identificador del sistema informático (IdSistemaInformatico).');
  if (!system.Version?.trim()) issues.push('Indica la versión del sistema informático.');
  const nInst = Number(system.NumeroInstalacion);
  if (!system.NumeroInstalacion?.trim() || !Number.isInteger(nInst) || nInst < 1 || nInst > 100_000) {
    issues.push('El NúmeroInstalación debe ser un entero entre 1 y 100.000, asignado por el obligado.');
  }
  const sOrN = (v: unknown) => v === 'S' || v === 'N';
  if (!sOrN(system.TipoUsoPosibleSoloVerifactu) || !sOrN(system.TipoUsoPosibleMultiOT) || !sOrN(system.IndicadorMultiplesOT)) {
    issues.push('Los indicadores TipoUsoPosibleSoloVerifactu / TipoUsoPosibleMultiOT / IndicadorMultiplesOT deben ser "S" o "N".');
  }
  if (system.TipoUsoPosibleSoloVerifactu === 'S' && system.TipoUsoPosibleMultiOT === 'S') {
    issues.push('Configuración inconsistente: no puede declararse a la vez «solo VERI*FACTU» y uso multi-OT permitido. Revisa el art. 10.d de la Orden.');
  }
  return issues;
}

// --- Generador de la Declaración Responsable ----------------------------------

export interface DeclaracionContext {
  /** Nombre comercial de la tienda (settings.storeName) para el encabezado. */
  storeName?: string;
  /** NIF del obligado tributario (settings.cif), informativo. */
  obligadoNif?: string;
  /** Fecha del documento (ISO yyyy-MM-dd); por defecto, hoy. */
  date?: string;
}

const S_OR_N_LABEL: Record<'S' | 'N', string> = { S: 'Sí', N: 'No' };

/**
 * Documento HTML imprimible que sirve como Declaración Responsable del
 * productor del SIF conforme al RD 1007/2023 y la Orden HAC/1177/2024
 * (art. 10.d): la AEAT no homologa software; este documento acredita la
 * conformidad del productor. Función pura (testeable).
 */
export function declaracionResponsableHtml(system: SistemaInformaticoSpec, ctx: DeclaracionContext = {}): string {
  const fecha = ctx.date ?? new Date().toISOString().slice(0, 10);
  const row = (th: string, td: string) => `<tr><th scope="row">${escapeHtml(th)}</th><td>${escapeHtml(td)}</td></tr>`;
  const rows: string[] = [
    row('Denominación / razón social del productor', system.NombreRazonSocial || '—'),
    row('NIF del productor', system.NIF || '—'),
    row('Nombre del sistema informático', system.NombreSistemaInformatico || '—'),
    row('Identificador del sistema (IdSistemaInformatico)', system.IdSistemaInformatico || '—'),
    row('Versión del sistema', system.Version || '—'),
    row('Número de instalación', system.NumeroInstalacion || '—'),
    row('Tipo de uso posible — exclusivamente VERI*FACTU', S_OR_N_LABEL[system.TipoUsoPosibleSoloVerifactu] ?? (system.TipoUsoPosibleSoloVerifactu || '—')),
    row('Tipo de uso posible — múltiples obligados tributarios (MultiOT)', S_OR_N_LABEL[system.TipoUsoPosibleMultiOT] ?? (system.TipoUsoPosibleMultiOT || '—')),
    row('Indicador de múltiples obligados', S_OR_N_LABEL[system.IndicadorMultiplesOT] ?? (system.IndicadorMultiplesOT || '—')),
  ];
  const storeBlock = ctx.obligadoNif || ctx.storeName
    ? `<p class="muted">Obligado tributario titular de la instalación: <b>${escapeHtml(ctx.storeName || '—')}</b>${ctx.obligadoNif ? ` · NIF <b>${escapeHtml(ctx.obligadoNif)}</b>` : ''}</p>`
    : '';
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<title>Declaración Responsable — ${escapeHtml(system.NombreSistemaInformatico || 'SIF')} (${fecha})</title>
<style>
 body { font-family: Georgia, 'Times New Roman', serif; max-width: 780px; margin: 40px auto; color: #111; line-height: 1.55; }
 h1 { font-size: 20px; text-align: center; margin: 0 0 4px; }
 h2 { font-size: 14px; margin-top: 28px; border-bottom: 1px solid #ccc; padding-bottom: 4px; }
 .subtitle { text-align: center; color: #555; font-size: 12px; margin-bottom: 24px; }
 table { border-collapse: collapse; width: 100%; font-size: 13px; }
 th, td { border: 1px solid #bbb; padding: 6px 10px; text-align: left; vertical-align: top; }
 th { width: 46%; background: #f4f4f4; font-weight: normal; }
 .muted { color: #555; font-size: 12px; }
 .clauses li { margin-bottom: 8px; font-size: 13px; }
 .sign { margin-top: 56px; display: flex; gap: 40px; font-size: 13px; }
 .sign div { flex: 1; }
 .line { border-top: 1px solid #000; margin-top: 48px; width: 260px; padding-top: 4px; }
 @media print { body { margin: 12mm; } .noprint { display: none; } }
</style>
</head>
<body>
<h1>DECLARACIÓN RESPONSABLE</h1>
<p class="subtitle">Productor de Sistema Informático de Facturación — art. 10 del RD 1007/2023 y Orden HAC/1177/2024 · Fecha: ${fecha}</p>
<p class="muted">Sistema de facturación en el que se integra el módulo fiscal: <b>ShopLogic Pro</b>${ctx.storeName ? ` — instalación de <b>${escapeHtml(ctx.storeName)}</b>` : ''}</p>
${storeBlock}
<h2>1. Identificación del productor y del sistema informático</h2>
<table>${rows.join('\n')}</table>
<h2>2. Declara el productor</h2>
<ol class="clauses">
 <li>Que el sistema informático indicado cumple los requisitos establecidos en el RD 1007/2023, de 5 de diciembre, y en la Orden HAC/1177/2024, de 28 de noviembre, por la que se desarrolla: permanencia e inalterabilidad de los registros, trazabilidad, encadenamiento cronológico de huellas y cálculo forense de la huella SHA-256 conforme a las especificaciones v0.1.2 de la AEAT.</li>
 <li>Que el sistema garantiza la expedición y conservación de las facturas con su contenido, que los registros remitidos no se modifican una vez emitidos y que todo rectificado se realiza mediante facturas rectificativas (R1–R5) o registros de anulación conforme a la Orden.</li>
 <li>Que el sistema permite la remisión de los registros de facturación mediante el servicio web VERI*FACTU de la AEAT y genera el código QR reglamentario con la nota «VERI*FACTU» o «NO VERI*FACTU» según la modalidad configurada por el obligado.</li>
 <li>Que el sistema pone a disposición del obligado y del destinatario de las facturas la información legible exigida, incluido el estado de la remisión a la AEAT cuando resulte aplicable.</li>
 <li>Que el productor comunicará a la AEAT las incidencias, parches y versiones del sistema conforme al art. 14 del RD 1007/2023, y que una copia firmada de esta declaración se conserva a disposición de la AEAT durante el periodo exigido.</li>
</ol>
<h2>3. Aceptación</h2>
<p class="muted">El abajo firmante, en su condición de productor del sistema informático de facturación identificado en el punto 1, acepta lo declarado y se compromete a mantener el cumplimiento de los requisitos hasta la baja del sistema.</p>
<div class="sign">
 <div><div class="line">Nombre del representante del productor</div></div>
 <div><div class="line">Firma del representante</div></div>
</div>
<p class="noprint muted" style="margin-top:32px">Documento generado automáticamente por ShopLogic Pro. Imprime esta página (o guárdala como PDF) para firmarla y conservarla.</p>
</body>
</html>`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** Nombre de fichero de la declaración. */
export function declaracionFilename(systemId: string, date = new Date().toISOString().slice(0, 10)): string {
  const safe = systemId.replace(/[^\w.-]+/g, '_').slice(0, 40) || 'sif';
  return `declaracion-responsable_${safe}_${date}.html`;
}
