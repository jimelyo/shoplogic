/**
 * AeatSoapClient — cliente del servicio web de remisión voluntaria de
 * registros de facturación de la AEAT (servicios web VERI*FACTU).
 *
 * Fuentes oficiales (documento AEAT v1.0.3, Anexo I):
 *  - WSDL de PRUEBAS:    https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl
 *  - WSDL de PRODUCCIÓN: https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl
 *  - XSD de entrada:     SuministroLR.xsd / SuministroInformacion.xsd
 *  - XSD de salida:      RespuestaSuministro.xsd
 *
 * Transporte: SOAP 1.1 en modo Document. La autenticación del obligado exige
 * certificado electrónico cualificado (mTLS o XAdES según la vía elegida por
 * la AEAT); la全校 demesa de firma se buscara fuera del módulo en producción.
 */

import type { AeatEnvironment } from './fiscal-types';

/** URL del WSDL oficial, por entorno (documento AEAT v1.0.3, Anexo I). */
export const WSDL: Record<AeatEnvironment, string> = {
  test: 'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl',
  production: 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl',
};

/**
 * Endpoints SOAP, por entorno. Los endpoints reales del WSDL se resuelven al
 * wire; permitimos sobrescribirlos (p. ej. en poblado o pruebas que exigen
 * endpoints de sello).
 */
export const SOAP_ENDPOINTS: Record<AeatEnvironment, string> = {
  test: 'https://prewww1.aeat.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
  production: 'https://www1.agenciatributaria.gob.es/wlpl/TIKE-CONT/ws/SistemaFacturacion/VerifactuSOAP',
};

/** Acción SOAP de la operación de alta y consulta. */
export const SOAP_ACTIONS = {
  alta: 'RegFactuSistemaFacturacion',
  consulta: 'ConsultaLRFacturasEmitidasSuscripcion',
} as const;

export interface AeatResponseResult {
  /** Nombre del registro afectado <sum1:NumSerieFactura>. */
  NumSerieFactura: string;
  /** `<sum1:IDEstadoRegistro>`: 0 = aceptado, 1 = aceptado con errores, 2 = rechazado. */
  IDEstadoRegistro: '0' | '1' | '2';
  /** Literal oficial del estado: Correcto | AceptadoConErrores | Incorrecto. */
  EstadoRegistro: string;
  /** Descripción del estado (sentencia oficial de validación). */
  DescripcionError?: string;
  /** Array de <sum1:RegistroErrores> para el registro correspondiente. */
  Errores?: { CodigoError: string; DescripcionError: string }[];
  /** CSV si la remisión fue aceptada y la AEAT lo devolvió. */
  CSV?: string;
}

export interface AeatSubmissionResponse {
  /** Conveniencia global de la respuesta: Correcto | AceptadoConErrores | Incorrecto. */
  EstadoEnvio: 'Correcto' | 'AceptadoConErrores' | 'Incorrecto';
  /** CSV global de la remisión. */
  CSV?: string;
  /** Fecha/hora de la respuesta si la informa la AEAT. */
  TiempoEsperaEnvio?: string;
  /** Resultado por registro, en el orden de remisión. */
  registros: AeatResponseResult[];
  /** XML crudo recibido, para trazabilidad. */
  rawUrl?: string;
  raw?: string;
}

/** Parseo del cuerpo SOAP de una respuesta de remisión (RespuestaSuministro.xsd). */
export function parseSuministroResponse(xml: string): AeatSubmissionResponse {
  const text = (tag: string, scope = xml): string | undefined => {
    const m = scope.match(new RegExp(`<[^>]*:?${tag}(?:\\s[^>]*)?>([^<]*)<`, 'i'));
    return m?.[1] ? m[1].trim() : undefined;
  };
  const xsd = text('EstadoEnvio');
  const csv = text('CSV');
  const tiempoEspera = text('TiempoEsperaEnvio');
  const registros: AeatResponseResult[] = [];
  const blocks = xml.split(/<[^>]*:?RespuestaLinea>/i).slice(1);
  for (const block of blocks) {
    const body = block.split(/<\/[^>]*:?RespuestaLinea>/i)[0] ?? block;
    const estado = text('EstadoRegistro', body) ?? '';
    const errores: { CodigoError: string; DescripcionError: string }[] = [];
    const errBlocks = body.split(/<[^>]*:?RegistroErrores>/i).slice(1);
    for (const eb of errBlocks) {
      const eBody = eb.split(/<\/[^>]*:?RegistroErrores>/i)[0] ?? eb;
      const code = text('CodigoErrorRegistro', eBody) ?? '';
      const desc = text('DescripcionErrorRegistro', eBody) ?? '';
      if (code || desc) errores.push({ CodigoError: code, DescripcionError: desc });
    }
    registros.push({
      NumSerieFactura: text('NumSerieFactura', body) ?? '',
      IDEstadoRegistro: (text('IDEstadoRegistro', body) as '0' | '1' | '2') ?? '2',
      EstadoRegistro: estado,
      DescripcionError: text('DescripcionEstadoRegistro', body),
      Errores: errores.length ? errores : undefined,
      CSV: text('CSV', body),
    });
  }
  return {
    EstadoEnvio: (xsd as AeatSubmissionResponse['EstadoEnvio']) ?? 'Incorrecto',
    CSV: csv,
    TiempoEsperaEnvio: tiempoEspera,
    registros,
    raw: xml,
  };
}

export interface SendOptions {
  environment: AeatEnvironment;
  xml: string;
  timeoutMs?: number;
  /** Cabeceras extra, por ejemplo las que instala el cliente de certificado. */
  headers?: Record<string, string>;
  fetchImpl?: typeof fetch;
}

/**
 * Envía el mensaje SOAP. No interpreta un HTTP 200 como «aceptado»: solo un
 * `EstadoEnvio = Correcto` con resultado individual por registro lo es.
 * Un SOAPFault o un error de transporte lanza/propaga el error para que la
 * cola lo registre y lo reintente.
 */
export async function sendSoap(opts: SendOptions): Promise<AeatSubmissionResponse> {
  const doFetch = opts.fetchImpl ?? fetch;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 30_000);
  try {
    const res = await doFetch(SOAP_ENDPOINTS[opts.environment], {
      method: 'POST',
      headers: {
        'Content-Type': 'text/xml; charset=utf-8',
        'SOAPAction': '""',
        ...(opts.headers ?? {}),
      },
      body: opts.xml,
      signal: ctrl.signal,
    });
    const raw = await res.text();
    if (!res.ok) {
      throw new Error(`AEAT SOAP HTTP ${res.status}: ${raw.slice(0, 500)}`);
    }
    return parseSuministroResponse(raw);
  } finally {
    clearTimeout(timer);
  }
}

/** Detecta si el cuerpo contiene un SoapFault (rechazo a nivel de protocolo). */
export function isSoapFault(xml: string): boolean {
  return /<[^>]*:?Fault[\s>]/i.test(xml);
}

/** Extrae el texto de faultstring si existe (para el log de la cola). */
export function soapFaultMessage(xml: string): string | undefined {
  const m = xml.match(/<[^>]*:?faultstring[^>]*>([^<]*)</i);
  return m?.[1]?.trim();
}
