/**
 * Firmador XAdES-Enveloped de los registros VERI*FACTU (ETSI EN 319 132).
 *
 * Firma cada envelope SOAP con la clave privada de un certificado .p12/.pfx
 * local del operador, tal y como exige el art. 14 de la Orden HAC/1177/2024
 * («XAdES Enveloped»). La firma se aplica sobre el Body del SOAP con la
 * transformación enveloped-signature, digest SHA-256 y RSA-SHA256.
 *
 * Ejecución: SOLO en el proceso main de Electron (Node). El renderer invoca
 * por IPC `verifactu:sign`; la clave privada nunca sale del proceso main.
 *
 * Instalación del certificado (operador):
 *   userData/verifactu/signer.json  ->  { "p12Path": "ruta abs o relativa", "p12Password": "..." }
 *   (p. ej. %APPDATA%/shoplogic-pro/verifactu/signer.json en Windows)
 */

const fs = require('fs');
const path = require('path');
const { SignedXml } = require('xml-crypto');
const forge = require('node-forge');

const CANON = 'http://www.w3.org/TR/2001/REC-xml-c14n-20010315';
const DIGEST_SHA256 = 'http://www.w3.org/2001/04/xmlenc#sha256';
const SIG_RSA_SHA256 = 'http://www.w3.org/2001/04/xmldsig-more#rsa-sha256';
const ENVELOPED_TRANSFORM = 'http://www.w3.org/2000/09/xmldsig#enveloped-signature';

/** Descifra el .p12/.pfx (PKCS#12) y devuelve certificado y clave como PEM. */
function loadPkcs12(p12Path, p12Password) {
  const der = fs.readFileSync(p12Path);
  const p12Asn1 = forge.asn1.fromDer(der.toString('binary'));
  const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, true, p12Password);
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const keyBags = (p12.getBags({ bagType: forge.pki.oids.pkcs8ShroudedKeyBag })[forge.pki.oids.pkcs8ShroudedKeyBag] ?? [])
    .concat(p12.getBags({ bagType: forge.pki.oids.keyBag })[forge.pki.oids.keyBag] ?? []);
  const cert = certBags[0]?.cert;
  const key = keyBags[0]?.key;
  if (!cert || !key) throw new Error('El .p12 no contiene certificado + clave privada válidos');
  return {
    pemCert: forge.pki.certificateToPem(cert),
    pemKey: forge.pki.privateKeyToPem(key),
  };
}

/** Extrae el certificado DER en base64 para <ds:X509Certificate>. */
function certBase64(pemCert) {
  return pemCert.replace(/-----BEGIN CERTIFICATE-----/, '').replace(/-----END CERTIFICATE-----/, '').replace(/\s+/g, '');
}

/** Firma XAdES Enveloped del envelope SOAP. Determinista para la misma clave. */
function signEnvelopeXml({ xml, p12Path, p12Password }) {
  const { pemCert, pemKey } = loadPkcs12(p12Path, p12Password);

  const sig = new SignedXml({
    privateKey: pemKey,
    publicCert: pemCert,
    signatureAlgorithm: SIG_RSA_SHA256,
    canonicalizationAlgorithm: CANON,
    getKeyInfoContent: () =>
      `<ds:X509Data><ds:X509Certificate>${certBase64(pemCert)}</ds:X509Certificate></ds:X509Data>`,
  });

  sig.addReference({
    xpath: "//*[local-name()='Body']",
    transforms: [ENVELOPED_TRANSFORM],
    digestAlgorithm: DIGEST_SHA256,
    uri: '',
    inclusiveNamespacesPrefixList: [],
    isEmptyUri: true,
  });

  sig.computeSignature(xml, {
    prefix: 'ds',
    location: { reference: "//*[local-name()='Body']", action: 'after' },
    existingPrefixes: { ds: 'http://www.w3.org/2000/09/xmldsig#' },
  });
  return sig.getSignedXml();
}

/** Lee (y hace absoluta la ruta del) userData/verifactu/signer.json. */
function readSignerConfig(userDataDir) {
  const cfgPath = path.join(userDataDir, 'verifactu', 'signer.json');
  if (!fs.existsSync(cfgPath)) return null;
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'));
    if (cfg.p12Path && !path.isAbsolute(cfg.p12Path)) {
      cfg.p12Path = path.join(path.dirname(cfgPath), cfg.p12Path);
    }
    return fs.existsSync(cfg.p12Path || '') ? cfg : null;
  } catch (e) {
    console.error('verifactu/signer: config inválida', e);
    return null;
  }
}

module.exports = { signEnvelopeXml, readSignerConfig, loadPkcs12 };
