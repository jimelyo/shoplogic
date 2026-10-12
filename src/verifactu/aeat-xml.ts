/**
 * AeatXmlBuilder — genera los mensajes XML de remisión voluntaria conforme a
 * los diseños de registro y XSD oficiales de la AEAT:
 *  - SuministroLR.xsd (operaciones Alta y Anulación)
 *  - SuministroInformacion.xsd (tipos comunes)
 *
 * Documento fuente: «Especificaciones de los servicios de remisión voluntaria
 * de registros de facturación y sus validaciones», versión 1.0.3 AEAT, ejemplo
 * de mensaje SOAP 1.1 (modo Document):
 *   xmlns:sum  = .../tike/cont/ws/SuministroLR.xsd
 *   xmlns:sum1 = .../tike/cont/ws/SuministroInformacion.xsd
 * Elemento raíz del Body: sum:RegFactuSistemaFacturacion.
 *
 * Cada remisión se firma electrónicamente (XAdES Enveloped, Orden art. 14) con
 * un certificado del obligado; ese paso de firma NO se aplica aquí: la remisión
 * requiere un AES previo ante la AEAT. El XML se deja listo para firmar y para
 * ser validado por el fichero XSD oficial antes del envío.
 */

import type { DesgloseDetalle, RegistroAlta, RegistroAnulacion, SistemaInformaticoSpec } from './fiscal-types';
import { TIPO_HUELLA_SHA256 } from './fiscal-types';
import type { ChainResult } from './fiscal-chain';

