import { describe, it, expect } from 'vitest';
import { altaSoap, anulacionSoap, xmlEsc, registrosSoap } from '../aeat-xml';
import type { RegistroAlta, SistemaInformaticoSpec } from '../fiscal-types';

const SYS: SistemaInformaticoSpec = {
  NombreRazonSocial: 'SSSS',
  NIF: 'NNNN',
  NombreSistemaInformatico: 'NombreSistemaInformatico',
  IdSistemaInformatico: '77',
  Version: '1.0.03',
  NumeroInstalacion: '383',
  TipoUsoPosibleSoloVerifactu: 'N',
  TipoUsoPosibleMultiOT: 'S',
  IndicadorMultiplesOT: 'S',
};

const ALTA: RegistroAlta = {
  NumSerieFactura: '12345',
  FechaExpedicionFactura: '13-09-2024',
  FechaHoraHusoGenRegistro: '2024-09-13T19:20:30+01:00',
  TipoFactura: 'F1',
  IDEmisorFactura: 'AAAA',
  NombreRazonSocialEmisor: 'XXXXX',
  NombreRazonSocialDestinatario: 'YYYY',
  NIFDestinatario: 'BBBB',
  DescripcionOperacion: 'Descripc',
  Desglose: [
    { ClaveRegimen: '01', CalificacionOperacion: 'S1', TipoImpositivo: 4, BaseImponibleOimporteNoSujeto: 10, CuotaRepercutida: 0.4 },
    { ClaveRegimen: '01', CalificacionOperacion: 'S1', TipoImpositivo: 21, BaseImponibleOimporteNoSujeto: 100, CuotaRepercutida: 21 },
  ],
  CuotaTotal: '21.4',
  ImporteTotal: '131.4',
  HuellaAnterior: 'HUELLA_PREVIA',
  PrimerRegistro: false,
};

describe('AeatXmlBuilder — alta (vs. ejemplo doc AEAT 1.0.3, §9.1.1.1)', () => {
  const xml = altaSoap({
    obligado: { NombreRazon: 'XXXXX', NIF: 'AAAA' },
    alta: ALTA,
    chain: { huella: 'HUELLA_NUEVA', huellaAnterior: 'HUELLA_PREVIA', primerRegistro: false },
    sistema: SYS,
  });

  it('contenido conforme al ejemplo oficial', () => {
    expect(xml).toContain('<sum:RegFactuSistemaFacturacion>');
    expect(xml).toContain('<sum1:NombreRazon>XXXXX</sum1:NombreRazon>');
    expect(xml).toContain('<sum1:IDEmisorFactura>AAAA</sum1:IDEmisorFactura>');
    expect(xml).toContain('<sum1:NumSerieFactura>12345</sum1:NumSerieFactura>');
    expect(xml).toContain('<sum1:FechaExpedicionFactura>13-09-2024</sum1:FechaExpedicionFactura>');
    expect(xml).toContain('<sum1:TipoFactura>F1</sum1:TipoFactura>');
    expect(xml).toContain('<sum1:CuotaTotal>21.4</sum1:CuotaTotal>');
    expect(xml).toContain('<sum1:ImporteTotal>131.4</sum1:ImporteTotal>');
    expect(xml).toContain('<sum1:TipoHuella>01</sum1:TipoHuella>');
    expect(xml).toContain('<sum1:Huella>HUELLA_NUEVA</sum1:Huella>');
    expect(xml).toContain('<sum1:FechaHoraHusoGenRegistro>2024-09-13T19:20:30+01:00</sum1:FechaHoraHusoGenRegistro>');
  });

  it('encadenamiento con registro anterior', () => {
    expect(xml).toContain('<sum1:RegistroAnterior>');
    expect(xml).toContain('<sum1:Huella>HUELLA_PREVIA</sum1:Huella>');
    expect(xml).not.toContain('<sum1:PrimerRegistro>S</sum1:PrimerRegistro>');
  });

  it('primer registro: sin RegistroAnterior, marca PrimerRegistro=S', () => {
    const first = altaSoap({
      obligado: { NombreRazon: 'X', NIF: 'AAAA' },
      alta: { ...ALTA, HuellaAnterior: undefined, PrimerRegistro: true },
      chain: { huella: 'H', huellaAnterior: '', primerRegistro: true },
      sistema: SYS,
    });
    expect(first).toContain('<sum1:PrimerRegistro>S</sum1:PrimerRegistro>');
    expect(first).not.toContain('<sum1:RegistroAnterior>');
  });

  it('bloque SistemaInformatico completo', () => {
    expect(xml).toContain('<sum1:IdSistemaInformatico>77</sum1:IdSistemaInformatico>');
    expect(xml).toContain('<sum1:TipoUsoPosibleSoloVerifactu>N</sum1:TipoUsoPosibleSoloVerifactu>');
    expect(xml).toContain('<sum1:IndicadorMultiplesOT>S</sum1:IndicadorMultiplesOT>');
  });

  it('desglose con dos tipos impositivos', () => {
    expect(xml).toContain('<sum1:TipoImpositivo>4</sum1:TipoImpositivo>');
    expect(xml).toContain('<sum1:BaseImponibleOimporteNoSujeto>10</sum1:BaseImponibleOimporteNoSujeto>');
    expect(xml).toContain('<sum1:CuotaRepercutida>21</sum1:CuotaRepercutida>');
  });
});

describe('AeatXmlBuilder — anulación (vs. ejemplo doc AEAT 1.0.3, §9.2.1)', () => {
  it('RegistroAnulacion con campos principales', () => {
    const xml = anulacionSoap({
      obligado: { NombreRazon: 'XXXXX', NIF: 'AAAA' },
      anulacion: {
        NumSerieFactura: '12345', FechaExpedicionFactura: '13-09-2024',
        FechaHoraHusoGenRegistro: '2024-09-13T19:20:30+01:00',
        IDEmisorFacturaAnulada: 'AAAA', NumSerieFacturaAnulada: '12345',
        FechaExpedicionFacturaAnulada: '13-09-2024', HuellaAnterior: 'PREV', PrimerRegistro: false,
      },
      chain: { huella: 'NUEVA', huellaAnterior: 'PREV', primerRegistro: false },
      sistema: SYS,
    });
    expect(xml).toContain('<sum1:RegistroAnulacion>');
    expect(xml).toContain('<sum1:IDEmisorFacturaAnulada>AAAA</sum1:IDEmisorFacturaAnulada>');
    expect(xml).toContain('<sum1:NumSerieFacturaAnulada>12345</sum1:NumSerieFacturaAnulada>');
    expect(xml).toContain('<sum1:FechaExpedicionFacturaAnulada>13-09-2024</sum1:FechaExpedicionFacturaAnulada>');
    expect(xml).toContain('<sum1:Huella>NUEVA</sum1:Huella>');
    expect(xml).toContain('<sum1:RechazoPrevio>N</sum1:RechazoPrevio>');
    expect(xml).toContain('<sum1:SinRegistroPrevio>N</sum1:SinRegistroPrevio>');
  });
});

describe('XML escaping & lote', () => {
  it('escapa los caracteres XML', () => {
    expect(xmlEsc('S.L. <AL&>')).toBe('S.L. &lt;AL&amp;&gt;');
  });

  it('permite hasta 1000 registros por lote y rechaza más', () => {
    const many = Array.from({ length: 1000 }, () => '<x/>');
    expect(() => registrosSoap(many, { NombreRazon: 'a', NIF: '1' })).not.toThrow();
    expect(() => registrosSoap([...many, '<x/>'], { NombreRazon: 'a', NIF: '1' })).toThrow(/1000/);
  });
});
