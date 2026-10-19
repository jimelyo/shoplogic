/**
 * VERI*FACTU Companion — asistente de certificado y diagnóstico (proceso main).
 *
 * Todo lo que toca el certificado .p12 o la contraseña vive AQUÍ y JAMÁS
 * llega al renderer: el IPC devuelve solo metadatos (titular, caducidad,
 * estado de la configuración), nunca la clave privada ni la contraseña.
 *
 * Flujo del asistente (Settings → VERI*FACTU → Companion):
 *   1. verifactu:companion-pick-p12    → diálogo nativo + copia del .p12 a
 *                                        userData/verifactu/cert.p12 (copy
 *                                        local: la app no depende de que el
 *                                        usuario no mueva el fichero original).
 *   2. verifactu:companion-validate    → descifra el .p12 con la contraseña
 *                                        recibida POR IPC (canal seguro), y
 *                                        devuelve solo su informacion pública.
 *   3. verifactu:companion-install     → escribe userData/verifactu/signer.json
 *                                        con { p12Path, p12Password } en modo
 *                                        0600; lo usa verifactu-signer.cjs.
 *   4. verifactu:signer-detail         → estado del firmador instalado
 *                                        (titular, validez, días restantes).
 *   5. verifactu:test-connection       → GET al WSDL del entorno desde main
 *                                        (sin CORS del renderer) con latencia.
 */

const fs = require('fs');
const path = require('path');
const { dialog, safeStorage } = require('electron');
const forge = require('node-forge');
const signer = require('./verifactu-signer.cjs');

/** Rutas del anillo de datos del firmador. */
function companionDir(userDataDir) {
  return path.join(userDataDir, 'verifactu');
}
function certTargetPath(userDataDir) {
  return path.join(companionDir(userDataDir), 'cert.p12');
}
function signerConfigPath(userDataDir) {
  return path.join(companionDir(userDataDir), 'signer.json');
}

/**
 * Paso 1: seleccionar y copiar el .p12/.pfx a userData/verifactu/cert.p12.
 * Devuelve la ruta DESTINO (copia local); nunca el contenido del certificado.
 */
async function pickAndCopyP12(userDataDir, currentWindow) {
  const res = await dialog.showOpenDialog(currentWindow, {
    title: 'Selecciona el certificado .p12 / .pfx del obligado tributario',
    filters: [{ name: 'Certificado electrónico (.p12,.pfx)', extensions: ['p12', 'pfx'] }],
    properties: ['openFile'],
  });
  if (res.canceled || !res.filePaths.length) return { ok: false, canceled: true };
  const src = res.filePaths[0].endsWith('.p12') || res.filePaths[0].endsWith('.pfx')
    ? res.filePaths[0]
    : res.filePaths.find((p) => /\.p(12|fx)$/i.test(p)) ?? res.filePaths[0];
  const dest = certTargetPath(userDataDir);
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  fs.copyFileSync(src, dest);
  return { ok: true, path: dest, originalName: path.basename(src) };
}

/** Descifra el .p12 y devuelve solo atributos públicos (sin clave ni PEM). */
function describeP12(p12Path, p12Password) {
  if (!fs.existsSync(p12Path)) return { ok: false, error: 'No hay certificado .p12 copiado todavía. Usa "Seleccionar certificado".' };
  let p12;
  try {
    const der = fs.readFileSync(p12Path);
    const p12Asn1 = forge.asn1.fromDer(der.toString('binary'));
    p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, true, p12Password);
  } catch (err) {
    // Contraseña incorrecta o fichero corrupto: mensaje genérico, sin filtrar el error de crypto completo.
    return { ok: false, error: 'No se pudo abrir el certificado: la contraseña no es válida o el fichero está dañado.' };
  }
  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag })[forge.pki.oids.certBag] ?? [];
  const cert = certBags[0]?.cert;
  if (!cert) return { ok: false, error: 'El .p12 no contiene ningún certificado X.509.' };

  const toIso = (d) => (d instanceof Date ? d.toISOString() : String(d ?? ''));
  const field = (attrs, name) => attrs?.find((a) => a.name === name || a.shortName === name)?.value ?? '';

  // Detecta atributos de CIF/NIF titulares habituales (OID 2.5.4.97 y serialNumber de España).
  const serial = cert.subject.getField('serialNumber')?.value ?? '';
  const subjectFields = cert.subject.attributes ?? [];
  const organizationIdentifier = subjectFields.find((a) => a.type === '2.5.4.97')?.value ?? '';

  return {
    ok: true,
    subjectCN: field(cert.subject.attributes, 'commonName'),
    organization: field(cert.subject.attributes, 'organizationName'),
    serialNumber: serial,
    organizationIdentifier,
    issuerCN: field(cert.issuer.attributes, 'commonName'),
    notBefore: toIso(cert.validity.notBefore),
    notAfter: toIso(cert.validity.notAfter),
  };
}