/** Escapa texto para su inclusión en un nodo XML (text content). */
export function xmlEsc(v: string | number | undefined | null): string {
  if (v === undefined || v === null) return '';
  return String(v)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/** Cabecera SOAP de las remisiones. */
export function soapEnvelopeOpen(): string {
  return `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
  xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd"
  xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd"
  xmlns:xd="http://www.w3.org/2000/09/xmldsig#">
<soapenv:Header/>
<soapenv:Body>`;
}

export function soapEnvelopeClose(): string {
  return `</soapenv:Body>
</soapenv:Envelope>`;
}

export interface XmlAltaOptions {
  /** Nombre y NIF del obligado a emitir tal y como se declaran en la Cabecera. */
  obligado: { NombreRazon: string; NIF: string };
  alta: RegistroAlta;
  /** Resultado del encadenamiento con la huella del nuevo registro. */
  chain: ChainResult;
  /** Identificación del Sistema Informático de Facturación. */
  sistema: SistemaInformaticoSpec;
}

/** Bloque Desglose. */
function desgloseXml(d: DesgloseDetalle[]): string {
  return d.map((x) => {
    const line = [
      '       <sum1:DetalleDesglose>',
      x.ClaveRegimen !== undefined ? `          <sum1:ClaveRegimen>${xmlEsc(x.ClaveRegimen)}</sum1:ClaveRegimen>` : '',
      x.CalificacionOperacion ? `          <sum1:CalificacionOperacion>${xmlEsc(x.CalificacionOperacion)}</sum1:CalificacionOperacion>` : '',
      x.TipoImpositivo !== undefined ? `          <sum1:TipoImpositivo>${xmlEsc(x.TipoImpositivo)}</sum1:TipoImpositivo>` : '',
      x.BaseImponibleOimporteNoSujeto !== undefined
        ? `          <sum1:BaseImponibleOimporteNoSujeto>${xmlEsc(x.BaseImponibleOimporteNoSujeto)}</sum1:BaseImponibleOimporteNoSujeto>`
        : '',
      x.CuotaRepercutida !== undefined ? `          <sum1:CuotaRepercutida>${xmlEsc(x.CuotaRepercutida)}</sum1:CuotaRepercutida>` : '',
      x.TipoRecargoEquivalencia !== undefined ? `          <sum1:TipoRecargoEquivalencia>${xmlEsc(x.TipoRecargoEquivalencia)}</sum1:TipoRecargoEquivalencia>` : '',
      x.CuotaRecargoEquivalencia !== undefined ? `          <sum1:CuotaRecargoEquivalencia>${xmlEsc(x.CuotaRecargoEquivalencia)}</sum1:CuotaRecargoEquivalencia>` : '',
      '       </sum1:DetalleDesglose>',
    ].filter(Boolean).join('\n');
    return line;
  }).join('\n');
}

/** SistemaInformatico del RegistroAlta / RegistroAnulacion. */
function sistemaInformaticoXml(sys: SistemaInformaticoSpec): string {
  return `         <sum1:SistemaInformatico>
          <sum1:NombreRazon>${xmlEsc(sys.NombreRazonSocial)}</sum1:NombreRazon>
          <sum1:NIF>${xmlEsc(sys.NIF)}</sum1:NIF>
          <sum1:NombreSistemaInformatico>${xmlEsc(sys.NombreSistemaInformatico)}</sum1:NombreSistemaInformatico>
          <sum1:IdSistemaInformatico>${xmlEsc(sys.IdSistemaInformatico)}</sum1:IdSistemaInformatico>
          <sum1:Version>${xmlEsc(sys.Version)}</sum1:Version>
          <sum1:NumeroInstalacion>${xmlEsc(sys.NumeroInstalacion)}</sum1:NumeroInstalacion>
          <sum1:TipoUsoPosibleSoloVerifactu>${xmlEsc(sys.TipoUsoPosibleSoloVerifactu)}</sum1:TipoUsoPosibleSoloVerifactu>
          <sum1:TipoUsoPosibleMultiOT>${xmlEsc(sys.TipoUsoPosibleMultiOT)}</sum1:TipoUsoPosibleMultiOT>
          <sum1:IndicadorMultiplesOT>${xmlEsc(sys.IndicadorMultiplesOT)}</sum1:IndicadorMultiplesOT>
        </sum1:SistemaInformatico>`;
}

/** Bloque Encadenamiento: Solo `RegistroAnterior` o `PrimerRegistro=S`. */
function encadenamientoXml(chain: ChainResult): string {
  if (chain.primerRegistro || !chain.huellaAnterior) {
    return `         <sum1:Encadenamiento>
          <sum1:PrimerRegistro>S</sum1:PrimerRegistro>
        </sum1:Encadenamiento>`;
  }
  return `         <sum1:Encadenamiento>
          <sum1:RegistroAnterior>
            <sum1:Huella>${xmlEsc(chain.huellaAnterior)}</sum1:Huella>
          </sum1:RegistroAnterior>
        </sum1:Encadenamiento>`;
}

/**
 * Genera el bloque <sum1:RegistroAlta>. Se devuelve sin firma; el cliente SOAP
 * puede insertar posteriormente la firma XAdES que corresponde.
 */
export function buildAltaXml(opts: XmlAltaOptions): string {
  const a = opts.alta;
  const enc = encadenamientoXml(opts.chain);
  const sys = sistemaInformaticoXml(opts.sistema);
  const rect = a.TipoRectificativa
    ? `         <sum1:TipoRectificativa>${xmlEsc(a.TipoRectificativa)}</sum1:TipoRectificativa>\n`
    : '';
  const rectificadas = a.FacturasRectificadas?.length
    ? a.FacturasRectificadas.map((r) =>
        `         <sum1:FacturasRectificadas>
          <sum1:NumSerieFactura>${xmlEsc(r.NumSerieFactura)}</sum1:NumSerieFactura>
          <sum1:FechaExpedicionFactura>${xmlEsc(r.FechaExpedicionFactura)}</sum1:FechaExpedicionFactura>
        </sum1:FacturasRectificadas>`).join('\n') + '\n'
    : '';
  return `       <sum1:RegistroAlta>
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura>
      <sum1:IDEmisorFactura>${xmlEsc(a.IDEmisorFactura)}</sum1:IDEmisorFactura>
      <sum1:NumSerieFactura>${xmlEsc(a.NumSerieFactura)}</sum1:NumSerieFactura>
      <sum1:FechaExpedicionFactura>${xmlEsc(a.FechaExpedicionFactura)}</sum1:FechaExpedicionFactura>
    </sum1:IDFactura>
    <sum1:NombreRazonSocialEmisor>${xmlEsc(a.NombreRazonSocialEmisor)}</sum1:NombreRazonSocialEmisor>
${a.NombreRazonSocialDestinatario || a.NIFDestinatario
  ? `    <sum1:Destinatarios>
      <sum1:IDDestinatario>
${a.NombreRazonSocialDestinatario ? `        <sum1:NombreRazon>${xmlEsc(a.NombreRazonSocialDestinatario)}</sum1:NombreRazon>\n` : ''}${a.NIFDestinatario ? `        <sum1:NIF>${xmlEsc(a.NIFDestinatario)}</sum1:NIF>` : ''}
      </sum1:IDDestinatario>
    </sum1:Destinatarios>`
  : ''}
${rect}${rectificadas}    <sum1:TipoFactura>${xmlEsc(a.TipoFactura)}</sum1:TipoFactura>
    <sum1:DescripcionOperacion>${xmlEsc(a.DescripcionOperacion)}</sum1:DescripcionOperacion>
    <sum1:Desglose>
${desgloseXml(a.Desglose)}
    </sum1:Desglose>
    <sum1:CuotaTotal>${xmlEsc(a.CuotaTotal)}</sum1:CuotaTotal>
    <sum1:ImporteTotal>${xmlEsc(a.ImporteTotal)}</sum1:ImporteTotal>
${enc}
${sys}
    <sum1:FechaHoraHusoGenRegistro>${xmlEsc(a.FechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>${TIPO_HUELLA_SHA256}</sum1:TipoHuella>
    <sum1:Huella>${xmlEsc(opts.chain.huella)}</sum1:Huella>
  </sum1:RegistroAlta>`;
}

/** Mensaje SOAP completo de una remisión de ALTA. */
export function altaSoap(opts: XmlAltaOptions): string {
  return `${soapEnvelopeOpen()}
  <sum:RegFactuSistemaFacturacion>
    <sum:Cabecera>
      <sum1:ObligadoEmision>
        <sum1:NombreRazon>${xmlEsc(opts.obligado.NombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEsc(opts.obligado.NIF)}</sum1:NIF>
      </sum1:ObligadoEmision>
    </sum:Cabecera>
    <sum:RegistroFactura>
${buildAltaXml(opts)}
    </sum:RegistroFactura>
  </sum:RegFactuSistemaFacturacion>
${soapEnvelopeClose()}`;
}

export interface XmlAnulacionOptions {
  obligado: { NombreRazon: string; NIF: string };
  anulacion: RegistroAnulacion;
  chain: ChainResult;
  sistema: SistemaInformaticoSpec;
}

export function buildAnulacionXml(opts: XmlAnulacionOptions): string {
  const a = opts.anulacion;
  const enc = encadenamientoXml(opts.chain);
  return `       <sum1:RegistroAnulacion>
    <sum1:IDVersion>1.0</sum1:IDVersion>
    <sum1:IDFactura>
      <sum1:IDEmisorFacturaAnulada>${xmlEsc(a.IDEmisorFacturaAnulada)}</sum1:IDEmisorFacturaAnulada>
      <sum1:NumSerieFacturaAnulada>${xmlEsc(a.NumSerieFacturaAnulada)}</sum1:NumSerieFacturaAnulada>
      <sum1:FechaExpedicionFacturaAnulada>${xmlEsc(a.FechaExpedicionFacturaAnulada)}</sum1:FechaExpedicionFacturaAnulada>
    </sum1:IDFactura>
    <sum1:RechazoPrevio>N</sum1:RechazoPrevio>
    <sum1:SinRegistroPrevio>N</sum1:SinRegistroPrevio>
${enc}
${sistemaInformaticoXml(opts.sistema)}
    <sum1:FechaHoraHusoGenRegistro>${xmlEsc(a.FechaHoraHusoGenRegistro)}</sum1:FechaHoraHusoGenRegistro>
    <sum1:TipoHuella>${TIPO_HUELLA_SHA256}</sum1:TipoHuella>
    <sum1:Huella>${xmlEsc(opts.chain.huella)}</sum1:Huella>
  </sum1:RegistroAnulacion>`;
}

/** Mensaje SOAP completo de una remisión de ANULACIÓN. */
export function anulacionSoap(opts: XmlAnulacionOptions): string {
  return `${soapEnvelopeOpen()}
  <sum:RegFactuSistemaFacturacion>
    <sum:Cabecera>
      <sum1:ObligadoEmision>
        <sum1:NombreRazon>${xmlEsc(opts.obligado.NombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEsc(opts.obligado.NIF)}</sum1:NIF>
      </sum1:ObligadoEmision>
    </sum:Cabecera>
    <sum:RegistroFactura>
${buildAnulacionXml(opts)}
    </sum:RegistroFactura>
  </sum:RegFactuSistemaFacturacion>
${soapEnvelopeClose()}`;
}

/** Empaqueta varios registros en una única remisión SOAP (hasta 1000 por lote). */
export function registrosSoap(
  registrosXml: string[],
  obligado: { NombreRazon: string; NIF: string },
): string {
  if (registrosXml.length > 1000) {
    throw new Error('La AEAT admite como máximo 1000 registros por remisión (fichero de entrada)');
  }
  return `${soapEnvelopeOpen()}
  <sum:RegFactuSistemaFacturacion>
    <sum:Cabecera>
      <sum1:ObligadoEmision>
        <sum1:NombreRazon>${xmlEsc(obligado.NombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEsc(obligado.NIF)}</sum1:NIF>
      </sum1:ObligadoEmision>
    </sum:Cabecera>
    <sum:RegistroFactura>
${registrosXml.join('\n')}
    </sum:RegistroFactura>
  </sum:RegFactuSistemaFacturacion>
${soapEnvelopeClose()}`;
}

/** Consulta de registros cuya remisión SIN FIRMAR ya se tiene constancia. */
export function consultaSoap(opts: {
  obligado: { NombreRazon: string; NIF: string };
  filtros?: { NumSerieFactura?: string; IDEmisorFacturaConsulta?: string },
  paginacion?: { NumSerieFactura?: string; FechaExpedicionFactura?: string },
  sistema?: SistemaInformaticoSpec,
}): string {
  const f = opts.filtros ?? {};
  return `${soapEnvelopeOpen()}
  <sum:ConsultaLRFacturasEmitidas>
    <sum:CabeceraContraste>
      <sum1:ObligadoEmision>
        <sum1:NombreRazon>${xmlEsc(opts.obligado.NombreRazon)}</sum1:NombreRazon>
        <sum1:NIF>${xmlEsc(opts.obligado.NIF)}</sum1:NIF>
      </sum1:ObligadoEmision>
    </sum:CabeceraContraste>
    <sum:FiltroConsulta>
${f.NumSerieFactura ? `       <sum1:NumSerieFactura>${xmlEsc(f.NumSerieFactura)}</sum1:NumSerieFactura>` : ''}
${f.IDEmisorFacturaConsulta ? `       <sum1:IDEmisorFacturaConsulta>${xmlEsc(f.IDEmisorFacturaConsulta)}</sum1:IDEmisorFacturaConsulta>` : ''}
    </sum:FiltroConsulta>
  </sum:ConsultaLRFacturasEmitidas>
${soapEnvelopeClose()}`;
}
