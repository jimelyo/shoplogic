/**
 * Tests del VERI*FACTU Companion (asistente) — lógica pura:
 * estadísticas de la cola, caducidad del certificado, validaciones de la
 * Declaración Responsable y generador del documento.
 */

import { describe, expect, it } from 'vitest';
import 'fake-indexeddb/auto';
import {
  CERT_EXPIRING_WARNING_DAYS,
  certValidity,
  declaracionFilename,
  declaracionIssues,
  declaracionResponsableHtml,
  daysLeftTo,
  emptyQueueStats,
  queueStats,
} from '../companion';
import type { QueueEntry } from '../queue';
import type { RegistroEstado, SistemaInformaticoSpec } from '../fiscal-types';
import { DEFAULT_FISCAL_CONFIG } from '../service';

/** Helper tipado: entrada mínima de la cola con solo `status`. */
const entry = (status: RegistroEstado): Pick<QueueEntry, 'status'> => ({ status });

const FUTURE = (days: number, from = new Date('2026-01-15T00:00:00Z')) =>
  new Date(from.getTime() + days * 86_400_000).toISOString();

describe('queueStats', () => {
  it('devuelve estadísticas vacías por defecto', () => {
    const s = emptyQueueStats();
    expect(s.total).toBe(0);
    expect(s.incidents).toBe(0);
    expect(s.pending).toBe(0);
    for (const n of Object.values(s.counts)) expect(n).toBe(0);
  });

  it('cuenta cada estado y marca incidencias/pendientes', () => {
    const s = queueStats([
      entry('ACCEPTED'), entry('ACCEPTED'), entry('ACCEPTED_WITH_ERRORS'),
      entry('REJECTED'), entry('QUEUED'), entry('RETRY_PENDING'), entry('SENDING'),
    ]);
    expect(s.total).toBe(7);
    expect(s.counts.ACCEPTED).toBe(2);
    expect(s.counts.ACCEPTED_WITH_ERRORS).toBe(1);
    expect(s.counts.REJECTED).toBe(1);
    expect(s.incidents).toBe(2); // REJECTED + ACCEPTED_WITH_ERRORS
    expect(s.pending).toBe(3);   // QUEUED + RETRY_PENDING + SENDING
  });

  it('ignora estados inválidos sin dejar de contar la fila', () => {
    const s = queueStats([entry('ACCEPTED'), { status: 'X_DESCONOCIDO' as never }]);
    expect(s.total).toBe(2);
    expect(s.counts.QUEUED).toBe(1); // el desconocido cae en QUEUED para no perder el conteo
  });

  it('una cola 100% aceptada no marca pendientes ni incidencias', () => {
    const s = queueStats([entry('ACCEPTED'), entry('SENDING')]);
    expect(s.pending).toBe(1);
    expect(s.incidents).toBe(0);
  });
});

describe('certValidity / daysLeftTo', () => {
  it('calcula días restantes hasta la caducidad', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(daysLeftTo(FUTURE(10), now)).toBe(10);
    expect(daysLeftTo(FUTURE(0.5), now)).toBe(0);
    expect(daysLeftTo(undefined, now)).toBeNull();
  });

  it('marca expired cuando ya venció, valid dentro del margen y expiring cuando está cerca', () => {
    const now = new Date('2026-01-15T00:00:00Z');
    expect(certValidity({ notAfter: FUTURE(-1) } as never, now)).toBe('expired');
    expect(certValidity({ notAfter: FUTURE(400) } as never, now)).toBe('valid');
    expect(certValidity({ notAfter: FUTURE(Math.floor(CERT_EXPIRING_WARNING_DAYS / 2)) } as never, now)).toBe('expiring');
    expect(certValidity({ notAfter: FUTURE(CERT_EXPIRING_WARNING_DAYS + 1) } as never, now)).toBe('valid');
  });

  it('unknown sin fechas o inválidas', () => {
    expect(certValidity({} as never)).toBe('unknown');
    expect(certValidity({ notAfter: 'no-es-fecha' } as never, new Date())).toBe('unknown');
  });
});