/**
 * Paso 3: instala (o reescribe) userData/verifactu/signer.json con la
 * contraseña del .p12 CIFRADA con safeStorage (DPAPI en Windows / Keychain en
 * macOS): solo este proceso principal puede descifrarla. El fichero queda en
 * modo 0600 y NUNCA se devuelve su contenido. Si la encriptación del SO no
 * está disponible, escribe en claro (comportamiento anterior) con un aviso.
 */
function installSignerConfig(userDataDir, p12Password) {
  const certPath = certTargetPath(userDataDir);
  if (!fs.existsSync(certPath)) return { ok: false, error: 'Selecciona primero el certificado .p12.' };
  if (typeof p12Password !== 'string') return { ok: false, error: 'Contraseña no recibida.' };
  // Validación previa: si la contraseña no abre el certificado, no escribimos nada.
  const info = describeP12(certPath, p12Password);
  if (!info.ok) return info;
  const dir = companionDir(userDataDir);
  fs.mkdirSync(dir, { recursive: true });
  const cfgPath = signerConfigPath(userDataDir);

  const record = { p12Path: certPath, encScheme: undefined, p12Encrypted: undefined };
  let plaintextFallback = false;
  try {
    if (safeStorage.isEncryptionAvailable()) {
      record.encScheme = 'safeStorage';
      record.p12Encrypted = safeStorage.encryptString(p12Password).toString('base64');
    } else {
      plaintextFallback = true;
    }
  } catch { plaintextFallback = true; }
  if (plaintextFallback) record.p12Password = p12Password; // retro-compatibilidad

  fs.writeFileSync(cfgPath, JSON.stringify(record, null, 2), { encoding: 'utf8', mode: 0o600 });
  try { fs.chmodSync(cfgPath, 0o600); } catch { /* no-POSIX (Windows): perms informativas */ }
  return {
    ok: true,
    configPath: cfgPath,
    subjectCN: info.subjectCN,
    notAfter: info.notAfter,
    encrypted: record.encScheme === 'safeStorage',
  };
}

/**
 * Paso 4: estado detallado del firmador ya instalado (config de signer.json).
 * Días restantes = margin hasta notAfter, para avisos de caducidad en la UI.
 */
function signerDetail(userDataDir) {
  const cfg = signer.readSignerConfig(userDataDir);
  const cfgPath = signerConfigPath(userDataDir);
  if (!cfg) {
    return {
      configured: false,
      configPath: cfgPath,
      certPath: certTargetPath(userDataDir),
      certCopied: fs.existsSync(certTargetPath(userDataDir)),
      hint: 'Configura el certificado desde el asistente: se escribirá ' + cfgPath,
    };
  }
  // Indica si signer.json ya está cifrado con safeStorage (DPAPI/Keychain).
  let encrypted = false;
  try { encrypted = JSON.parse(fs.readFileSync(cfgPath, 'utf8')).encScheme === 'safeStorage'; } catch { /* informativo */ }
  const info = describeP12(cfg.p12Path, cfg.p12Password);
  const daysLeft = info.ok ? daysUntil(info.notAfter) : null;
  return {
    configured: true,
    configPath: cfgPath,
    p12Path: cfg.p12Path,          // ruta, no contenido
    p12PasswordSet: !!cfg.p12Password,
    encrypted,
    certCopied: fs.existsSync(cfg.p12Path),
    // info pública; sin clave, sin contraseña
    ...(info.ok ? { ...info, daysLeft } : { error: info.error }),
  };
}

function daysUntil(isoDate) {
  const then = new Date(isoDate).getTime();
  if (Number.isNaN(then)) return null;
  return Math.floor((then - Date.now()) / 86_400_000);
}

/**
 * Paso 5: prueba de conexión real desde el main (Node fetch global de
 * Electron: sin CORS). Consulta el WSDL del entorno — recurso estático, no
 * crea registros ni consume la cola. Nunca interpreta aquí «aceptado».
 */
async function testConnection(environment) {
  const WSDL = {
    test: 'https://prewww2.aeat.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl',
    production: 'https://www2.agenciatributaria.gob.es/static_files/common/internet/dep/aplicaciones/es/aeat/tikeV1.0/cont/ws/SistemaFacturacion.wsdl',
  };
  const url = WSDL[environment] ?? WSDL.test;
  const started = Date.now();
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const res = await fetch(url, { method: 'GET', signal: ctrl.signal });
    const body = await res.text();
    clearTimeout(timer);
    return {
      ok: res.ok,
      url,
      status: res.status,
      ms: Date.now() - started,
      // muestra solo si parece WSDL (sanity check), sin volcar el body entero
      looksLikeWsdl: /definitions/i.test(body.slice(0, 4096)),
    };
  } catch (err) {
    clearTimeout(timer);
    const aborted = err && err.name === 'AbortError';
    return {
      ok: false,
      url,
      error: aborted ? 'Sin respuesta en 15 s (timeout).' : (err && err.message) || String(err),
      ms: Date.now() - started,
    };
  }
}

module.exports = { pickAndCopyP12, describeP12, installSignerConfig, signerDetail, testConnection, certTargetPath, signerConfigPath };
