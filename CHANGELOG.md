# Changelog

## 1.3.0 — VERI*FACTU (2026-10-13)

Módulo fiscal **VERI*FACTU** conforme al RD 1007/2023 y la Orden HAC/1177/2024,
implementado a partir de los documentos técnicos oficiales de la AEAT
(huella v0.1.2 con vectores de prueba oficiales; servicios web v1.0.3; QR y
especificaciones del servicio de cotejo vigentes).

### Fiscalidad VERI*FACTU
- **Huella oficial SHA-256** (`src/verifactu/fiscal-hash.ts`): cadena
  `campo=valor&…` en el orden del documento AEAT, UTF-8, hex MAYÚSCULAS de
  64 caracteres. Reproduce los **3 vectores de prueba oficiales** (alta 1.ª,
  alta encadenada, anulación encadenada).
- **Encadenamiento** (`fiscal-chain.ts`): `chainAlta`/`chainAnulacion` con
  primer registro y sensibilidad integral.
- **XML** (`aeat-xml.ts`): `RegistroAlta` y `RegistroAnulacion` según los
  esquemas `SuministroLR.xsd`/`SuministroInformacion.xsd`, lote ≤ 1000,
  escape XML correcto. Validado contra el ejemplo del doc. v1.0.3 §9.1.1.1.
- **SOAP** (`aeat-soap.ts`): SOAP 1.1 Document hacia los endpoints WSDL
  oficiales (`prewww1/…` pruebas, `www1/…` producción; sello `www10/prewww10`
  configurable). Parser de `RespuestaSuministro`: `Correcto` /
  `AceptadoConErrores` / `Incorrecto` y resultado por registro.
- **Cola persistente** (`queue.ts`): estados internos
  `PERSISTED→QUEUED→SENDING→ACCEPTED|ACCEPTED_WITH_ERRORS|REJECTED|RETRY_PENDING`,
  backoff 15 s/1 min/10 min/1 h, recuperación de envíos colgados tras reinicio,
  tabla Dexie **v10** (`verifactuQueue`) sin tocar datos existentes.
- **QR reglamentario** (`fiscal-qr.ts` + `pdf.ts`): URL oficial de cotejo
  (`ValidarQR` / `ValidarQRNoVerifactu`, test y producción), 35 mm, nivel M,
  y la frase oficial en el PDF de factura.
- **Pantalla de incidencias** (`VerifactuIncidents.tsx`): listado de registros
  rechazados/aceptados con errores, detalle del error AEAT (código +
  descripción), reintento individual y masivo, reencolado, descarte con
  trazabilidad y copia de la respuesta XML. Los registros ya remitidos nunca
  se editan desde la UI.
- **Panel de estado** (`FiscalStatus.tsx`): estado de la cola, auto-auditoría
  de la cadena y selector de modalidad/entorno (test/producción).
- **Emisión de registros desde el ERP** (`service.ts` + `lib/invoices.ts`):
  alta al crear factura (venta o reparación) y anulación al cancelar
  (`cancelInvoiceWithVerifactu`). Facturas históricas NO se re-registran.

### Cumplimiento sobre la remisión real (honest report)
- La remisión real exige **certificado electrónico cualificado** del obligado.
  Implementado el **firmador XAdES-Enveloped** (`electron/verifactu-signer.cjs`,
  ETSI EN 319 132, xml-crypto + node-forge, RSA-SHA256, digest SHA-256)

  que carga un `.p12/.pfx` local desde
  `userData/verifactu/signer.json`; se firma vía Electron IPC justo antes del
  envío y la clave privada nunca sale del proceso main. Probado con un .p12
  autofirmado generado en el test (4 tests).

- Sin firmador configurado, la cola avisa y queda en `RETRY_PENDING` (nunca
  simula una aceptación). Prueba de integración contra la preproducción AEAT
  pendiente de certificar por el operador.

### Empaquetado v1.3.0 (local, sin publicar)
- `npm run dist` con `--publish never`: NSIS x64, arm64 y combinado en
  `release/ShopLogic-Setup-1.3.0*.exe`.

### Otros
- Reemplazo del stub anterior `src/lib/verifactu.ts` (fórmula no reglamentaria)
  por el módulo completo `src/verifactu/`.
- 27 claves i18n nuevas (`vf.*`) en es/en/pt/zh/ar (920 claves idénticas).
- Dependencias nuevas: `qrcode` (QR reglamentario), `xml-crypto` + `node-forge`
  (firma XAdES en el proceso main de Electron).
- 108 pruebas unitarias en verde (`npm test`), `tsc -b` sin errores.
