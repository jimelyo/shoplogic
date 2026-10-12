import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import forge from 'node-forge';
// El firmador es CJS de Electron: se importa con createRequire.
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const __filename = fileURLToPath(import.meta.url);
const here = dirname(__filename);
const require = createRequire(__filename);
const { signEnvelopeXml, loadPkcs12 } = require(join(here, '..', '..', '..', 'electron', 'verifactu-signer.cjs'));

let p12Path = '';
let p12Password = 'test-pass-1234';
const dir = join(tmpdir(), 'shoplogic-signer-test');

// SOAP de ejemplo (el ejemplo oficial del doc. AEAT v1.0.3 §9.1.1.1, abreviado).
const XML = `<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:sum="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroLR.xsd" xmlns:sum1="https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tike/cont/ws/SuministroInformacion.xsd">
<soapenv:Header/>
<soapenv:Body>
  <sum:RegFactuSistemaFacturacion>
    <sum:Cabecera>
      <sum1:ObligadoEmision><sum1:NombreRazon>XXXXX</sum1:NombreRazon><sum1:NIF>AAAA</sum1:NIF></sum1:ObligadoEmision>
    </sum:Cabecera>
    <sum:RegistroFactura>
      <sum1:RegistroAlta>
        <sum1:IDVersion>1.0</sum1:IDVersion>
        <sum1:IDFactura><sum1:IDEmisorFactura>AAAA</sum1:IDEmisorFactura><sum1:NumSerieFactura>12345</sum1:NumSerieFactura><sum1:FechaExpedicionFactura>13-09-2024</sum1:FechaExpedicionFactura></sum1:IDFactura>
        <sum1:Huella>3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F38F12F60</sum1:Huella>
      </sum1:RegistroAlta>
    </sum:RegistroFactura>
  </sum:RegFactuSistemaFacturacion>
</soapenv:Body>
</soapenv:Envelope>`;

beforeAll(() => {
  // Genera un par de claves + certificado autofirmado + .p12 con node-forge.
  mkdirSync(dir, { recursive: true });
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = '01';
  cert.validity.notBefore = new Date(Date.now() - 86400_000);
  cert.validity.notAfter = new Date(Date.now() + 365 * 86400_000);
  const attrs = [{ name: 'commonName', value: 'ShopLogic Test Signer' }];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());
  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, cert, p12Password);
  p12Path = join(dir, 'test-cert.p12');
  writeFileSync(p12Path, Buffer.from(forge.asn1.toDer(p12Asn1).getBytes(), 'binary'));
});

afterAll(() => {
  try { rmSync(dir, { recursive: true, force: true }); } catch { /* noop */ }
});

describe('verifactu-signer (Electron main, Node)', () => {
  it('carga el .p12 y expone certificado + clave privada', () => {
    const { pemCert, pemKey } = loadPkcs12(p12Path, p12Password);
    expect(pemCert).toContain('BEGIN CERTIFICATE');
    expect(pemKey).toContain('PRIVATE KEY');
  });

  it('falla con contraseña incorrecta', () => {
    expect(() => loadPkcs12(p12Path, 'wrong-pass')).toThrow();
  });

  it('firma el SOAP en XAdES Enveloped y devuelve XML válido', () => {
    const signed = signEnvelopeXml({ xml: XML, p12Path, p12Password });
    expect(signed).toContain('<ds:Signature');
    expect(signed).toContain('http://www.w3.org/2001/04/xmlenc#sha256');
    expect(signed).toContain('rsa-sha256');
    expect(signed).toContain('enveloped-signature');
    expect(signed).toContain('<ds:SignatureValue>');
    expect(signed).toContain('<ds:X509Certificate>');
    // La firma es enveloped: el XML original queda intacto dentro.
    expect(signed).toContain('<sum1:Huella>3C464DAF61ACB827C65FDA19F352A4E3BDC2C640E9E9FC4CC058073F3');
    expect(signed.startsWith('<soapenv:Envelope')).toBe(true);
  });

  it('idempotente: misma entrada → misma firma (determinista con misma clave)', () => {
    const a = signEnvelopeXml({ xml: XML, p12Path, p12Password });
    const b = signEnvelopeXml({ xml: XML, p12Path, p12Password });
    expect(a).toBe(b);
  });
});

