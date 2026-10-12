/**
 * Vectores de prueba OFICIALES del documento AEAT
 * «Detalle de las especificaciones técnicas para generación de la huella o
 * hash de los registros de facturación», v 0.1.2 (27/08/2024), sección 6.
 * No se pueden inventar: deben reproducirse tal cual.
 */

import { describe, it, expect } from 'vitest';
import {
  hashStringAlta, hashStringAnulacion, huellaAlta, huellaAnulacion, sha256Upper,
  AEAT_HUELLA_VECTORES, money,
} from '../fiscal-hash';

const V = AEAT_HUELLA_VECTORES;

describe('FiscalHashService — vectores oficiales AEAT v0.1.2', () => {
  it('Caso 1: primer registro de facturación (alta) — Huella vacía', async () => {
    const s = hashStringAlta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      HuellaAnterior: '',
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    });
    // El string oficial no lleva espacios: se reconstruye exacto.
    expect(s).toBe(V.alta1.hashString);
    expect(await huellaAlta({
      IDEmisorFactura: '89890001K', NumSerieFactura: '12345678/G33', FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1', CuotaTotal: '12.35', ImporteTotal: '123.45', HuellaAnterior: '',
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    })).toBe('3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
  });

  it('Caso 2: segundo registro (alta) — encadena con la huella anterior', async () => {
    const prev = '3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60';
    expect(await huellaAlta({
      IDEmisorFactura: '89890001K', NumSerieFactura: '12345679/G34', FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1', CuotaTotal: '12.35', ImporteTotal: '123.45', HuellaAnterior: prev,
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
    })).toBe('F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97');
  });

  it('Caso 3: registro de anulación con registro anterior', async () => {
    const prev = 'F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97';
    expect(await huellaAnulacion({
      IDEmisorFacturaAnulada: '89890001K', NumSerieFacturaAnulada: '12345679/G34',
      FechaExpedicionFacturaAnulada: '01-01-2024', HuellaAnterior: prev,
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
    })).toBe('177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68');
  });

  it('los hashes string oficiales del doc. 0.1.2 son exactos', () => {
    expect(V.alta1.hashString).toBe(
      'IDEmisorFactura=89890001K&NumSerieFactura=12345678/G33&FechaExpedicionFactura=01-01-2024&TipoFactura=F1&CuotaTotal=12.35&ImporteTotal=123.45&Huella=&FechaHoraHusoGenRegistro=2024-01-01T19:20:30+01:00',
    );
    expect(V.anulacion.hashString).toBe(
      'IDEmisorFacturaAnulada=89890001K&NumSerieFacturaAnulada=12345679/G34&FechaExpedicionFacturaAnulada=01-01-2024&Huella=F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97&FechaHoraHusoGenRegistro=2024-01-01T19:20:40+01:00',
    );
  });

  it('salida: hex en mayúsculas, 64 caracteres', async () => {
    const h = await sha256Upper('x');
    expect(h).toMatch(/^[0-9A-F]{64}$/);
  });

  it('money: formato oficial 0.00 con punto', () => {
    expect(money(123.456)).toBe('123.46');
    expect(money(-0.5)).toBe('-0.50');
    expect(money(0)).toBe('0.00');
  });

  it('trim de valores (regla 3 del doc oficial)', () => {
    expect(hashStringAlta({
      IDEmisorFactura: ' 89890001K ', NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024', TipoFactura: 'F1', CuotaTotal: '12.35',
      ImporteTotal: '123.45', HuellaAnterior: '', FechaHoraHusoGenRegistro: 'x',
    })).toContain('IDEmisorFactura=89890001K&');
  });

  it('referencias de vectores congruentes con los hashes oficiales', () => {
    expect(V.alta1.huella).toBe('3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
    expect(V.alta2.huella).toBe('F7B94CFD8924EDFF273501B01EE5153E4CE8F259766F88CF6ACB8935802A2B97');
    expect(V.anulacion.huella).toBe('177547C0D57AC74748561D054A9CEC14B4C4EA23D1BEFD6F2E69E3A388F90C68');
  });
});
