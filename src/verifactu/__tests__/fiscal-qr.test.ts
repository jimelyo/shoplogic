import { describe, it, expect } from 'vitest';
import { qrUrl, QR_SIZE_MM, QR_ERROR_CORRECTION, VERIFACTU_FRASE, VERIFACTU_LEYENDA } from '../fiscal-qr';

describe('FiscalQrService — Orden HAC/1177/2024 art. 20–21', () => {
  it('URL base de producción y de pruebas (VERI*FACTU)', () => {
    const u = qrUrl({ nif: 'B43752210', numserie: 'E-12345', fecha: '23-04-2025', importe: '123.45' }, 'verifactu', 'production');
    expect(u.startsWith('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR')).toBe(true);
    const t = qrUrl({ nif: 'B43752210', numserie: 'E-12345', fecha: '23-04-2025', importe: '123.45' }, 'verifactu', 'test');
    expect(t.startsWith('https://prewww2.aeat.es/wlpl/TIKE-CONT/ValidarQR')).toBe(true);
  });

  it('NO VERI*FACTU usa el endpoint ValidarQRNoVerifactu', () => {
    const u = qrUrl({ nif: 'B', numserie: '1', fecha: '01-01-2024', importe: '10' }, 'no_verifactu', 'production');
    expect(u).toContain('ValidarQRNoVerifactu');
  });

  it('parámetros nif, numserie, fecha (dd-mm-aaaa) e importe con punto', () => {
    const u = qrUrl({ nif: 'B43752210', numserie: 'E-12345', fecha: '23-04-2025', importe: '123.45' });
    expect(u).toBe('https://www2.agenciatributaria.gob.es/wlpl/TIKE-CONT/ValidarQR?nif=B43752210&numserie=E-12345&fecha=23-04-2025&importe=123.45');
  });

  it('numserie con caracteres especiales -> URL-encoded', () => {
    const u = qrUrl({ nif: '12345678Z', numserie: 'FAC 123/2024', fecha: '31-12-2024', importe: '9.99' });
    expect(u).toContain('numserie=FAC%20123%2F2024');
    expect(u).toContain('importe=9.99');
  });

  it('tamaño reglamentario 30–40 mm y nivel M', () => {
    expect(QR_SIZE_MM.min).toBe(30);
    expect(QR_SIZE_MM.max).toBe(40);
    expect(QR_ERROR_CORRECTION).toBe('M');
  });

  it('leyenda oficial VERI*FACTU', () => {
    expect(VERIFACTU_FRASE).toBe('Factura verificable en la sede electrónica de la AEAT');
    expect(VERIFACTU_LEYENDA).toBe('VERI*FACTU');
  });
});
