# 📱 ShopLogic Pro v1.3.5

<p align="center">
  <img src="public/icon-512.png" width="128" alt="ShopLogic Pro">
</p>

**ERP + TPV completo para tiendas de telefonía y accesorios** — ventas, cajas, inventario con trazabilidad, taller de reparaciones, facturación con Veri*factu, informes fiscales 303/347, compras de segunda mano y automatizaciones de mensajería. Funciona 100% local (tus datos nunca salen de tu equipo) y se actualiza sola desde GitHub Releases.

> 🌍 **Idiomas / Languages / Idiomas / 语言 / اللغات**: [English](README-en.md) · [Português](README-pt.md) · [中文](README-zh.md) · [العربية](README-ar.md)

[![Release](https://img.shields.io/github/v/release/jimelyo/shoplogic)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Plataforma](https://img.shields.io/badge/Windows-x64%20%7C%20arm64-blue)](https://github.com/jimelyo/shoplogic/releases/latest)
[![macOS](https://img.shields.io/badge/macOS-DMG%20x64%20%7C%20arm64-lightgrey)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Android](https://img.shields.io/badge/Android-APK%20v1.3.5-green)](https://github.com/jimelyo/shoplogic/releases/latest)
[![Idiomas](https://img.shields.io/badge/idiomas-5%20·%20RTL%20árabe-purple)](#-idiomas)
[![Licencia](https://img.shields.io/badge/uso-privado-informational)]()

---

## ✨ Funcionalidades

### 🛒 Punto de Venta (TPV)
- Cobro con **un toque** desde tarjetas de producto o tabla, con catálogo filtrado por categorías.
- **Pagos divididos**: cobra una venta con varios medios a la vez (ej. 20 € efectivo + resto tarjeta), reparto validado antes de cobrar y reflejado en el ticket.
- Descuentos por % o importe fijo, IVA incluido con desglose en pantalla.
- **Escáner de códigos**: por lector USB (escribe en el buscador) o con la **cámara** (códigos EAN/UPC/Code128/QR e IMEI) vía API nativa `BarcodeDetector`.
- **Atajos de teclado**: `F1` buscar · `F2` cobrar · `F3` escanear · `F4` vaciar carrito.
- Puntos de fidelidad automáticos por importe de compra.
- Ticket imprimible (58/80 mm) con logo y envío de recibo por **WhatsApp o email**.

### 📋 Presupuestos
- Crea un presupuesto de **venta o reparación** con líneas, validez y notas.
- Flujo: borrador → enviado → aceptado → **convertir con un clic**:
  - → **Venta** (descuenta stock en transacción atómica)
  - → **Reparación** (crea el ticket pre-llenado con dispositivo/IMEI/problema/coste)
- Caducidad automática y presupuesto imprimible estilo ticket.

### 📦 Inventario y movimientos
- Productos con código de barras, IMEI, coste, PVP (IVA incl.), stock mínimo y márgenes calculados.
- Alertas de stock bajo/agotado con notificaciones automáticas.
- **Historial de movimientos por producto** (ledger): ventas, compras, ajustes, devoluciones y compras de segunda mano con saldo anterior/posterior.
- Categorías personalizables con icono y color.
- Escáner de cámara para buscar productos.

### 🔧 Taller de reparaciones
- Tickets `R-000001` con cliente, dispositivo, IMEI, problema, diagnóstico y evolución de estados (recibido → diagnóstico → en proceso → esperando piezas → completado → entregado).
- **Impresión del ticket de entrada** al registrar la reparación (opcional en el momento de crearla, pensado para cuando el cliente sigue en el mostrador) con **vista previa** antes de imprimir.
- Aviso al cliente por WhatsApp/email al completar (automatizable), con resguardo imprimible.
- Ficha de **historial por IMEI** con garantía configurada.
- Facturación automática al entregar (opcional).

### 💶 Caja
- Apertura/cierre de turnos con fondo inicial, depósitos y retiradas.
- Arqueo esperado vs contado con diferencia calculada, corte por venta (efectivo), facturas y devoluciones.

### 🧾 Facturación y rectificativas
- Numeración configurable (secuencial, por fecha, por año o formato personalizado), serie y prefijos.
- Estados (borrador, enviada, pagada, parcial, vencida, cancelada) con cobros parciales.
- **PDF profesional** con marca de agua, copias normalizadas y ticket de ventas.
- **QR reglamentario** en el PDF: URL oficial de cotejo de la AEAT (35 mm, nivel M) + leyenda oficial «Factura verificable en la sede electrónica de la AEAT».
- **Rectificativas R1–R5 (por diferencias)**: emite facturas rectificativas desde Facturación y genera **de forma automática** la rectificativa de una devolución parcial o total, con encolado Veri*factu encadenado.

### 🛍️ Compras de segunda mano (trade-in)
- Módulo dedicado para **tasar, comprar y reabastecer** terminales y accesorios de segunda mano desde el menú principal.
- Tasación con desglose (coste + margen objetivo), registro de la compra al proveedor/particular y **alta directa al inventario** con su IMEI.
- Trazabilidad completa del stock: cada compra se registra como movimiento `trade_in` en el ledger del producto, con origen (particular) y precio pagado.
- Integrado con el TPV: el artículo comprado puede venderse como cualquier otro producto.

### 📈 Reports / Informes fiscales
- Ventas, beneficio, margen, ventas por categoría, reparaciones por estado.
- **Modelo 303 (IVA trimestral)**: liquidación por trimestres con IVA devengado y soportado deducible, exportación **PDF/CSV**.
- **Modelo 347**: declaración anual de operaciones con terceros (operaciones > 3.005 € por cliente/proveedor), exportación **PDF/CSV**.
- Resumen financiero (ingresos, gastos, balance) y exportación **PDF de cualquier informe**.

### 🇪🇸 Veri*factu — España (RD 1007/2023 · Orden HAC/1177/2024)
Módulo fiscal completo conforme a los documentos técnicos oficiales de la AEAT:
- **Huella SHA-256 oficial**: cadena `campo=valor&…` con el orden exacto del documento AEAT v0.1.2, UTF-8 y hex MAYÚSCULAS. Reproduce los **3 vectores de prueba oficiales** (alta inicial, alta encadenada y anulación encadenada).
- **Encadenamiento registro a registro** (`chainAlta`/`chainAnulacion`) con sensibilidad integral a cualquier campo modificado.
- **XML** de `RegistroAlta`/`RegistroAnulacion`/lote (≤ 1000 registros) según los esquemas `SuministroLR.xsd`/`SuministroInformacion.xsd`, validado contra el ejemplo oficial del doc. v1.0.3. Las **rectificativas** (R1–R5) se encadenan con su referencia a la factura original.
- **SOAP** hacia los endpoints WSDL oficiales (preproducción `prewww1.aeat.es` / producción `www1.agenciatributaria.gob.es`) con parser de `RespuestaSuministro` (`Correcto` / `AceptadoConErrores` / `Incorrecto`) y detalle de errores por registro.
- **Cola persistente y recuperable** tras reinicio: estados `PERSISTED → QUEUED → SENDING → ACCEPTED / ACCEPTED_WITH_ERRORS / REJECTED / RETRY_PENDING` con backoff 15 s → 1 min → 10 min → 1 h. La factura se persiste **siempre** (patrón outbox): si falla la emisión fiscal no se pierde ni se duplica.
- **Firma XAdES-Enveloped** (ETSI EN 319 132) con xml-crypto + node-forge en el proceso main de Electron, cargando un certificado `.p12/.pfx` local (ver [guía paso a paso](#%EF%B8%8F-verifactu--gu%C3%ADa-paso-a-paso-certificado-aeat--env%C3%ADo-firmado)). La clave privada nunca sale del proceso main.
- **Companion**, pantalla de incidencias, panel de estado y declaración responsable del productor del SIF (ver historial v1.3.2).
- **QR del cotejo AEAT** en el PDF de cada factura.

### 🤖 Automatizaciones y mensajería
- **Avisos por etapa del taller**: cada cambio de estado de una reparación puede notificar al cliente automáticamente:
  - 📥 Recibido → WhatsApp
  - 🛠️ En proceso → WhatsApp + Email
  - ⏰ Esperando piezas → WhatsApp + Email
  - ✅ Lista / Completada → WhatsApp + Email (resumen con coste final)
- Automatizaciones configurables adicionales: recibos de venta por WhatsApp, resumen diario, backup diario, alertas de stock y facturas vencidas…
- **WhatsApp** en dos modos: enlace directo `wa.me` (sin servidor) o **Cloud API** oficial.
- **Email** con presets de Gmail/Outlook/SMTP genérico. El **relay SMTP local** escucha solo en `127.0.0.1` y valida la cabecera `Origin` de cada envío.
- Cola de envío (outbox) con reintentos al reiniciar si el servidor relay no estaba disponible.
- Todo el uso queda registrado en la auditoría (quién envió qué y cuándo).

### 🌍 Idiomas

La app está **100% traducida a 5 idiomas** (≈ 1.016 claves sincronizadas por `npm run check:i18n`) y disponible desde la pantalla de login y desde el menú lateral:

| Código | Idioma | Bandera | RTL |
|---|---|---|---|
| `es` | Español (por defecto) | 🇪🇸 | — |
| `en` | English | 🇬🇧 | — |
| `pt` | Português | 🇵🇹 | — |
| `zh` | 中文 | 🇨🇳 | — |
| `ar` | العربية | 🇸🇦 | ✓ **RTL completo** |

- El idioma se guarda en `localStorage`(`sl_lang`) y persiste entre sesiones; el árabe cambia la dirección de la página (`dir=rtl`) y todos los estilos se adaptan con las utilidades lógicas de Tailwind (`ms-`, `me-`, `start-`, `end-`).
- Los tickets, PDF de facturas, y mensajes automáticos de WhatsApp/email también respetan el idioma activo.
- Fallback automático a español si falta una clave.

### ⚙️ Configuración y datos
- **Backup programado** + **backups cifrados opcionales AES-256-GCM** (clave derivada con PBKDF2-SHA256, 310.000 iteraciones) con UI de cifrado/descifrado en Ajustes.
- Múltiples monedas (EUR, USD, GBP, MXN, ARS, COP, CLP, BRL, CNY, MAD), IVA configurable. Marca propia: nombre de la app, logo, datos fiscales del comercio en tickets/PDF.
- Tema claro/oscuro + 6 colores de acento.
- Bloqueo de pantalla por inactividad con contraseña.
- RBAC por roles: **admin, manager, técnico, cajero**, con matriz de permisos editable módulo a módulo.
- Gestión de datos: export/import JSON completo, **exportación CSV por tabla (Excel)**, reset selectivo con backup previo automático.
- Auditoría: registro de acciones (login, ventas, modificaciones, envíos, impresiones) con usuario y fecha.

### 🔄 Auto-actualizaciones
- **Escritorio (Electron)**: consulta GitHub Releases al arrancar y cada 30 min; descarga en segundo plano con **descarga diferencial** (blockmaps), progreso visible y banner descartable por versión; la instalación se aplica al cerrar la app con **un solo UAC** (instalador one-click, sin asistente).
- **PWA (navegador)**: service worker detecta la nueva versión y la aplica al recargar (automático si lo activas en Apariencia → Actualización).
- **Offline real**: el service worker precachea todos los assets — funciona sin conexión desde la primera visita.

---

## 🔐 Seguridad y privacidad

- **100% local**: la base de datos vive en IndexedDB de tu navegador/equipo. Nada se envía a ningún servidor (los envíos de WhatsApp/email salen directamente de tu máquina o de tu propio relay).
- Contraseñas con **PBKDF2-SHA256 (210.000 iteraciones)** + salt aleatorio por usuario, comparación en tiempo constante y upgrade automático de hashes antiguos.
- **Bloqueo temporal del login** ante fallos repetidos (retardo exponencial `30 s·2ⁿ`): frena ataques de fuerza bruta offline sin bloquear al legítimo.
- Las **credenciales de mensajería quedan enmascaradas** en el snapshot diario on-disk; el backup manual completo las incluye solo si tú lo pides, avisado en la UI.
- **La contraseña del certificado `.p12` se cifra con safeStorage** (DPAPI en Windows / Keychain en macOS) y nunca se guarda en claro: los registros de Veri*factu se firman con la clave descifrada solo en el proceso main.
- **Backups cifrados AES-256-GCM** opcionales (PBKDF2 310k) — si eliges poner contraseña al backup, el fichero exportado queda ilegible sin ella.
- **Veri*factu**: el `.p12` del certificado AEAT se lee solo en el proceso main de Electron; la clave privada nunca llega al renderer ni viaja por la red. Sin firmador configurado la cola queda en `RETRY_PENDING` (nunca simula una aceptación).
- El **relay SMTP** local solo acepta conexiones de `127.0.0.1` y rechaza peticiones con `Origin` externo.
- Los backups importados se **validan fila a fila** antes de restaurar.
- Electron con `contextIsolation` + sandbox y sin integración de Node en el renderer.

---

## 🚀 Instalación

### 📱 Android
1. Descarga **`shoplogic-pro-v1.3.5-android.apk`** desde [Release v1.3.5](https://github.com/jimelyo/shoplogic/releases/tag/v1.3.5). ⚠️ La v1.3.5 está firmada con un **keystore nuevo**: no se instala encima de la v1.2.0 oficial (firma distinta) — desinstala antes si venías de esa versión.
2. Permite **instalar apps de origen desconocido** para tu navegador/gestor de archivos (Ajustes → Seguridad) la primera vez.
3. Abre el APK e instálala. Requiere **Android 6.0+ (API 23+)**. Sin permisos más allá de internet: los datos viven en IndexedDB dentro de la app, 100% locales.

<details>
<summary><b>Versión anterior v1.2.0 (misma firma que v1.1.0)</b></summary>

1. Descarga **`shoplogic-pro-v1.2.0-android.apk`** desde [Release v1.2.0](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0).
2. Permite **instalar apps de origen desconocido** para tu navegador/gestor de archivos (Ajustes → Seguridad) la primera vez.
3. Abre el APK e instálala. Requiere Android 6.0+ (API 23+).
</details>

### Windows (recomendado — escritorio)
1. Descarga el **instalador v1.3.5** para tu arquitectura (x64 y ARM64 empaquetados en la misma release) desde [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-Setup-1.3.5-x64.exe` (Windows 10/11 x64)
   - `ShopLogic-Setup-1.3.5-arm64.exe` (Windows on ARM)
2. Ejecuta el instalador (instalación silenciosa con un solo UAC). El acceso directo queda en el escritorio.
3. Las actualizaciones se descargan y aplican **automáticamente** a partir de ahí (v1.3.3 y anteriores se actualizan solas: mismo canal electron-updater).

### macOS
1. Descarga la **DMG v1.3.5** para tu arquitectura desde [Releases](https://github.com/jimelyo/shoplogic/releases/latest):
   - `ShopLogic-1.3.5-x64.dmg` (Intel)
   - `ShopLogic-1.3.5-arm64.dmg` (Apple Silicon)
2. Abre la DMG y arrastra la app a Aplicaciones. Las actualizaciones posteriores también son automáticas (`latest-mac.yml`).
3. ⚠️ El DMG aún **no está notarizado por Apple**: la primera vez macOS pedirá «≡ System Settings → Privacy & Security → Open Anyway».

<details>
<summary><b>Versión anterior v1.2.0 (instaladores Windows)</b></summary>

1. Descarga los instaladores de [Release v1.2.0](https://github.com/jimelyo/shoplogic/releases/tag/v1.2.0).
2. Ejecuta el instalador (instalación silenciosa con un solo UAC).
3. Las actualizaciones se aplican **automáticamente** a partir de ahí.
</details>

### Navegador (PWA)
- Sirve la build estática (`dist/`) con cualquier servidor web; también funciona abriendo `index.html` local.
- Instalable como app desde Chrome/Edge ("Install ShopLogic Pro").

### Primer arranque
La app carga datos de demostración (productos móviles, clientes, reparaciones, facturas…) y estos usuarios:

| Email | Contraseña | Rol |
|---|---|---|
| `admin@shoplogic.com` | `admin123` | Administrador (todo) |
| `manager@shoplogic.com` | `manager123` | Manager |
| `tecnico@shoplogic.com` | `tecnico123` | Técnico |
| `cajero@shoplogic.com` | `cajero123` | Cajero |

> ⚠️ **Cambia esas contraseñas o elimina esos usuarios antes de usar la app en producción** (Usuarios → editar).

---

## 🇪🇸 Veri*factu — Guía paso a paso (certificado AEAT + envío firmado)

Paso a paso para instalar el certificado electrónico del obligado tributario y probar un envío firmado contra la **preproducción** de la AEAT.

> Requisito previo: tener un **certificado electrónico cualificado** (o sello de empresa) del obligado (representante o AES) en formato `.p12`/`.pfx`, con su contraseña. Es el mismo certificado que se usa para otros trámites de la AEAT.

### Paso 1 · Activar Veri*factu y elegir el entorno

1. Abre la app: **Ajustes → Facturación → Veri*factu** (o usa el asistente 🧙 **Companion**, que guía estos pasos).
2. Modalidad: `VERI*FACTU`.
3. Entorno: `Pruebas (preproducción)`. El SOAP se dirigirá a `prewww1.aeat.es` (producción es `www1.agenciatributaria.gob.es`).
4. Guarda los cambios. Desde ahora, cada factura nueva (venta o reparación) se encola para emisión fiscal; las facturas históricas NO se re-registran.

### Paso 2 · Copiar el certificado e instalarlo en `signer.json`

Puedes hacerlo **con el asistente 🧙 VERI*FACTU Companion** (Ajustes → 🧙: selección nativa del fichero, validación de contraseña, copia y escritura segura) o a mano:

La app (escritorio) firma cada envío XAdES-Enveloped leyendo un `.p12` local cuyo certificado y contraseña se declaran en:

```
<carpeta de datos de la app>/verifactu/signer.json   →  { "p12Path": "…", "p12Password": "…" }
```

1. Encuentra la carpeta de datos. En Windows es `%APPDATA%\shoplogic\verifactu\` (la misma para la app instalada y para `npm run start`). Créala si no existe:

   ```bat
   cd %APPDATA%\shoplogic && mkdir verifactu
   ```

2. Copia el `.p12` (p. ej. `certificado-aeat.p12`) dentro de esa carpeta. Si lo copias **junto a `signer.json`** puedes usar una ruta relativa — es lo más sencillo.

3. Crea el fichero `signer.json` en esa carpeta con este contenido (con un editor de texto normal), y guarda:

   ```json
   {
     "p12Path": "certificado-aeat.p12",
     "p12Password": "LA-CONTRASEÑA-DEL-CERTIFICADO"
   }
   ```

   Notas:
   - `p12Path` también admite una ruta absoluta, p. ej. `"C:\\MiCarpeta\\certificado-aeat.p12"` (doble barra invertida en JSON).
   - Si `signer.json` falta o el `.p12` no existe, los registros quedan en `RETRY_PENDING` y el panel de estado informa del motivo — nunca se finge aceptación.
   - Desde v1.3.4 la contraseña de `signer.json` se **guarda cifrada con safeStorage** (DPAPI/Keychain) la primera vez que la introduce el asistente; un fichero escrito a mano con texto plano también funciona, pero se cifra tras el primer uso.

4. Reinicia la app (o vuelve a abrirla) y ve a **Ajustes → Facturación**: el panel de estado y la lista de incidencias muestran los registros encolados pasando de `QUEUED` → `SENDING` → `ACCEPTED` (o `REJECTED` con el detalle del error de la AEAT).

### Paso 3 · Emitir una factura de prueba y verificar

1. En el TPV, cobra una venta (o factura una reparación). Con Veri*factu activo, la factura se encadena y queda en la cola como `QUEUED`.
2. La cola procesa cada registro: genera la huella SHA-256 oficial + encadenamiento + XML `RegistroAlta` + firma XAdES, y lo envía por SOAP al entorno seleccionado.
3. Abre **Ajustes → Facturación**: en el panel aparecen los registros con su estado (`ACCEPTED` / `ACCEPTED_WITH_ERRORS` / `REJECTED` / `RETRY_PENDING`) y el contador de auto-auditoría `🔗 Cadena OK (N facturas)`.
4. Si la AEAT devuelve `Incorrecto`/`AceptadoConErrores`, la lista de **incidencias** muestra el **código + descripción del error** y podrás reintentar o reencolar sin tocar XML ni huella.
5. QR del cotejo AEAT: descarga o imprime la factura (PDF) — incluye el QR reglamentario y la leyenda oficial.

### Paso 4 · Pasar a producción (solo cuando preproducción devuelva `Correcto`)

1. Ajustes → Facturación → Veri*factu → Entorno: `Producción`.
2. Verifica la **primera factura en producción** revisando el panel / incidencias.
3. La declaración responsable del productor del SIF (NIF, nombre del sistema, versión, número de instalación) se completa en `settings.verifactuConfig.system` — la AEAT no homologa software; es un documento del productor que avala el cumplimiento del RD 1007/2023.

> 🧪 La prueba real contra preproducción exige el certificado del operador — el módulo está probado con los vectores oficiales de la AEAT (huella, XML, QR) y con un `.p12` autofirmado en los tests unitarios; solo el tráfico real con `prewww1.aeat.es` queda pendiente de verificar por el operador.

---

## 🛠️ Desarrollo

```bash
npm install          # dependencias
npm run dev          # Vite dev server (PWA en el navegador)
npm run start        # aplica la build a Electron local
npm run build        # build de producción (tsc + vite)
npm run dist         # empaqueta Windows x64 + arm64 con electron-builder
npm test             # tests unitarios (vitest)
npm run lint         # oxlint
npm run check:i18n   # comprueba 5 locales con llaves idénticas
```

### Build de macOS (DMG)

```bash
npm run build                   # build web a dist/
npx electron-builder --mac --x64 --arm64   # DMG x64 + arm64 en release/
```

### Build Android (Capacitor)

Lleva un JDK 21 (el sistema Java 25 es aún incompatible con AGP) y envuelve el build web en una shell nativa:

```bash
npm run build                    # build web a dist/
npx cap sync android             # copia dist/ + plugins al proyecto Android
export JAVA_HOME="$USERPROFILE/.jdks/jbr-21.0.11"     # JDK 21
export ANDROID_HOME="$LOCALAPPDATA/Android/Sdk"       # Android SDK
export SL_KEYSTORE="$USERPROFILE/.android/shoplogic-release.jks"  # keystore fuera del repo
export SL_KEYSTORE_PASS=…; export SL_KEY_ALIAS=shoplogic; export SL_KEY_PASS=…
cd android && ./gradlew assembleRelease      # APK firmada en app/build/outputs/apk/release/
```

### Stack
- **Frontend**: React 19 + TypeScript + Tailwind CSS 4 + Zustand.
- **Datos**: Dexie (IndexedDB) con transacciones atómicas; modelos tipados en `src/types`.
- **Escritorio**: Electron 44 + electron-updater con Releases de GitHub.
- **Fiscalidad**: módulo `src/verifactu/` (huella AEAT, encadenamiento, XML, SOAP, cola, QR) + firma XAdES en el proceso main (`xml-crypto` + `node-forge`).
- **Móvil**: Capacitor 8 (`capacitor.config.ts` + proyecto `android/`), APK firmada con keystore vía variables de entorno.
- **i18n**: i18next + react-i18next, 5 recursos tipados en `src/i18n` (es · en · pt · zh · ar con RTL).
- **Testing**: Vitest + fake-indexeddb (155 tests), incluidos tests de backups, credenciales, huella AEAT, firma XAdES, rectificativas y trade-in.

### Estructura
```
src/
├── components/    # 25+ módulos UI (POS, Cash, Inventory, Repairs, Quotes, Billing, Reports, TradeIns…)
├── verifactu/     # Módulo fiscal Veri*factu: huella, cadena, XML, SOAP, cola, QR (+ tests)
├── lib/           # lógica core: calc, stock, invoices, cash, messaging, backup, csv, update, tradein…
├── db/            # esquema Dexie + datos demo
├── i18n/          # es, en, pt, zh, ar (1.016 claves sincronizadas)
├── schemas/       # validación Zod de todos los formularios
└── types/         # modelos tipados del dominio
electron/          # proceso principal, preload, updater y firmador XAdES
android/           # proyecto Android nativo (Capacitor, build Gradle firmada)
server/            # relay SMTP local (127.0.0.1) para envíos de email
public/            # service worker + manifest
```

---

## 📋 Novedades / Changelog (v1.3.5)

### 🔩 Mano de obra en reparaciones
- Cada reparación puede marcar la mano de obra como **incluida en el precio** (informativa) o **aparte** (se suma al precio): importe, desglose IVA en vivo, línea propia en la factura automática y en el resguardo impreso.
- Hardening: CSP de producción, backups con digest SHA-256 y credenciales enmascaradas, permisos por acción e i18n lazy.


### 🛍️ Compras de segunda mano (trade-in)
- Módulo renombrado a **"Compras 2ª mano"** (navegación en los 5 idiomas) para tasar, comprar y reabastecer terminales de segunda mano.
- Tasación con coste + margen, registro de la compra y **alta directa al inventario** con IMEI.
- **Trazabilidad total**: cada compra se registra como movimiento `trade_in` en el ledger del producto, con origen y precio pagado.

### 🧾 Rectificativas R1–R5
- Emisión de **facturas rectificativas (por diferencias)** desde Facturación, y **detección automática** en devoluciones parciales/totales: la rectificativa se genera sola y se encola en Veri*factu con su referencia a la factura original.

### 📈 Informes fiscales
- **Modelo 303 (IVA trimestral)** y **Modelo 347 (operaciones con terceros)** en Reportes, con exportación **PDF y CSV** lista para la declaración.

### 🔐 Hardening de seguridad
- La contraseña del certificado `.p12` de Veri*factu se **cifra con safeStorage** (DPAPI/Keychain) en vez de guardarse en texto plano.
- El **relay SMTP local** escucha solo en `127.0.0.1` y valida la cabecera `Origin`.
- **Bloqueo temporal del login** ante fallos repetidos (backoff `30 s·2ⁿ`).
- **Backups cifrados opcionales AES-256-GCM** (PBKDF2 310k) con UI de cifrado/descifrado en Ajustes.

### 🎨 Nueva identidad visual
- Logo corporativo nuevo en Electron (ico/icns), PWA, Android (mipmaps + splash) y social-preview de GitHub.

### Empaquetado multi-plataforma
- Instaladores NSIS Windows **x64 y ARM64** + **DMG macOS x64/arm64** + **APK Android** (versionCode 134) y auto-update para escritorio vía `latest.yml` / `latest-mac.yml`.

---

## 🗺️ Historial de releases

| Version | Novedades principales |
|---|---|
| **v1.3.5** (Windows x64/ARM64 + macOS x64/ARM64 + Android) | **Mano de obra en reparaciones** (incluida o aparte, en facturas y resguardos) · hardening: CSP de producción, backups digest SHA-256 + credenciales enmascaradas, permisos por acción, facturas atómicas · i18n lazy |
| **v1.3.4** (Windows x64/ARM64 + macOS x64/ARM64 + Android) | **Compras 2ª mano** (trade-in con alta a inventario y trazabilidad) · **rectificativas R1–R5** con detección automática en devoluciones · **informes fiscales Modelo 303 y 347** · hardening de seguridad (safeStorage, SMTP localhost, bloqueo de login, backups AES-256-GCM) · nuevo logo en todas las plataformas |
| **v1.3.3** (Windows) | **Impresión del ticket de reparación**: opción al crear + vista previa modal · cabecera del ticket sincronizada con el nombre real de la tienda |
| **v1.3.2** (Windows x64 + ARM64) | **VERI*FACTU Companion**: asistente de certificado `.p12` con seguridad en el proceso main · diagnóstico de la cola AEAT + prueba de conexión · centro de incidencias con visor XML · declaración responsable exportable · empaquetado multi-arquitectura x64/ARM64 |
| **v1.3.0** (Windows) | **Veri\*factu completo (RD 1007/2023)**: huella SHA-256 oficial con vectores AEAT · encadenamiento · XML/SOAP SuministroLR · cola persistente con reintentos · QR reglamentario en PDF · pantalla de incidencias con errores AEAT · **firmador XAdES-Enveloped** con `.p12` local · [guía paso a paso](#%EF%B8%8F-verifactu--gu%C3%ADa-paso-a-paso-certificado-aeat--env%C3%ADo-firmado) |
| **v1.2.0** (Windows + Android) | **Búsqueda global Ctrl+K** · **copia de seguridad externa programada** · **Veri\*factu (España)** con huellas SHA-256 encadenadas · índices Dexie para catálogos grandes · workflow de CI de releases |
| **v1.1.0** (Windows) | Login por selección de usuario + contraseña · aviso demo eliminado |
| **v1.0.6** | Avisos por etapa del taller (recibido/en proceso/esperando piezas) en WhatsApp + email · icono regenerado |
| **v1.0.5** | Nuevo icono corporativo (teléfono + llave + gráfico) en instalador, ventana y PWA |
| **v1.0.4** | Instalador one-click (auto-update con un solo UAC) · README completo |
| **v1.0.3** | Presupuestos convertibles en venta/reparación · pagos divididos en TPV · atajos F1-F4 · CSV por tabla · credenciales enmascaradas en backups · PWA offline real |
| **v1.0.2** | Versión visible en el sidebar · banner de actualización no forzada |
| **v1.0.1** | Auto-update vía GitHub Releases con electron-updater |

## 📄 Licencia
Proyecto privado. Todos los derechos reservados.
