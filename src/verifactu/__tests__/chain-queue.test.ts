import { describe, it, expect, beforeEach } from 'vitest';
import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { chainAlta, chainAnulacion } from '../fiscal-chain';
import { AEAT_HUELLA_VECTORES } from '../fiscal-hash';

describe('FiscalChainService — encadenamiento (Orden art. 7 y 13)', () => {
  it('primer registro: huella previa vacía y marca PrimerRegistro', async () => {
    const r = await chainAlta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345678/G33',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      prevHash: '',
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    });
    expect(r.primerRegistro).toBe(true);
    expect(r.huellaAnterior).toBe('');
    expect(r.huella).toBe('3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60');
  });

  it('segundo registro: cadena reproducible del vector oficial', async () => {
    const prev = AEAT_HUELLA_VECTORES.alta1.huella;
    const r = await chainAlta({
      IDEmisorFactura: '89890001K',
      NumSerieFactura: '12345679/G34',
      FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1',
      CuotaTotal: '12.35',
      ImporteTotal: '123.45',
      prevHash: prev,
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:35+01:00',
    });
    expect(r.primerRegistro).toBe(false);
    expect(r.huellaAnterior).toBe(prev);
    expect(r.huella).toBe(AEAT_HUELLA_VECTORES.alta2.huella);
  });

  it('anulación encadenada (vector oficial caso 3)', async () => {
    const r = await chainAnulacion({
      IDEmisorFacturaAnulada: '89890001K',
      NumSerieFacturaAnulada: '12345679/G34',
      FechaExpedicionFacturaAnulada: '01-01-2024',
      prevHash: AEAT_HUELLA_VECTORES.alta2.huella,
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:40+01:00',
    });
    expect(r.huella).toBe(AEAT_HUELLA_VECTORES.anulacion.huella);
  });

  it('huella distinta si cambia cualquier campo (sensibilidad integral)', async () => {
    const base = {
      IDEmisorFactura: '89890001K', NumSerieFactura: '1', FechaExpedicionFactura: '01-01-2024',
      TipoFactura: 'F1', CuotaTotal: '1', ImporteTotal: '2', prevHash: '',
      FechaHoraHusoGenRegistro: '2024-01-01T19:20:30+01:00',
    } as const;
    const a = await chainAlta(base);
    const b = await chainAlta({ ...base, ImporteTotal: '2.01' });
    expect(a.huella).not.toBe(b.huella);
  });
});
