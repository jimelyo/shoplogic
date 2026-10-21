# Changelog

## 1.3.5 — Mano de obra en reparaciones + hardening y calidad (2026-10-22)

### Reparaciones: mano de obra
- **Opción de mano de obra** en cada reparación (nueva y en edición): **incluida en el precio** (informativa, con aviso) o **aparte (se suma al precio)** con su importe.
- Tarjetas, tabla y detalle muestran el desglose «🔩 mano de obra + X €» y el **total final** (precio + mano de obra, IVA incluido).
- **Factura automática al entregar**: la mano de obra aparte genera su **propia línea** en la factura junto a la reparación (correcta para Veri*factu).
- **Resguardo impreso / vista previa**: línea de mano de obra con su condición y total ya sumado.
- Validación Zod (obligatoria y > 0 cuando es aparte) y 3 tests unitarios de facturación desde reparación.

### Seguridad
- **CSP de producción** inyectada en el build (`script-src 'self' file:`, sin
  `unsafe-eval`) y **bloqueo de navegación** en Electron (`will-navigate`,
  `will-redirect`); las ventanas nuevas solo abren http(s)/mailto en el navegador.
- **Backups manuales y externos con credenciales enmascaradas** (WhatsApp/SMTP);
  la restauración conserva las credenciales locales.
- **Digest SHA-256** en cada backup, verificación al importar y **vista previa**
  con recuento de tablas antes de reemplazar datos.
- Guard de CI para `node-forge` (GHSA-86w9-cpqp-85rv): solo se permite el parseo
  PKCS#12, nunca APIs de verificación de firma. `xml-crypto` actualizado a 6.4.0.
- Scaffolding de **firma Authenticode y notarización macOS** (`afterSign`,
  entitlements, secretos documentados en `SECURITY.md`).

### Permisos
- **Permisos por acción** además de por módulo: descuentos, devoluciones, cambio
  de precio, borrado de facturas y exportación/importación de datos. Editables
  por usuario en Usuarios → Acciones; los roles antiguos heredan los defaults.

### Calidad
- **Numeración de facturas atómica** dentro de una transacción Dexie (sin
  duplicados con dos ventanas).
- **i18n lazy**: cada idioma se carga bajo demanda (~65 KB gzip menos en la
  primera carga).
- **CI en PR** (lint, tests, build, i18n, guard) y **6 tests E2E de Playwright**
  para login, venta, reparación, backup, fiscal y error de contraseña.

## 1.3.3 — Tickets de reparación: impresión y vista previa (2026-10-16)

### Nuevo
- **Opción de imprimir el ticket al crear una reparación**: tras registrar una nueva
  reparación se pregunta «¿Imprimir el ticket de entrada?» — pensado para cuando el
  cliente sigue en el mostrador.
- **Vista previa del ticket antes de imprimir** (modal con `iframe` aislado, sin
  scripts): muestra exactamente el documento que saldrá por la impresora (mismo HTML
  y CSS de ticket 58/80 mm). Se abre desde el diálogo de creación, desde el botón de
  impresora de cada fila y desde «Imprimir resguardo» del detalle.

### Correcciones
- **Cabecera del ticket con el nombre de la tienda**: la cabecera impresa usaba
  `ticketPrinter.header`, sembrada con el valor demo «ShopLogic Mobile Store» que no
  se actualizaba al cambiar los datos de la tienda. Ahora:
  - al imprimir, si la cabecera está vacía o sigue siendo el valor demo, se usa el
    nombre real de la tienda (fail-safe sin migración);
  - al guardar Ajustes, si cambió el nombre de tienda y la cabecera lo seguía
    (vacía, nombre anterior o valor demo), se sincroniza automáticamente;
  - la miniatura de vista previa en Ajustes → Impresoras usa el mismo criterio.
- i18n: claves nuevas `repairs.printTicketAsk`, `repairs.printTicket` y
  `repairs.previewTitle` en los 5 idiomas (924 claves idénticas).

## 1.3.2 — VERI*FACTU Companion + multi-arquitectura (2026-10-14)

### Nuevo
- **VERI*FACTU Companion** (Ajustes → 🧙): asistente guiado de instalación, configuración
  automática, diagnóstico y resolución de incidencias fiscales
  - 🪪 **Certificado `.p12`**: selección nativa, copia al almacén local (`cert.p12`),
    validación de contraseña y escritura segura de `verifactu/signer.json` (0600) — todo en el
    **proceso main** (`electron/verifactu-companion.cjs`); la contraseña nunca sale del main.
  - 🩺 **Diagnóstico**: conteo de la cola por los 7 estados, auditoría de cadena de huellas y
    prueba de conexión WSDL a preproducción/producción con latencia (sin CORS, vía main).
  - ⚠️ **Incidencias**: visor XML SOAP de la AEAT para rechazados/aceptados con errores y
    reintentos individual/masivo reutilizando la cola existente (sin editar huella ni XML).
  - 📜 **Declaración responsable** del productor del SIF (art. 10.d Orden HAC/1177/2024) con
    validaciones y exportación HTML imprimible (`src/verifactu/companion.ts`).
- **Empaquetado multi-arquitectura**: instaladores NSIS Windows **x64 + ARM64**
  (`ShopLogic-Setup-1.3.2-x64.exe` / `ShopLogic-Setup-1.3.2-arm64.exe`).

### Cambios
- Versión del proyecto a 1.3.2 en `package.json` (propagada a electron-builder y a la app vía
  `VITE_APP_VERSION`/`app.getVersion()`).
- README v1.3.2: título, sección de instalación con nombres de instaladores reales, nueva sección
  «Novedades (v1.3.2)» e historial de releases; contador i18n actualizado a 921 claves.
- IPC nuevos: `verifactu:companion-pick-p12`, `verifactu:companion-validate`,
  `verifactu:companion-install`, `verifactu:signer-detail`, `verifactu:test-connection`.
- 17 tests unitarios nuevos (`src/verifactu/__tests__/companion.test.ts`): estadísticas de la cola,
  caducidad del certificado, validaciones art. 10.d y generador de declaración responsable.

## 1.3.1 — Nueva identidad de logo (2026-10-13)

### Cambios
- **Logo nuevo 2026** (bolsa azul con teléfono, llave inglesa y gráfico) en la ventana de Electron,
  el instalador NSIS, los `.exe`, el favicon/PWA (`icon-512.png`) y los 20 mipmaps del launcher Android.
- Fuente canónica `assets/logo.png` (1024×1024 con transparencia) y pipeline `npm run icon` que
  regenera todos los formatos derivados (ICO 6 tamaños, web 512, Android por densidad).
- Eliminados los SVG vectoriales del icono anterior (`icon.svg`, `icons.svg`, `favicon.svg`) y todas
  sus referencias (manifest PWA, precache del service worker, vite.config).

### Correcciones
- Lint limpio (0 warnings) en los ficheros nuevos del módulo Veri*factu.
- README con la guía paso a paso del certificado AEAT (`.p12` → `signer.json` → preproducción).

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
