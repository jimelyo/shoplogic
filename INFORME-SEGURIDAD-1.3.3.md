# 🔒 INFORME-SEGURIDAD-1.3.3.md — Revisión de seguridad de ShopLogic Pro

**Fecha:** 2026-10-19 · **Alcance:** capa financiera/fiscal (módulo VERI*FACTU y firma XAdES), autenticación (PBKDF2), backups (enmascaramiento de credenciales), `signer.json`, IPC de Electron y relay `server.mjs`. Metodología: revisión de código con criterios de confianza del OWASP Cheat Sheet Series (solo se reportan patrones con entrada atacante confirmada).

---

## ✅ Verificado correcto (sin acciones)

| Área | Comprobación | Resultado |
|---|---|---|
| Electron (`main.cjs`) | `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false` | ✔ Configuración correcta |
| IPC | Puente mínimo vía `contextBridge`; sin `fs`, sin Node en el preload | ✔ |
| `windowOpenHandler` | Solo `http(s)/mailto/whatsapp` abren en navegador externo | ✔ |
| Contraseñas | PBKDF2-SHA256, 210 000 iteraciones, salt aleatorio por usuario, formato versionado (`pbkdf2$…`) con **rehash automático** de hashes antiguos | ✔ |
| Comparación de hashes | `equals()` con OR acumulado, longitud fija, sin salida anticipada | ✔ Tiempo constante |
| Firma XAdES | Clave privada solo en proceso main; el IPC `verifactu:sign` valida entrada (`typeof xml === 'string'`), devuelve solo XML firmado o error genérico; la contraseña del `.p12` nunca vuelve al renderer | ✔ |
| Backups on-disk | Los `DailySnapshot` escriben **credenciales enmascaradas** (`applyCredentialMask`); la importación verifica `hasMaskedCredentials` y valida fila a fila con `TABLE_MIN_FIELDS` | ✔ |
| Backup externo por IPC | `files:save-text` aplica lista blanca `shoplogic-backup-*.json` + `path.basename(dir)` (sin path traversal) y escribe solo bajo `Documents/ShopLogic Backups` | ✔ |
| Sanitización de formularios | Zod + `sanitize()` elimina `<>`, `javascript:` y `on\w+=` en **todos** los formularios del ERP | ✔ |
| Relay `/api/send` | `MAX_BODY` 64 KiB, `AbortSignal.timeout`, saneado por campo (`clean/max`) y URL de Graph API con `encodeURIComponent` | ✔ |
| SMTP client | `STARTTLS` automático si se anuncia, sin credenciales en logs, dot-stuffing correcto | ✔ |

---

## ⚠️ Hallazgos (ordenados por prioridad)

### H1 · Capacidades de Electron más duras posibles — MEDIUM
**Archivo:** `electron/main.cjs:66-79`
`webContents.setWindowOpenHandler` permite `whatsapp:` al navegador externo; no hay permite-lista de comandos `will-navigate` y no se exige CSP en `index.html`. El riesgo es bajo porque el renderer carga `dist/` local, pero un cambio futuro (anuncios, enlaces de WhatsApp con datos interpolados) amplía la superficie.
**Recomendación:** (1) CSP explícito en `index.html` (`default-src 'self'`; sin `unsafe-eval`); (2) `will-navigate` bloqueado a `app://dist` salvo Same-Origin; (3) restringir `openExternal` a `https://` + `mailto:`/`wa.me`.

### H2 · Contraseña del certificado en claro en `signer.json` — MEDIUM
**Archivo:** `electron/verifactu-companion.cjs:installSignerConfig`
El `.p12` y su contraseña viven en texto claro en `%APPDATA%/…/verifactu/signer.json` (0600 informativa; en Windows no se aplican ACL POSIX: cualquier proceso del usuario puede leerla). Se acepta como compromiso de la fase actual, no hay alternativa local sin DPAPI.
**Recomendación:** migrar a `safeStorage` (DPAPI) — cifrar la contraseña del `.p12` con la cuenta de Windows y guardar solo el blob cifrado en `signer.json`, descifrándolo en el proceso main. Retro-compatible: si `p12Password` es texto claro, seguir funcionando mientras se reescribe cifrado a la primera firma.

### H3 · `document.write` en la impresión de tickets — MEDIUM (necesita verificación de flujo)
**Archivo:** `src/lib/print.ts:22`
Se escribe el HTML del ticket/factura en una ventana nueva sin escapar los datos del cliente. El riesgo está mitigado por `sanitize()` en formularios y la validación fila a fila de imports — pero los backups de versiones anteriores no re-sanitizan: un `customers[123].name` histórico con HTML activo se inyectaría al imprimir.
**Recomendación:** función `escHtml()` aplicada en el montaje del HTML del ticket/QR en `print.ts` y `pdf.ts` (mejor pendiente centralizada que depender de la sanidad histórica de la BD).

### H4 · Relay `server.mjs` escucha en `0.0.0.0` y sin autenticación — MEDIUM
**Archivo:** `server.mjs:106` y `/api/send`
Cualquier máquina en la LAN puede usar el relay de envío si consigue credenciales y ningún `Origin` se valida (un POST `text/plain` desde una pestaña del propio PC no dispara preflight CORS). Hoy el cliente envía sus credenciales en el payload, por lo que el riesgo es limitado, pero el endpoint también es un **abre-puerta para fuga de credenciales si se loguea el body** (no ocurre) o si se guarda algún token en el renderer.
**Recomendación:** (1) escuchar por defecto en `127.0.0.1` (flag `--lan` voluntario); (2) misma verificación de `Origin`/`Sec-Fetch-Site` en `/api/send` (rechazar si la cabecera difiere del Host del server); (3) secreto compartido opcional en `SHOLOGIC_RELAY_TOKEN`.

### H5 · Sin bloqueo de intentos fallidos del login — LOW/MEDIUM
**Archivo:** `src/store/store.ts` (login) y auditoría
PBKDF2 210k frena el offline brute-force, pero un atacante local puede hacer fuerza bruta online sin límite ( IndexedDB en JS está disponible para cajeros con la app abierta).
**Recomendación:** contador de intentos por usuario con retroceso lineal (p. ej. `3 intentos → espera 30 s × n`) y registro explícito en `logs` como ya hace `sys_suspicious_alert`.

### H6 · Usuarios demo con contraseñas conocidas — LOW (documentado en README)
`admin@shoplogic.com/admin123` etc. El README ya exige cambiarlas; analizar añadir al arranque (si `seedDatabase` corre de nuevo) un banner si algún usuario demo no ha cambiado su contraseña.

### H7 · Backups sin cifrar en disco/ externos — LOW
`shoplogic-backup-*.json` contienen ventas, clientes, IMEIs y DNI en claro (con credenciales enmascaradas). Recomendar opción de exportación cifrada (AES-GCM con clave derivada PBKDF2 de una contraseña, WebCrypto ya disponible en el proyecto).

---

## 🤝 Resumen

La base es sólida: el diseño local-first minimiza la superficie red, la criptografía de contraseñas es correcta y el manejo del `.p12` respeta el principio menos-privilegiado en el proceso main. Los puntos duros están en la Industrias externas (relay LAN, impresión, CSP) y en la durabilidad de la contraseña del firmador. Con H2 (DPAPI), H3 (`escHtml`) y H4 (bind localhost) el nivel queda muy alto.

*Revisado con criterios de confianza: sin reportes de patrones teóricos.*