describe('declaracionIssues', () => {
  const okSystem = (): SistemaInformaticoSpec => ({
    ...DEFAULT_FISCAL_CONFIG.system,
    NIF: 'B12345678',
    NombreRazonSocial: 'Tienda Demo S.L.',
    NumeroInstalacion: '7',
  });

  it('acepta una configuración completa y coherente', () => {
    expect(declaracionIssues(okSystem(), 'B12345678')).toEqual([]);
  });

  it('exige NIF real del productor (no el marcador de posición)', () => {
    const s = okSystem();
    s.NIF = DEFAULT_FISCAL_CONFIG.system.NIF;
    const issues = declaracionIssues(s);
    expect(issues.some((i) => i.includes('NIF'))).toBe(true);
  });

  it('valida el rango 1–100.000 del NúmeroInstalacion', () => {
    const s = okSystem();
    s.NumeroInstalacion = '0';
    expect(declaracionIssues(s)).toHaveLength(1);
    s.NumeroInstalacion = '100001';
    expect(declaracionIssues(s)).toHaveLength(1);
    s.NumeroInstalacion = '100000';
    expect(declaracionIssues(s)).toEqual([]);
  });

  it('avisa cuando el NIF del productor difiere del obligado', () => {
    const issues = declaracionIssues(okSystem(), 'B99999999');
    expect(issues.some((i) => i.includes('difiere'))).toBe(true);
  });

  it('detecta la combinación imposible solo-VERI*FACTU + MultiOT', () => {
    const s = okSystem();
    s.TipoUsoPosibleSoloVerifactu = 'S';
    expect(declaracionIssues(s)).toHaveLength(1);
    s.TipoUsoPosibleMultiOT = 'N';
    expect(declaracionIssues(s)).toEqual([]);
  });

  it('sin configuración devuelve el issue de ausencia', () => {
    expect(declaracionIssues(undefined)).toEqual([expect.stringContaining('sistema informático')]);
  });
});

describe('declaracionResponsableHtml', () => {
  const system: SistemaInformaticoSpec = {
    NombreRazonSocial: 'Fábrica SIF S.L.',
    NIF: 'B12345678',
    NombreSistemaInformatico: 'ShopLogic Pro',
    IdSistemaInformatico: 'SHOPLOGIC-ERP-01',
    Version: '1.3.1',
    NumeroInstalacion: '42',
    TipoUsoPosibleSoloVerifactu: 'N',
    TipoUsoPosibleMultiOT: 'S',
    IndicadorMultiplesOT: 'S',
  };

  it('incluye los campos oficiales del art. 10.d en el documento', () => {
    const html = declaracionResponsableHtml(system, { date: '2026-10-14' });
    for (const needle of [
      'Fábrica SIF S.L.', 'B12345678', 'SHOPLOGIC-ERP-01', '1.3.1', '42',
      'RD 1007/2023', 'HAC/1177/2024', 'DECLARACIÓN RESPONSABLE', '2026-10-14',
    ]) {
      expect(html).toContain(needle);
    }
  });

  it('traduce los indicadores S/N a Sí/No', () => {
    const html = declaracionResponsableHtml({ ...system, TipoUsoPosibleMultiOT: 'N' });
    expect(html).toContain('No</td>');
  });

  it('escapa el HTML de los campos para evitar inyección', () => {
    const html = declaracionResponsableHtml({
      ...system,
      NombreRazonSocial: 'Evil & Co <script>alert(1)</script>',
    });
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).toContain('Evil &amp; Co &lt;script&gt;');
  });

  it('nombre de fichero seguro y fechado', () => {
    expect(declaracionFilename('SHOPLOGIC-ERP-01', '2026-10-14'))
      .toBe('declaracion-responsable_SHOPLOGIC-ERP-01_2026-10-14.html');
    expect(declaracionFilename('algo raro/espacios').startsWith('declaracion-responsable_')).toBe(true);
  });
});
